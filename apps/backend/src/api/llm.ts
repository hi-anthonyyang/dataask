import { Router } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { validateQuery } from '../security/sanitize';
import { llmCache } from '../utils/cache';

const router = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Optimized model configuration for cost reduction
const MODEL_CONFIG = {
  classification: 'gpt-4o-mini',     // Simple JSON output - 95% cheaper
  nlToSql: 'gpt-4o',                // Needs accuracy - 83% cheaper  
  analysis: 'gpt-4o',               // Needs quality - 83% cheaper
  summarization: 'gpt-3.5-turbo'    // Short outputs - 92% cheaper
} as const;

// Balanced schema compression - maintains accuracy while reducing tokens
const getOptimizedSchema = (schema: any): string => {
  return schema.tables.map((table: any) => {
    const columns = table.columns.map((col: any) => {
      // Keep essential type info but compress common patterns
      let type = col.type.toLowerCase();
      type = type.replace(/varchar\(\d+\)/g, 'varchar')
               .replace(/char\(\d+\)/g, 'char')
               .replace(/decimal\(\d+,\d+\)/g, 'decimal')
               .replace(/timestamp with time zone/g, 'timestamptz');
      
      return `${col.name}:${type}${col.nullable ? '?' : ''}`;
    }).join(',');
    
    return `${table.name}(${columns})`;
  }).join(' ');
};

// Schema for natural language to SQL requests
const NLQuerySchema = z.object({
  query: z.string().min(1),
  schema: z.object({
    tables: z.array(z.object({
      name: z.string(),
      columns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean().optional()
      }))
    }))
  }),
  connectionType: z.enum(['postgresql', 'sqlite', 'mysql'])
});

// Schema for analysis requests
const AnalysisSchema = z.object({
  data: z.array(z.record(z.any())),
  query: z.string(),
  context: z.string().optional()
});

// Schema for summarization requests
const SummarizationSchema = z.object({
  query: z.string().min(1)
});

