// Database Types
export interface DatabaseField {
  name: string;
  type: string;
}

// Enhanced Variable Properties for Statistical Analysis
export interface VariableProperties extends DatabaseField {
  // Measurement level (critical for statistical analysis)
  measurement_level?: 'nominal' | 'ordinal' | 'interval' | 'ratio';

  // Statistical properties
  statistics?: {
    count: number;
    missing_count: number;
    completeness: number; // % non-null

    // Central tendency (for numeric)
    mean?: number;
    median?: number;
    mode?: string | number;

    // Dispersion (for numeric)
    std_dev?: number;
    variance?: number;
    range?: { min: number; max: number };
    quartiles?: { q1: number; q2: number; q3: number };

    // Shape (for numeric)
    skewness?: number;
    kurtosis?: number;

    // Distribution info
    distribution_type?: 'normal' | 'skewed_left' | 'skewed_right' | 'uniform' | 'bimodal' | 'multimodal';

    // Outlier detection
    outlier_count?: number;
    outlier_method?: 'iqr' | 'zscore' | 'isolation_forest';
  };

  // Data quality metrics
  quality_score?: number; // 0-100
  uniqueness_ratio?: number; // % unique values

  // Relationship properties
  relationships?: {
    correlations?: Array<{ variable: string; coefficient: number; p_value?: number }>;
    multicollinearity_risk?: 'low' | 'medium' | 'high';
    dependencies?: string[]; // Variables this depends on
  };

  // Domain context
  domain_info?: {
    business_meaning?: string;
    unit_of_measure?: string;
    expected_range?: { min?: number; max?: number };
    common_values?: Array<{ value: string | number; frequency: number }>;
  };

  // Analysis recommendations
  recommendations?: {
    suggested_transformations?: Array<'log' | 'sqrt' | 'box_cox' | 'standardize' | 'normalize'>;
    statistical_tests?: Array<'t_test' | 'anova' | 'chi_square' | 'correlation' | 'regression'>;
    visualization_types?: ChartType[];
  };
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: DatabaseField[];
  rowCount: number;
  executionTime: number;
  variable_properties?: VariableProperties[]; // Optional enhanced analysis
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
export type DatabaseType = 'sqlite';

export interface Connection {
  id: string;
  name: string;
  type: string;
  config?: ConnectionConfig;
}

export interface ConnectionConfig {
  filename?: string;
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
  success?: boolean;
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
  connections: Connection[];
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

  // Enhanced statistical analysis (optional)
  statistical_analysis?: {
    descriptive_stats: Record<string, VariableProperties['statistics']>;
    inferential_stats?: {
      correlations: Array<{
        variable1: string;
        variable2: string;
        coefficient: number;
        p_value: number;
        significance: 'significant' | 'not_significant';
      }>;
      hypothesis_tests?: Array<{
        test_type: string;
        variables: string[];
        statistic: number;
        p_value: number;
        conclusion: string;
      }>;
    };
    predictive_insights?: {
      variable_importance?: Array<{ variable: string; importance: number }>;
      recommended_models?: Array<'linear_regression' | 'logistic_regression' | 'random_forest' | 'time_series'>;
      confidence_intervals?: Record<string, { lower: number; upper: number }>;
    };
  };
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

export interface CreateConnectionData {
  name: string;
  type: DatabaseType;
  config: ConnectionConfig;
}

export interface UpdateConnectionData {
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

// Chat and History Types
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  sql?: string;
  timestamp: Date;
  error?: string;
}

export interface QueryHistoryItem {
  id: string;
  title: string;
  query: string;
  timestamp: Date;
  rowCount?: number;
  executionTime?: number;
}

// UI State Types
export interface AppState {
  selectedConnectionId?: string;
  leftPanelWidth: number;
  rightPanelWidth: number;
  expandedTables: string[];
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

// Copy Service Types
export interface CopyResult {
  success: boolean;
  message: string;
}

// Chart Types
export type ChartType = 'bar' | 'line' | 'pie' | 'kpi';

export interface ChartDataPoint {
  [key: string]: string | number | Date;
}

export interface SeriesVisibility {
  [key: string]: boolean;
}

// Import Progress Types
export interface ImportProgress {
  importId: string;
  status: 'parsing' | 'importing' | 'completed' | 'error';
  progress: number;
  totalRows?: number;
  processedRows?: number;
  message: string;
  error?: string;
}