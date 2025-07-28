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

// MySQL-specific SQL validation and correction
const validateAndCorrectMySQLSyntax = (sql: string): string => {
  let correctedSQL = sql;
  
  // Common PostgreSQL to MySQL conversions
  const conversions = [
    // DATE_TRUNC to DATE_FORMAT
    {
      pattern: /DATE_TRUNC\s*\(\s*'month'\s*,\s*([^)]+)\s*\)/gi,
      replacement: "DATE_FORMAT($1, '%Y-%m-01')"
    },
    {
      pattern: /DATE_TRUNC\s*\(\s*'year'\s*,\s*([^)]+)\s*\)/gi,
      replacement: "DATE_FORMAT($1, '%Y-01-01')"
    },
    {
      pattern: /DATE_TRUNC\s*\(\s*'day'\s*,\s*([^)]+)\s*\)/gi,
      replacement: "DATE($1)"
    },
    
    // INTERVAL syntax
    {
      pattern: /INTERVAL\s+'(\d+)\s+(year|month|day|hour|minute|second)s?'/gi,
      replacement: "INTERVAL $1 $2"
    },
    
    // EXTRACT to MySQL date functions
    {
      pattern: /EXTRACT\s*\(\s*YEAR\s+FROM\s+([^)]+)\s*\)/gi,
      replacement: "YEAR($1)"
    },
    {
      pattern: /EXTRACT\s*\(\s*MONTH\s+FROM\s+([^)]+)\s*\)/gi,
      replacement: "MONTH($1)"
    },
    {
      pattern: /EXTRACT\s*\(\s*DAY\s+FROM\s+([^)]+)\s*\)/gi,
      replacement: "DAY($1)"
    },
    
    // string_agg to GROUP_CONCAT
    {
      pattern: /string_agg\s*\(\s*([^,]+),\s*'([^']+)'\s*\)/gi,
      replacement: "GROUP_CONCAT($1 SEPARATOR '$2')"
    },
    
    // Remove PostgreSQL-specific functions that don't exist in MySQL
    {
      pattern: /\bpg_\w+\s*\([^)]*\)/gi,
      replacement: ""
    }
  ];
  
  // Apply conversions
  for (const conversion of conversions) {
    correctedSQL = correctedSQL.replace(conversion.pattern, conversion.replacement);
  }
  
  // Log if any conversions were made
  if (correctedSQL !== sql) {
    logger.info('MySQL syntax corrections applied:', {
      original: sql.substring(0, 100),
      corrected: correctedSQL.substring(0, 100)
    });
  }
  
  return correctedSQL;
};

