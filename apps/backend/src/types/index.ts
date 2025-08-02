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

// Connection Types
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite';

export interface ConnectionConfig {
  id?: string;
  name: string;
  type: DatabaseType;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  filename?: string;
  // SSL Configuration
  sslEnabled?: boolean;
  sslMode?: 'require' | 'prefer' | 'allow' | 'disable';
  sslCa?: string;
  sslCert?: string;
  sslKey?: string;
  sslRejectUnauthorized?: boolean;
  // Connection Timeouts
  connectionTimeout?: number;
  queryTimeout?: number;
  // SSH Tunnel Configuration
  sshEnabled?: boolean;
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  sshPassword?: string;
  sshPrivateKey?: string;
  sshPassphrase?: string;
  // File Import Configuration
  originalFilename?: string;
  fileSize?: number;
  uploadedAt?: string;
  rowCount?: number;
}

export interface SavedConnection {
  id: string;
  name: string;
  type: DatabaseType;
  config: ConnectionConfig;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  guidance?: string[];
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  error?: string;
  guidance?: string[];
}

export interface CreateConnectionResponse {
  connectionId?: string;
  message?: string;
  error?: string;
}

export interface SchemaResponse {
  schema?: DatabaseSchema;
  error?: string;
}

export interface QueryResponse {
  data?: Record<string, unknown>[];
  rowCount?: number;
  fields?: DatabaseField[];
  executionTime?: number;
  error?: string;
}

export interface ConnectionListResponse {
  connections: SavedConnection[];
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
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  email_verified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user?: User;
  message?: string;
  error?: string;
}

// User Connection Types
export interface UserConnection {
  id: string;
  user_id: string;
  name: string;
  type: DatabaseType;
  encrypted_config: string;
  created_at: string;
  updated_at: string;
  last_used?: string;
}

export interface CreateUserConnectionRequest {
  name: string;
  type: DatabaseType;
  config: ConnectionConfig;
}

export interface UpdateUserConnectionRequest {
  name?: string;
  config?: ConnectionConfig;
}

export interface MigrateConnectionsRequest {
  connections: ConnectionConfig[];
}

export interface MigrateConnectionsResponse {
  migrated: number;
  failed: number;
  errors?: string[];
}

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

// SSH Tunnel Types
export interface SSHTunnelConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

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