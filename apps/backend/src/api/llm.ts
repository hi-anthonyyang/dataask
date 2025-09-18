import { Router, Request, Response } from 'express';
import { z } from 'zod';
// import OpenAI from 'openai'; // Removed for security
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

// Initialize AI client with better error handling
let openai: any = null;

const initializeAI = () => {
  // API key removed for security
  logger.warn('AI API key not configured');
  return null;
};

// Initialize on module load
openai = initializeAI();

// Helper function to ensure AI client is available
const ensureAI = (): any => {
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
  })
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

    const completion = await ensureAI().chat.completions.create({
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

// Convert natural language to pandas code
router.post('/nl-to-pandas', async (req, res) => {
  try {
    const request = z.object({
      query: z.string().min(1),
      dataframeInfo: z.object({
        columns: z.array(z.string()),
        dtypes: z.record(z.string()),
        shape: z.tuple([z.number(), z.number()])
      })
    }).parse(req.body);
    
    if (!openai) {
      return respondWithMissingApiKey(res);
    }

    // Sanitize user input
    const sanitization = sanitizeAndValidateInput(request.query, res, '/api/llm/nl-to-pandas');
    if (!sanitization.isValid) return sanitization.response;

    const sanitizedQuery = sanitization.sanitizedInput;

    // Check cache first
    const schemaHash = JSON.stringify(request.dataframeInfo);
    const cacheKey = llmCache.getCacheKey('pandas', sanitizedQuery, schemaHash);
    const cached = llmCache.get(cacheKey);
    if (cached) {
      logger.info('Pandas code generation cache hit', { query: sanitizedQuery.substring(0, 50) });
      return res.json(cached);
    }

    // Create pandas code generation prompt
    const systemPrompt = `You are a pandas code generator. Generate pandas code to answer user queries about their DataFrame.

DataFrame Info:
- Columns: ${request.dataframeInfo.columns.join(', ')}
- Data types: ${JSON.stringify(request.dataframeInfo.dtypes, null, 2)}
- Shape: ${request.dataframeInfo.shape[0]} rows, ${request.dataframeInfo.shape[1]} columns

Rules:
1. Generate ONLY pandas code, no explanations
2. Use 'df' as the DataFrame variable name
3. Return results that can be displayed as a table
4. For aggregations, ensure the result is a DataFrame, not a Series
5. Use simple, readable pandas operations
6. Avoid complex operations that might fail
7. For visualizations, return the data to visualize, not matplotlib code
8. Write code on single lines when possible
9. Use proper pandas syntax without line breaks in variable names
10. Always use .reset_index() after groupby operations

Examples:
- "show first 5 rows" -> df.head()
- "average sales by category" -> df.groupby(['category'])['sales'].mean().reset_index()
- "count of products" -> df['product'].value_counts().reset_index()
- "filter where price > 100" -> df[df['price'] > 100]
- "percentage of each category" -> (df['category'].value_counts(normalize=True) * 100).reset_index()
- "correlation between price and sales" -> df[['price', 'sales']].corr().reset_index()
- "median price" -> df['price'].median()
- "variance in sales" -> df['sales'].var()
- "skewness of revenue" -> df['revenue'].skew()
- "covariance matrix" -> df[['price', 'sales', 'profit']].cov().reset_index()
- "distribution shape of data" -> df['column'].kurt()
- "most common value" -> df['category'].mode()
- "test if sales mean equals 100" -> stats.ttest_1samp(df['sales'], 100)
- "compare group A vs B performance" -> stats.ttest_ind(df[df['group']=='A']['score'], df[df['group']=='B']['score'])
- "test if data is normally distributed" -> stats.normaltest(df['values'])
- "predict sales based on marketing spend" -> stats.linregress(df['marketing'], df['sales'])
- "analyze trend in monthly revenue" -> stats.trend_analysis(df['revenue'])
- "forecast next 6 months" -> stats.forecast(df['sales'], periods=6)`;

    const completion = await ensureAI().chat.completions.create({
      model: LLM_MODEL_CONFIG.NL_TO_SQL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: sanitizedQuery }
      ],
      temperature: 0.1,
      max_tokens: 300
    });

    let generatedCode = completion.choices[0]?.message?.content?.trim();
    
    if (!generatedCode) {
      return res.status(500).json({ 
        error: 'Failed to generate pandas code' 
      });
    }

    // Clean up any unwanted formatting
    generatedCode = generatedCode
      .replace(/```python\n?/g, '')  // Remove Python code block markers
      .replace(/```\n?/g, '')        // Remove any remaining code block markers
      .replace(/^[^\w\s]*/, '')      // Remove any leading non-word characters
      .replace(/\n\s*/g, ' ')        // Replace newlines with spaces
      .replace(/\s+/g, ' ')          // Normalize whitespace
      .trim();

    // Basic validation - ensure it starts with 'df'
    if (!generatedCode.includes('df')) {
      logger.warn('Generated code does not reference DataFrame');
      generatedCode = 'df.head()'; // Fallback to safe operation
    }

    logger.info('NL-to-pandas conversion successful', { 
      naturalLanguage: sanitizedQuery.substring(0, 50),
      code: generatedCode.substring(0, 100)
    });

    const result = { 
      code: generatedCode,
      explanation: `Generated pandas code for: "${sanitizedQuery}"`
    };

    // Cache successful result
    llmCache.set(cacheKey, result, 60 * 60 * 1000); // 1 hour TTL

    return res.json(result);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(res, error);
    }
    return handleGenericError(res, error, 'Failed to generate pandas code');
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

    const completion = await ensureAI().chat.completions.create({
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

    const completion = await ensureAI().chat.completions.create({
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