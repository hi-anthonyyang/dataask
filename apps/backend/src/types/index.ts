// Database Types
export interface DatabaseField {
  name: string;
  type: string;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: DatabaseField[];
  rowCount: number;
  executionTime: number;
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  default_value: string | null;
  primary_key: boolean;
}

export interface TableInfo {
  name: string;
  type: string;
  columns?: TableColumn[];
}

export interface TableMetadata {
  row_count: number;
  table_size: string;
  columns: TableColumn[];
}

export interface DatabaseSchema {
  tables: TableInfo[];
}



// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  guidance?: string[];
}



export interface TablePreviewResponse {
  data: Record<string, unknown>[];
  totalRows: number;
}

// File Import Types
export interface FileImportColumn {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'DATE';
  nullable: boolean;
}

export interface FileImportConfig {
  tableName: string;
  columns: FileImportColumn[];
}

export interface FileImportProgress {
  status: 'parsing' | 'importing' | 'completed' | 'error';
  progress: number;
  totalRows?: number;
  processedRows?: number;
  message: string;
  error?: string;
}

export interface FileImportResponse {
  connectionId?: string;
  tableName?: string;
  rowCount?: number;
  error?: string;
  importId?: string;
}

// LLM Types
export interface ClassificationResult {
  classification: 'exploratory' | 'specific';
  confidence: number;
  reasoning: string;
}

export interface NaturalLanguageToSqlResponse {
  sql: string;
  explanation: string;
  classification: ClassificationResult;
  tables_used: string[];
  warnings?: string[];
}

export interface AnalysisResult {
  insights: string;
  summary: string;
  key_findings: string[];
  recommendations?: string[];
  chart_config?: ChartConfiguration;
}

export interface ChartConfiguration {
  type: 'bar' | 'line' | 'pie' | 'kpi';
  data: Record<string, unknown>[];
  config: {
    xAxis?: string;
    yAxis?: string | string[];
    title?: string;
    colors?: string[];
  };
}

// User and Authentication Types


// Error Types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
  validationErrors?: ValidationError[];
}

// Utility Types
export type ColumnType = 'TEXT' | 'INTEGER' | 'REAL' | 'DATE' | 'BOOLEAN' | 'JSON';

export interface ImportProgress {
  importId: string;
  status: 'parsing' | 'importing' | 'completed' | 'error';
  progress: number;
  totalRows?: number;
  processedRows?: number;
  message: string;
  error?: string;
}

// SSH Tunnel Types - removed (no longer supported)

// Rate Limit Types
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

// Health Check Types
export interface HealthCheckResponse {
  status: 'OK' | 'ERROR';
  timestamp: string;
  environment: string;
  rateLimits?: {
    ai: string;
    database: string;
    general: string;
  };
  database?: {
    connected: boolean;
    error?: string;
  };
}