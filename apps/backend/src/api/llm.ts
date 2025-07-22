import { Router } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { validateQuery } from '../security/sanitize';

const router = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  connectionType: z.enum(['postgresql', 'sqlite'])
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

// Convert natural language to SQL
router.post('/nl-to-sql', async (req, res) => {
  try {
    const request = NLQuerySchema.parse(req.body);
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    // Build schema context for the LLM
    const schemaContext = request.schema.tables.map(table => {
      const columns = table.columns.map(col => 
        `${col.name} (${col.type}${col.nullable ? ', nullable' : ''})`
      ).join(', ');
      return `Table: ${table.name}\nColumns: ${columns}`;
    }).join('\n\n');

    const systemPrompt = `You are a SQL expert. Convert natural language queries to ${request.connectionType.toUpperCase()} SQL.

CRITICAL RULES:
- Generate EXACTLY ONE SQL statement only
- Never create multiple statements separated by semicolons
- Only generate SELECT, EXPLAIN, or DESCRIBE statements
- Never generate INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, or any DDL/DML
- Use proper ${request.connectionType} syntax
- Return only the SQL query, no explanations or comments
- Use table and column names exactly as provided
- Include appropriate JOINs when querying multiple tables
- Add LIMIT clauses for potentially large result sets

FOR COMPARISON QUERIES (best/worst, top/bottom, etc.):
- Use window functions, subqueries, or UNION to show multiple results in one statement
- Use ORDER BY to show ranges (e.g., ORDER BY value DESC to show best first)
- Use CASE statements to categorize results
- Example: For "best and worst products" use ORDER BY with sufficient LIMIT to show both ends

Database Schema:
${schemaContext}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.query }
      ],
      temperature: 0.1,
      max_tokens: 500
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
      naturalLanguage: request.query,
      sql: generatedSQL 
    });

    res.json({ 
      sql: generatedSQL,
      explanation: `Generated SQL for: "${request.query}"`
    });

  } catch (error) {
    logger.error('NL-to-SQL conversion failed:', error);
    res.status(500).json({ 
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

    // Prepare data summary for analysis
    const dataPreview = request.data.slice(0, 10); // Limit data sent to LLM
    const rowCount = request.data.length;
    const columns = request.data.length > 0 ? Object.keys(request.data[0]) : [];

    const systemPrompt = `You are a data analyst. Analyze the provided query results and generate insights.

Provide:
1. A brief summary of what the data shows
2. Key insights and patterns
3. Notable observations
4. Suggested follow-up questions

Keep responses concise and actionable. Focus on business-relevant insights.`;

    const userPrompt = `Query: ${request.query}
${request.context ? `Context: ${request.context}` : ''}

Results: ${rowCount} rows, ${columns.length} columns
Columns: ${columns.join(', ')}

Sample data:
${JSON.stringify(dataPreview, null, 2)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    const analysis = completion.choices[0]?.message?.content;
    
    if (!analysis) {
      return res.status(500).json({ 
        error: 'Failed to generate analysis' 
      });
    }

    logger.info('Data analysis generated successfully');

    res.json({ 
      analysis,
      metadata: {
        rowCount,
        columns,
        sampleSize: dataPreview.length
      }
    });

  } catch (error) {
    logger.error('Data analysis failed:', error);
    res.status(500).json({ 
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

    // Detect if this is a SQL query or natural language
    const isSqlQuery = /^\s*(SELECT|WITH|EXPLAIN|DESCRIBE)\s+/i.test(request.query.trim())

    let systemPrompt = ''
    let userPrompt = ''

    if (isSqlQuery) {
      // Handle SQL queries - infer intent from the SQL
      systemPrompt = `You are a helpful assistant that creates concise, descriptive titles for SQL queries by inferring their business intent.

Generate a short, clear title (maximum 50 characters) that describes what the SQL query does in business terms.

Rules:
- Focus on the business purpose, not the technical implementation
- Use business/data terminology 
- Keep it under 50 characters
- No quotes or special characters
- Make it searchable and memorable
- Avoid saying "SQL Query" in the title

Examples:
- "SELECT COUNT(*) FROM orders" → "Total Order Count"
- "SELECT * FROM customers WHERE created_date > '2023-01-01'" → "Recent Customer List"
- "SELECT product_name, SUM(quantity) FROM orders GROUP BY product_name" → "Product Sales Summary"`;

      userPrompt = `Create a business-focused title for this SQL query:\n\n${request.query}`;
    } else {
      // Handle natural language queries
      systemPrompt = `You are a helpful assistant that creates concise, descriptive titles for data queries.

Generate a short, clear title (maximum 50 characters) that captures the essence of the user's query.

Rules:
- Be specific and descriptive
- Use business/data terminology
- Keep it under 50 characters
- No quotes or special characters
- Make it searchable and memorable

Examples:
- "What are the top selling products?" → "Top Selling Products"
- "Show me customer acquisition by month for 2023" → "Monthly Customer Acquisition 2023"
- "Which regions have the lowest revenue?" → "Lowest Revenue by Region"`;

      userPrompt = `Create a title for this query: "${request.query}"`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 20
    });

    const title = completion.choices[0]?.message?.content?.trim();
    
    if (!title) {
      // Fallback to truncation if AI fails
      const fallbackTitle = request.query.length > 50 
        ? request.query.substring(0, 47).trim() + '...'
        : request.query;
      
      return res.json({ 
        title: fallbackTitle,
        source: 'fallback'
      });
    }

    logger.info('Query summarization successful', { 
      originalQuery: request.query,
      generatedTitle: title,
      queryType: isSqlQuery ? 'sql' : 'natural_language'
    });

    res.json({ 
      title: title,
      source: 'ai'
    });

  } catch (error) {
    logger.error('Query summarization failed:', error);
    
    // Fallback to truncation on any error
    const request = req.body;
    const fallbackTitle = request.query && request.query.length > 50 
      ? request.query.substring(0, 47).trim() + '...'
      : request.query || 'Untitled Query';
    
    res.json({ 
      title: fallbackTitle,
      source: 'fallback'
    });
  }
});

// Health check for LLM service
router.get('/health', async (req, res) => {
  try {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    res.json({
      status: hasApiKey ? 'OK' : 'No API key configured',
      hasApiKey,
      model: 'gpt-4'
    });
  } catch (error) {
    logger.error('LLM health check failed:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

export { router as llmRouter }; 