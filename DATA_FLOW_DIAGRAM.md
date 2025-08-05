# DataAsk Data Flow Diagram

## Key Data Flows

### 1. Natural Language Query Flow
```
User Input (Natural Language)
    │
    ▼
ChatPanel Component
    │
    ├─► API Call: POST /api/llm/natural-language-to-sql
    │       │
    │       ├─► OpenAI API (GPT Model)
    │       │       │
    │       │       └─► SQL Query Generation
    │       │
    │       └─► Response: { sql, explanation, tables_used }
    │
    ├─► API Call: POST /api/db/query
    │       │
    │       ├─► DatabaseManager.executeQuery()
    │       │       │
    │       │       └─► SQLite Database
    │       │
    │       └─► Response: { data, fields, rowCount }
    │
    └─► Update UI State
            │
            ├─► Display SQL in ChatPanel
            ├─► Show Results in AnalysisPanel
            └─► Generate Visualizations
```

### 2. File Import Flow
```
File Selection (CSV/Excel/SQLite)
    │
    ▼
FileImportModal Component
    │
    ├─► File Upload: POST /api/files/upload
    │       │
    │       ├─► Multer Processing
    │       ├─► File Validation
    │       └─► Temporary Storage
    │
    ├─► Schema Detection: POST /api/files/detect-schema
    │       │
    │       ├─► Parse File (CSV/Excel)
    │       ├─► Analyze Column Types
    │       └─► Return Schema Preview
    │
    ├─► User Configuration
    │       │
    │       └─► Modify Column Names/Types
    │
    └─► Import Data: POST /api/files/import
            │
            ├─► Create SQLite Table
            ├─► Import Data Rows
            ├─► Create Connection Entry
            └─► Return Connection ID
```

### 3. Database Connection Flow
```
Connection Request
    │
    ▼
ConnectionModal Component
    │
    ├─► Test Connection: POST /api/db/test-connection
    │       │
    │       └─► Validate SQLite File
    │
    └─► Create Connection: POST /api/db/connections
            │
            ├─► DatabaseManager.createConnection()
            ├─► Store in connections.json
            └─► Return Connection ID
```

### 4. Schema Browsing Flow
```
Select Connection
    │
    ▼
SchemaBrowser Component
    │
    └─► Get Schema: GET /api/db/connections/{id}/schema
            │
            ├─► DatabaseManager.getSchema()
            ├─► Query sqlite_master
            ├─► Get Table Columns (PRAGMA table_info)
            └─► Return Schema Tree
```

### 5. Query Execution Flow
```
SQL Query (Manual or AI-Generated)
    │
    ▼
Execute Query Request
    │
    └─► POST /api/db/query
            │
            ├─► Validate SQL Query
            ├─► Check Query Limits
            ├─► Execute on SQLite
            ├─► Format Results
            └─► Return QueryResult
```

## State Management Flow

### Frontend State
```
DataAskApp (Root Component)
    │
    ├─► selectedConnection (current database)
    ├─► connections[] (all connections)
    ├─► queryResults (latest results)
    └─► currentQuery (active SQL)
            │
            ├─► SchemaBrowser
            │     └─► Display tables/columns
            │
            ├─► ChatPanel
            │     ├─► Message history
            │     └─► Query input
            │
            └─► AnalysisPanel
                  ├─► Results table
                  └─► Visualizations
```

### Backend State
```
DatabaseManager (Singleton)
    │
    ├─► connections Map<id, SQLiteConnection>
    ├─► connectionConfigs (from connections.json)
    └─► Active SQLite Instances
```

## API Endpoints Summary

### Database Operations
- `POST /api/db/test-connection` - Validate connection
- `POST /api/db/connections` - Create new connection
- `GET /api/db/connections` - List all connections
- `GET /api/db/connections/:id/schema` - Get database schema
- `POST /api/db/query` - Execute SQL query
- `DELETE /api/db/connections/:id` - Remove connection

### LLM Operations
- `POST /api/llm/natural-language-to-sql` - Convert NL to SQL
- `POST /api/llm/analyze` - Analyze query results
- `POST /api/llm/summarize` - Summarize text
- `GET /api/llm/health` - Check OpenAI API status

### File Operations
- `POST /api/files/upload` - Upload file
- `POST /api/files/detect-schema` - Analyze file schema
- `POST /api/files/import` - Import file to database
- `GET /api/files/import-progress/:id` - Check import status

### Authentication (Currently Disabled)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user info

## Data Storage

### Frontend (Browser)
- **LocalStorage**:
  - `dataask_connections` - Connection configs
  - `dataask_history_{connectionId}` - Query history per connection
  - `leftPanelWidth`, `rightPanelWidth` - UI preferences

### Backend (File System)
- **JSON Files**:
  - `data/connections.json` - All connection configurations
  - `data/auth.json` - User authentication data
  
- **SQLite Files**:
  - `data/*.sqlite` - Imported data files
  - User-specified paths for external SQLite databases

- **Temporary Files**:
  - `uploads/` - Temporary file uploads during import

## Security Layers

### Input Validation
```
User Input
    │
    ├─► Zod Schema Validation
    ├─► SQL Query Validation
    ├─► Prompt Injection Detection
    └─► File Type Validation
```

### API Protection
```
API Request
    │
    ├─► CORS Policy
    ├─► Rate Limiting
    ├─► Helmet Security Headers
    └─► Authentication (when enabled)
```

## Performance Considerations

### Bottlenecks
1. **Large File Imports**: Synchronous processing blocks event loop
2. **Query Results**: No pagination for large result sets
3. **Schema Loading**: Loads all tables/columns at once
4. **Chat History**: Stored entirely in localStorage

### Optimization Opportunities
1. **Streaming**: Stream large file imports
2. **Pagination**: Implement result set pagination
3. **Lazy Loading**: Load schema on demand
4. **IndexedDB**: Use for larger local storage needs