// Enhanced schema with relationship hints for better SQL generation
const getOptimizedSchema = (schema: any): string => {
  return schema.tables.map((table: any) => {
    const columns = table.columns.map((col: any) => {
      // Keep essential type info but compress common patterns
      let type = col.type.toLowerCase();
      type = type.replace(/varchar\(\d+\)/g, 'varchar')
               .replace(/char\(\d+\)/g, 'char')
               .replace(/decimal\(\d+,\d+\)/g, 'decimal')
               .replace(/timestamp with time zone/g, 'timestamptz');
      
      // Add hints for common relationship patterns
      let hint = '';
      if (col.name.endsWith('_id') && col.name !== 'id') {
        const refTable = col.name.replace('_id', '');
        hint = `->${refTable}`;
      }
      
      return `${col.name}:${type}${hint}${col.nullable ? '?' : ''}`;
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

    // Clean classification with proper suggestion generation
    const classificationPrompt = `Analyze user query and classify:

Query: "${query}"
Schema: ${schemaHash}

CLASSIFICATION:
- SPECIFIC: Has analytical intent (trends, comparisons, metrics, data exploration)
- EXPLORATORY: Extremely vague single words with no context

If EXPLORATORY, generate 3 practical data analysis questions based on the provided schema tables and columns.

RESPONSE FORMAT:
{"type": "specific|exploratory", "suggestions": ["meaningful question 1", "meaningful question 2", "meaningful question 3"]}`;

    const completion = await openai.chat.completions.create({
      model: MODEL_CONFIG.classification,
      messages: [
        { role: 'system', content: classificationPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.0, // Deterministic for caching
      max_tokens: 150
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

    // Database-specific SQL generation prompt
    const getDatabaseSpecificRules = (connectionType: string) => {
      switch (connectionType.toLowerCase()) {
        case 'mysql':
          return `🚨 CRITICAL: You are generating MySQL SQL ONLY. PostgreSQL syntax is FORBIDDEN.

⚠️ NEVER USE THESE POSTGRESQL FUNCTIONS IN MYSQL:
- ❌ DATE_TRUNC() → ✅ Use DATE_FORMAT() instead
- ❌ EXTRACT() → ✅ Use YEAR(), MONTH(), DAY() instead  
- ❌ string_agg() → ✅ Use GROUP_CONCAT() instead
- ❌ INTERVAL '1 year' → ✅ Use INTERVAL 1 YEAR instead

✅ CORRECT MYSQL SYNTAX:

DATE/TIME FUNCTIONS:
- ✅ DATE_FORMAT(date, '%Y-%m-01') for month grouping
- ✅ DATE_FORMAT(date, '%Y-01-01') for year grouping  
- ✅ DATE_SUB(NOW(), INTERVAL 1 YEAR) for time intervals
- ✅ DATE_ADD(date, INTERVAL 1 MONTH) for date arithmetic
- ✅ YEAR(date), MONTH(date), DAY(date) for date extraction
- ✅ NOW() or CURRENT_TIMESTAMP for current time

IDENTIFIERS:
- ✅ Use backticks (\`) for table/column names if needed
- ✅ Example: \`table_name\`, \`column name\`

AGGREGATION:
- ✅ COUNT(*), SUM(), AVG(), MAX(), MIN() as in standard SQL
- ✅ GROUP_CONCAT(column SEPARATOR ', ') for string aggregation

LIMITS:
- ✅ Use LIMIT clause at the end: SELECT ... FROM ... WHERE ... LIMIT 100

JOINS:
- ✅ Standard JOIN syntax: FROM table1 JOIN table2 ON table1.id = table2.id
- ✅ LEFT JOIN, RIGHT JOIN, INNER JOIN as needed

SUBQUERIES:
- ✅ Standard subquery syntax with parentheses

WINDOW FUNCTIONS:
- ✅ ROW_NUMBER(), RANK(), DENSE_RANK() with OVER() clause

🚨 REMEMBER: You are generating MySQL syntax ONLY. PostgreSQL functions are WRONG for MySQL.`;
        case 'postgresql':
          return `- Use DATE_TRUNC('month', date) for month grouping
- Use INTERVAL '1 year' for time intervals
- Use double quotes (") for table/column names if needed`;
        case 'sqlite':
          return `- Use strftime('%Y-%m', date) for month grouping
- Use datetime('now', '-1 year') for time intervals
- Use square brackets ([]) for table/column names if needed`;
        default:
          return `- Use DATE_TRUNC('month', date) for month grouping
- Use INTERVAL '1 year' for time intervals`;
      }
    };

    const systemPrompt = `Generate a single ${request.connectionType.toUpperCase()} SQL query. Return ONLY the SQL query with no formatting, no markdown, no code blocks, no comments.

Schema: ${schemaHash}
Foreign keys: column_id->table means JOIN table ON column_id = table.id

Rules:
- Start with SELECT
- Single statement only
- Proper JOINs for relationships  
- Include meaningful column aliases
- End with semicolon
${getDatabaseSpecificRules(request.connectionType)}

Example response format:
SELECT city, COUNT(*) AS customer_count FROM customers GROUP BY city LIMIT 100;`;

    const completion = await openai.chat.completions.create({
      model: MODEL_CONFIG.nlToSql,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.query }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    let generatedSQL = completion.choices[0]?.message?.content?.trim();
    
    if (!generatedSQL) {
      return res.status(500).json({ 
        error: 'Failed to generate SQL query' 
      });
    }

    // Clean up any unwanted formatting
    generatedSQL = generatedSQL
      .replace(/```sql\n?/g, '')  // Remove SQL code block markers
      .replace(/```\n?/g, '')     // Remove any remaining code block markers
      .replace(/^[^\w\s]*/, '')   // Remove any leading non-word characters
      .trim();

    // MySQL-specific SQL validation and correction
    if (request.connectionType.toLowerCase() === 'mysql') {
      generatedSQL = validateAndCorrectMySQLSyntax(generatedSQL);
    }

    // Validate the generated SQL for security
    const validationResult = validateQuery(generatedSQL);
    if (!validationResult.isValid) {
      logger.warn('LLM generated invalid SQL:', { 
        query: generatedSQL.substring(0, 200), 
        errors: validationResult.errors,
        fullQuery: generatedSQL
      });
      return res.status(400).json({ 
        error: 'Generated query failed security validation',
        details: validationResult.errors,
        generatedSQL: generatedSQL.substring(0, 200) // Include partial SQL for debugging
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