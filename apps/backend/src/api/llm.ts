import { Router, Request, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { validateSQLQuery } from '../utils/validation';
import { llmCache } from '../utils/cache';
import { 
  sanitizePromptInput, 
  validateLLMResponse, 
  createSafePrompt, 
  logSecurityEvent 
} from '../security/promptSanitize';
import { LLM_MODEL_CONFIG, LLM_MESSAGES } from '../utils/constants';
import { handleZodError, handleGenericError } from '../utils/errors';
import {
  DatabaseSchema,
  ClassificationResult,
  NaturalLanguageToSqlResponse,
  AnalysisResult,
  ChartConfiguration,
  DatabaseType
} from '../types';

const router = Router();

// Initialize OpenAI client with better error handling
let openai: OpenAI | null = null;

const initializeOpenAI = () => {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder-key-replace-with-real-key') {
    logger.warn(LLM_MESSAGES.API_KEY_PLACEHOLDER);
    return null;
  }
  
  try {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } catch (error) {
    logger.error('Failed to initialize OpenAI client:', error);
    return null;
  }
};

// Initialize on module load
openai = initializeOpenAI();

// Helper function to ensure OpenAI is available
const ensureOpenAI = (): OpenAI => {
  if (!openai) {
    throw new Error(LLM_MESSAGES.CLIENT_NOT_INITIALIZED);
  }
  return openai;
};

// Common response for missing API key
const respondWithMissingApiKey = (res: Response) => {
  return res.status(500).json({ 
    error: LLM_MESSAGES.API_KEY_NOT_CONFIGURED,
    details: 'The OPENAI_API_KEY environment variable is missing, empty, or set to a placeholder value. You need a real OpenAI API key for AI features.'
  });
};

// Common sanitization and validation workflow
interface SanitizationResult {
  isValid: boolean;
  sanitizedInput: string;
  response?: Response;
}

const sanitizeAndValidateInput = (
  input: string, 
  res: Response, 
  endpoint: string,
  options = { maxLength: 1000, strictMode: true }
): SanitizationResult => {
  const sanitizationResult = sanitizePromptInput(input, options);

  if (!sanitizationResult.isValid) {
    logSecurityEvent('prompt_injection', {
      input,
      riskLevel: sanitizationResult.riskLevel,
      patterns: sanitizationResult.errors,
      endpoint
    });

    return {
      isValid: false,
      sanitizedInput: '',
      response: res.status(400).json({
        error: 'Invalid query input',
        details: 'Query contains potentially unsafe content',
        riskLevel: sanitizationResult.riskLevel
      })
    };
  }

  return {
    isValid: true,
    sanitizedInput: sanitizationResult.sanitizedInput
  };
};

// Common LLM response validation
const validateAndSanitizeResponse = (
  response: string,
  endpoint: string
): string => {
  const responseValidation = validateLLMResponse(response);
  
  if (!responseValidation.isValid) {
    logSecurityEvent('response_validation', {
      response,
      riskLevel: 'medium',
      endpoint
    });
    logger.warn('LLM response validation failed', {
      warnings: responseValidation.warnings,
      response: response.substring(0, 200)
    });
  }

  return responseValidation.sanitizedResponse;
};

// Legacy MySQL-specific SQL validation - no longer used
/* const validateAndCorrectMySQLSyntax = (sql: string): string => {
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
}; */