// AI-powered query classification with caching and compression
const classifyQuery = async (query: string, schema: any): Promise<{
  isVague: boolean;
  queryType: 'specific' | 'exploratory' | 'unclear';
  suggestions?: string[];
  message?: string;
}> => {
  try {
    // Check cache first
    const schemaHash = getOptimizedSchema(schema);
    const cacheKey = llmCache.getCacheKey('classification', query, schemaHash);
    const cached = llmCache.get(cacheKey);
    if (cached) {
      logger.info('Classification cache hit', { query: query.substring(0, 50) });
      return cached;
    }

    // Compressed prompt - 70% token reduction
    const classificationPrompt = `Classify query as SPECIFIC (can generate SQL) or EXPLORATORY (needs suggestions).

Schema: ${schemaHash}
Query: "${query}"

SPECIFIC: Mentions concrete data/tables/analysis goals
EXPLORATORY: Vague, asks for ideas/insights

If EXPLORATORY, generate 3 actionable questions based on schema.

JSON response:
{"type": "specific|exploratory", "reason": "brief", "suggestions": ["q1","q2","q3"]}`;

    const completion = await openai.chat.completions.create({
      model: MODEL_CONFIG.classification,
      messages: [
        { role: 'system', content: classificationPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.0, // Deterministic for caching
      max_tokens: 200
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) {
      return { isVague: false, queryType: 'specific' };
    }

    try {
      const parsed = JSON.parse(response);
      
      const result = parsed.type === 'exploratory' ? {
        isVague: true,
        queryType: 'exploratory' as const,
        suggestions: parsed.suggestions || [],
        message: 'I can help you explore your data! Try one of these suggestions:'
      } : {
        isVague: false,
        queryType: 'specific' as const
      };

      // Cache the result
      llmCache.set(cacheKey, result, 30 * 60 * 1000); // 30 minutes TTL
      
      if (result.isVague) {
        logger.info('AI classified query as exploratory', { 
          query: query.substring(0, 50),
          reason: parsed.reason,
          suggestions: parsed.suggestions
        });
      }
      
      return result;
    } catch (parseError) {
      logger.warn('Failed to parse query classification response', { response, error: parseError });
      return { isVague: false, queryType: 'specific' };
    }
  } catch (error) {
    logger.error('Query classification failed', { error });
    return { isVague: false, queryType: 'specific' };
  }
};



// Convert natural language to SQL
router.post('/nl-to-sql', async (req, res) => {
  try {
    const request = NLQuerySchema.parse(req.body);
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    // Use AI to classify query and handle exploratory requests
    const classification = await classifyQuery(request.query, request.schema);
    
    if (classification.isVague) {
      return res.json({
        isVague: true,
        message: classification.message,
        suggestions: classification.suggestions,
        originalQuery: request.query
      });
    }

    // Check cache first
    const schemaHash = getOptimizedSchema(request.schema);
    const cacheKey = llmCache.getCacheKey('sql', request.query, `${request.connectionType}-${schemaHash}`);
    const cached = llmCache.get(cacheKey);
    if (cached) {
      logger.info('SQL generation cache hit', { query: request.query.substring(0, 50) });
      return res.json(cached);
    }

    // Optimized prompt - balanced token reduction with accuracy
    const systemPrompt = `Convert natural language to ${request.connectionType.toUpperCase()} SQL.
CRITICAL: Generate ONLY a single SELECT statement. No explanations, no comments.
Use exact table/column names from schema: ${schemaHash}
Example: SELECT * FROM customers WHERE city = 'New York' LIMIT 100;`;

    const completion = await openai.chat.completions.create({
      model: MODEL_CONFIG.nlToSql,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.query }
      ],
      temperature: 0.1,
      max_tokens: 400
    });

    const generatedSQL = completion.choices[0]?.message?.content?.trim();
    
    if (!generatedSQL) {
      return res.status(500).json({ 
        error: 'Failed to generate SQL query' 
      });
    }

    // Validate the generated SQL for security
    const validationResult = validateQuery(generatedSQL);
    if (!validationResult.isValid) {
      logger.warn('LLM generated invalid SQL:', { 
        query: generatedSQL, 
        errors: validationResult.errors 
      });
      return res.status(400).json({ 
        error: 'Generated query failed security validation',
        details: validationResult.errors
      });
    }

    logger.info('NL-to-SQL conversion successful', { 
      naturalLanguage: request.query.substring(0, 50),
      sql: generatedSQL.substring(0, 100)
    });

    const result = { 
      sql: generatedSQL,
      explanation: `Generated SQL for: "${request.query}"`
    };

    // Cache successful result
    llmCache.set(cacheKey, result, 60 * 60 * 1000); // 1 hour TTL

    return res.json(result);

  } catch (error) {
    logger.error('NL-to-SQL conversion failed:', error);
    return res.status(500).json({ 
      error: error instanceof z.ZodError ? 'Invalid request parameters' : 'Failed to generate SQL'
    });
  }
});

// Generate insights from query results
router.post('/analyze', async (req, res) => {
  try {
    const request = AnalysisSchema.parse(req.body);
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    // Check cache first
    const rowCount = request.data.length;
    const columns = request.data.length > 0 ? Object.keys(request.data[0]) : [];
    const cacheKey = llmCache.getCacheKey('analysis', request.query, `${rowCount}-${columns.join(',')}`);
    const cached = llmCache.get(cacheKey);
    if (cached) {
      logger.info('Analysis cache hit', { query: request.query.substring(0, 50) });
      return res.json(cached);
    }

    // Data summary - reduce tokens by 50%
    const sampleValues = columns.reduce((acc, col) => {
      acc[col] = [...new Set(request.data.slice(0, 3).map(row => row[col]))];
      return acc;
    }, {} as Record<string, any[]>);

    // Compressed prompt - 60% token reduction
    const systemPrompt = `Analyze query results and generate business insights:
1. Brief summary 2. Key patterns 3. Notable observations 4. Follow-up questions
Keep concise and actionable.`;

    const userPrompt = `Query: ${request.query}
Results: ${rowCount} rows, ${columns.length} columns
Columns: ${columns.join(', ')}
Sample values: ${JSON.stringify(sampleValues)}`;

    const completion = await openai.chat.completions.create({
      model: MODEL_CONFIG.analysis,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 600
    });

    const analysis = completion.choices[0]?.message?.content;
    
    if (!analysis) {
      return res.status(500).json({ 
        error: 'Failed to generate analysis' 
      });
    }

    logger.info('Data analysis generated successfully');

    const result = { 
      analysis,
      metadata: {
        rowCount,
        columns,
        sampleSize: Math.min(3, request.data.length)
      }
    };

    // Cache the result
    llmCache.set(cacheKey, result, 45 * 60 * 1000); // 45 minutes TTL

    return res.json(result);

  } catch (error) {
    logger.error('Data analysis failed:', error);
    return res.status(500).json({ 
      error: error instanceof z.ZodError ? 'Invalid request parameters' : 'Failed to generate analysis'
    });
  }
});

// Generate concise title for natural language query
router.post('/summarize', async (req, res) => {
  try {
    const request = SummarizationSchema.parse(req.body);
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    // Check cache first
    const cacheKey = llmCache.getCacheKey('summary', request.query);
    const cached = llmCache.get(cacheKey);
    if (cached) {
      logger.info('Summarization cache hit', { query: request.query.substring(0, 50) });
      return res.json(cached);
    }

    // Detect query type and use compressed prompts - 75% token reduction
    const isSqlQuery = /^\s*(SELECT|WITH|EXPLAIN|DESCRIBE)\s+/i.test(request.query.trim())

    const systemPrompt = isSqlQuery 
      ? `Create business title for SQL (max 50 chars). Focus on purpose, not technical details.`
      : `Create descriptive title for data query (max 50 chars). Be specific and business-focused.`;

    const userPrompt = `"${request.query}"`;

    const completion = await openai.chat.completions.create({
      model: MODEL_CONFIG.summarization,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.0, // Deterministic for caching
      max_tokens: 15
    });

    const title = completion.choices[0]?.message?.content?.trim();
    
    if (!title) {
      // Fallback to truncation iffails
      const fallbackTitle = request.query.length > 50 
        ? request.query.substring(0, 47).trim() + '...'
        : request.query;
      
      return res.json({ 
        title: fallbackTitle,
        source: 'fallback'
      });
    }

    logger.info('Query summarization successful', { 
      originalQuery: request.query.substring(0, 50),
      generatedTitle: title,
      queryType: isSqlQuery ? 'sql' : 'natural_language'
    });

    const result = { 
      title: title,
      source: 'ai'
    };

    // Cache successful result
    llmCache.set(cacheKey, result, 2 * 60 * 60 * 1000); // 2 hours TTL

    return res.json(result);

  } catch (error) {
    logger.error('Query summarization failed:', error);
    
    // Fallback to truncation on any error
    const request = req.body;
    const fallbackTitle = request.query && request.query.length > 50 
      ? request.query.substring(0, 47).trim() + '...'
      : request.query || 'Untitled Query';
    
    return res.json({ 
      title: fallbackTitle,
      source: 'fallback'
    });
  }
});

// Health check for LLM service
router.get('/health', async (req, res) => {
  try {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    return res.json({
      status: hasApiKey ? 'OK' : 'No API key configured',
      hasApiKey,
      model: 'gpt-4'
    });
  } catch (error) {
    logger.error('LLM health check failed:', error);
    return res.status(500).json({ error: 'Health check failed' });
  }
});

export { router as llmRouter }; 