// Enhanced schema with relationship hints for better SQL generation
const getOptimizedSchema = (schema: DatabaseSchema): string => {
  return schema.tables.map((table) => {
    const columns = (table.columns || []).map((col) => {
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
  connectionType: z.enum(['sqlite'])
});

// Schema for analysis requests
const AnalysisSchema = z.object({
  data: z.array(z.record(z.unknown())),
  query: z.string(),
  context: z.string().optional()
});

// Schema for summarization requests
const SummarizationSchema = z.object({
  query: z.string().min(1)
});

// AI-powered query classification with caching and compression
const classifyQuery = async (query: string, schema: DatabaseSchema): Promise<{
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
      return cached as {
        isVague: boolean;
        queryType: 'specific' | 'exploratory' | 'unclear';
        suggestions?: string[];
        message?: string;
      };
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

    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    const completion = await ensureOpenAI().chat.completions.create({
      model: LLM_MODEL_CONFIG.CLASSIFICATION,
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
    
    if (!openai) {
      return respondWithMissingApiKey(res);
    }

    // Sanitize user input
    const sanitization = sanitizeAndValidateInput(request.query, res, '/api/llm/nl-to-sql');
    if (!sanitization.isValid) return sanitization.response;

    const sanitizedQuery = sanitization.sanitizedInput;

    // Use AI to classify query and handle exploratory requests
    const databaseSchema: DatabaseSchema = {
      tables: request.schema.tables.map(table => ({
        name: table.name,
        type: 'table', // SQLite tables are always type 'table'
        columns: table.columns.map(col => ({
          name: col.name,
          type: col.type,
          nullable: col.nullable ?? true,
          default_value: null,
          primary_key: false
        }))
      }))
    };
    const classification = await classifyQuery(sanitizedQuery, databaseSchema);
    
    if (classification.isVague) {
      return res.json({
        isVague: true,
        message: classification.message,
        suggestions: classification.suggestions,
        originalQuery: sanitizedQuery
      });
    }

    // Check cache first
    const schemaHash = getOptimizedSchema(databaseSchema);
    const cacheKey = llmCache.getCacheKey('sql', sanitizedQuery, `${request.connectionType}-${schemaHash}`);
    const cached = llmCache.get(cacheKey);
    if (cached) {
      logger.info('SQL generation cache hit', { query: sanitizedQuery.substring(0, 50) });
      return res.json(cached);
    }

    // Use safe prompt construction to prevent injection
    const safePrompt = createSafePrompt('nlToSql', sanitizedQuery, schemaHash, request.connectionType);

    const completion = await ensureOpenAI().chat.completions.create({
      model: LLM_MODEL_CONFIG.NL_TO_SQL,
      messages: [
        { role: 'system', content: safePrompt.system },
        { role: 'user', content: safePrompt.user }
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

    // Validate and sanitize LLM response
    generatedSQL = validateAndSanitizeResponse(generatedSQL, '/api/llm/nl-to-sql');

    // Clean up any unwanted formatting
    generatedSQL = generatedSQL
      .replace(/```sql\n?/g, '')  // Remove SQL code block markers
      .replace(/```\n?/g, '')     // Remove any remaining code block markers
      .replace(/^[^\w\s]*/, '')   // Remove any leading non-word characters
      .trim();

    // MySQL-specific SQL validation and correction - removed
    // if (request.connectionType.toLowerCase() === 'mysql') {
    //   generatedSQL = validateAndCorrectMySQLSyntax(generatedSQL);
    // }

    // Validate the generated SQL for security
          const validationResult = validateSQLQuery(generatedSQL);
    if (!validationResult.isValid) {
      logger.warn('LLM generated invalid SQL:', { 
        query: generatedSQL.substring(0, 200), 
        errors: validationResult.error,
        fullQuery: generatedSQL
      });
      return res.status(400).json({ 
        error: 'Generated query failed security validation',
        details: validationResult.error,
        generatedSQL: generatedSQL.substring(0, 200) // Include partial SQL for debugging
      });
    }

    logger.info('NL-to-SQL conversion successful', { 
      naturalLanguage: sanitizedQuery.substring(0, 50),
      sql: generatedSQL.substring(0, 100)
    });

    const result = { 
      sql: generatedSQL,
      explanation: `Generated SQL for: "${sanitizedQuery}"`
    };

    // Cache successful result
    llmCache.set(cacheKey, result, 60 * 60 * 1000); // 1 hour TTL

    return res.json(result);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(res, error);
    }
    return handleGenericError(res, error, 'Failed to generate SQL');
  }
});

// Generate insights from query results
router.post('/analyze', async (req, res) => {
  try {
    const request = AnalysisSchema.parse(req.body);
    
    if (!openai) {
      return respondWithMissingApiKey(res);
    }

    // Sanitize user query input
    const sanitization = sanitizeAndValidateInput(request.query, res, '/api/llm/analyze');
    if (!sanitization.isValid) return sanitization.response;

    const sanitizedQuery = sanitization.sanitizedInput;

    // Check cache first
    const rowCount = request.data.length;
    const columns = request.data.length > 0 ? Object.keys(request.data[0]) : [];
    const cacheKey = llmCache.getCacheKey('analysis', sanitizedQuery, `${rowCount}-${columns.join(',')}`);
    const cached = llmCache.get(cacheKey);
    if (cached) {
      logger.info('Analysis cache hit', { query: sanitizedQuery.substring(0, 50) });
      return res.json(cached);
    }

    // Data summary - reduce tokens by 50%
    const sampleValues = columns.reduce((acc, col) => {
      acc[col] = [...new Set(request.data.slice(0, 3).map(row => row[col]))];
      return acc;
    }, {} as Record<string, unknown[]>);

    // Sanitize data information to prevent context injection
    const dataInfo = `Results: ${rowCount} rows, ${columns.length} columns. Columns: ${columns.join(', ')}. Sample values: ${JSON.stringify(sampleValues)}`;
    const dataSanitization = sanitizePromptInput(dataInfo, {
      maxLength: 2000,
      strictMode: false // Less strict for data context
    });

    if (!dataSanitization.isValid && dataSanitization.riskLevel === 'high') {
      logSecurityEvent('suspicious_input', {
        input: dataInfo,
        riskLevel: dataSanitization.riskLevel,
        patterns: dataSanitization.errors,
        endpoint: '/api/llm/analyze'
      });

      return res.status(400).json({
        error: 'Data contains potentially unsafe content',
        details: 'Query results contain suspicious patterns'
      });
    }

    // Use safe prompt construction
    const safePrompt = createSafePrompt('analysis', sanitizedQuery, dataSanitization.sanitizedInput);

    const completion = await ensureOpenAI().chat.completions.create({
      model: LLM_MODEL_CONFIG.ANALYSIS,
      messages: [
        { role: 'system', content: safePrompt.system },
        { role: 'user', content: safePrompt.user }
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

    // Validate and sanitize LLM response
    const sanitizedAnalysis = validateAndSanitizeResponse(analysis, '/api/llm/analyze');

    logger.info('Data analysis generated successfully');

    const result = { 
      analysis: sanitizedAnalysis,
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
    if (error instanceof z.ZodError) {
      return handleZodError(res, error);
    }
    return handleGenericError(res, error, 'Failed to generate analysis');
  }
});

// Generate concise title for natural language query
router.post('/summarize', async (req, res) => {
  try {
    const request = SummarizationSchema.parse(req.body);
    
    if (!openai) {
      return respondWithMissingApiKey(res);
    }

    // Sanitize user input
    const sanitization = sanitizeAndValidateInput(request.query, res, '/api/llm/summarize', {
      maxLength: 500,
      strictMode: true
    });
    if (!sanitization.isValid) return sanitization.response;

    const sanitizedQuery = sanitization.sanitizedInput;

    // Check cache first
    const cacheKey = llmCache.getCacheKey('summary', sanitizedQuery);
    const cached = llmCache.get(cacheKey);
    if (cached) {
      logger.info('Summarization cache hit', { query: sanitizedQuery.substring(0, 50) });
      return res.json(cached);
    }

    // Use safe prompt construction
    const safePrompt = createSafePrompt('summarization', sanitizedQuery);

    const completion = await ensureOpenAI().chat.completions.create({
      model: LLM_MODEL_CONFIG.SUMMARIZATION,
      messages: [
        { role: 'system', content: safePrompt.system },
        { role: 'user', content: safePrompt.user }
      ],
      temperature: 0.0, // Deterministic for caching
      max_tokens: 15
    });

    const title = completion.choices[0]?.message?.content?.trim();
    
    if (!title) {
      // Fallback to truncation if fails
      const fallbackTitle = sanitizedQuery.length > 50 
        ? sanitizedQuery.substring(0, 47).trim() + '...'
        : sanitizedQuery;
      
      return res.json({ 
        title: fallbackTitle,
        source: 'fallback'
      });
    }

    // Validate and sanitize LLM response
    const sanitizedTitle = validateAndSanitizeResponse(title, '/api/llm/summarize');

    logger.info('Query summarization successful', { 
      originalQuery: sanitizedQuery.substring(0, 50),
      generatedTitle: sanitizedTitle
    });

    const result = { 
      title: sanitizedTitle,
      source: 'ai'
    };

    // Cache successful result
    llmCache.set(cacheKey, result, 2 * 60 * 60 * 1000); // 2 hours TTL

    return res.json(result);

  } catch (error) {
    logger.error('Query summarization failed:', error);
    
    // Fallback to truncation on any error
    const requestBody = req.body;
    let fallbackQuery = requestBody.query || 'Untitled Query';
    
    // Sanitize even the fallback
    const fallbackSanitization = sanitizePromptInput(fallbackQuery, { strictMode: false });
    fallbackQuery = fallbackSanitization.sanitizedInput || 'Untitled Query';
    
    const fallbackTitle = fallbackQuery.length > 50 
      ? fallbackQuery.substring(0, 47).trim() + '...'
      : fallbackQuery;
    
    return res.json({ 
      title: fallbackTitle,
      source: 'fallback'
    });
  }
});

// Health check for LLM service
router.get('/health', async (req, res) => {
  try {
    const hasApiKey = !!openai;
    const isPlaceholder = process.env.OPENAI_API_KEY === 'sk-placeholder-key-replace-with-real-key';
    
    return res.json({
      status: hasApiKey ? 'OK' : isPlaceholder ? 'Placeholder API key detected' : 'No API key configured',
      hasApiKey,
      isPlaceholder,
      model: 'gpt-4',
      message: hasApiKey ? LLM_MESSAGES.API_READY : LLM_MESSAGES.CONFIGURE_API_KEY
    });
  } catch (error) {
    logger.error('LLM health check failed:', error);
    return res.status(500).json({ error: 'Health check failed' });
  }
});

export { router as llmRouter }; 