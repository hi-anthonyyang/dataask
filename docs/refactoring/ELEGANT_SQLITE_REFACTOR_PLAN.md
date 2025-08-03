# Elegant SQLite + Data Import Refactoring Plan

## Executive Summary

After analyzing RStudio's approach and modern data handling patterns (Arrow, DuckDB, Parquet), we'll create a clean, performant architecture that treats data import as a first-class citizen. Instead of forcing file imports into a "connection" paradigm, we'll build a unified **Data Source** architecture that elegantly handles both SQLite databases and imported files.

## Core Design Principles

1. **Data Sources, Not Connections**: Files and databases are fundamentally different - let's treat them that way
2. **Performance First**: Use modern formats (Parquet) and lazy evaluation where possible
3. **Simplicity**: One clear path for data access, whether from SQLite or imported files
4. **Future-Proof**: Build on standards (Arrow, Parquet) that scale with data size

## Architecture Overview

### The Data Source Abstraction

```typescript
interface DataSource {
  id: string
  name: string
  type: 'sqlite' | 'parquet' | 'live-import'
  metadata: {
    path: string
    size: number
    created: Date
    lastAccessed: Date
    tableCount?: number
    rowCount?: number
  }
  status: 'ready' | 'importing' | 'error'
}
```

### Three-Tier Data Architecture

1. **Persistent Layer**: SQLite databases (`.db` files)
2. **Optimized Layer**: Parquet files for imported data
3. **Ephemeral Layer**: In-memory Arrow tables for active analysis

## Implementation Plan

### Phase 1: New Data Source Architecture (Week 1)

#### 1.1 Create Unified Data Source Manager
**Location**: `apps/backend/src/services/dataSourceManager.ts` (NEW)

```typescript
class DataSourceManager {
  // Core methods
  async registerSQLite(path: string): Promise<DataSource>
  async importFile(file: File, options: ImportOptions): Promise<DataSource>
  async listSources(): Promise<DataSource[]>
  async getSource(id: string): Promise<DataSource>
  async deleteSource(id: string): Promise<void>
  
  // Query methods (delegated to appropriate engine)
  async query(sourceId: string, sql: string): Promise<QueryResult>
  async getSchema(sourceId: string): Promise<Schema>
}
```

#### 1.2 Implement Smart File Import Pipeline
**Location**: `apps/backend/src/services/importPipeline.ts` (NEW)

```typescript
class ImportPipeline {
  // CSV/Excel → Parquet conversion with progress tracking
  async import(file: File): Promise<string> {
    // 1. Stream parse the file
    // 2. Infer schema intelligently
    // 3. Convert to Parquet format
    // 4. Store in data directory
    // 5. Register with DataSourceManager
  }
}
```

#### 1.3 Storage Strategy
```
data/
├── sources.json          # Metadata for all data sources
├── sqlite/              # SQLite database files
│   └── *.db
└── imports/             # Imported data as Parquet
    └── {id}/
        ├── metadata.json
        └── data.parquet
```

### Phase 2: Modern Import Experience (Week 1-2)

#### 2.1 Smart Schema Detection
- Use Arrow's schema inference
- Allow user to override types
- Preview data before committing import
- Support for large files via streaming

#### 2.2 Import Options
```typescript
interface ImportOptions {
  name?: string
  format?: 'csv' | 'excel' | 'json'
  schema?: SchemaOverride
  chunkSize?: number  // For large file handling
  compression?: 'snappy' | 'gzip' | 'none'
}
```

#### 2.3 Progress Tracking
- Real-time progress via WebSocket/SSE
- Estimated time remaining
- Ability to cancel long-running imports
- Background import support

### Phase 3: Query Engine Integration (Week 2)

#### 3.1 Unified Query Interface
```typescript
// Same interface whether querying SQLite or Parquet
const result = await dataSourceManager.query(sourceId, `
  SELECT * FROM sales 
  WHERE year = 2023 
  LIMIT 1000
`)
```

#### 3.2 Performance Optimizations
- Use DuckDB for Parquet queries (blazing fast)
- Lazy evaluation where possible
- Automatic query optimization
- Result streaming for large datasets

#### 3.3 Cross-Source Queries (Future Enhancement)
```sql
-- Query across multiple data sources
SELECT s.*, c.customer_name
FROM sqlite_source.sales s
JOIN parquet_source.customers c ON s.customer_id = c.id
```

### Phase 4: Frontend Transformation (Week 2-3)

#### 4.1 New Data Sources Panel
**Rename**: `SchemaBrowser` → `DataSourcesPanel`

Features:
- Unified list of all data sources
- Visual distinction between types (icons)
- Search and filter capabilities
- Bulk operations support

#### 4.2 Elegant Import Flow
1. **Drag & Drop** or click to select files
2. **Smart Preview** with schema detection
3. **One-Click Import** with progress
4. **Immediate Availability** for querying

#### 4.3 Modern UI Components
```tsx
// Clean, modern import dialog
<ImportDialog>
  <FileDropZone accept=".csv,.xlsx,.parquet,.db" />
  <SchemaPreview editable={true} />
  <ImportProgress streaming={true} />
</ImportDialog>

// Unified data source browser
<DataSourcesPanel>
  <SearchBar placeholder="Search sources..." />
  <SourceList>
    <SourceItem icon="database" status="ready" />
    <SourceItem icon="file" status="importing" progress={45} />
  </SourceList>
</DataSourcesPanel>
```

### Phase 5: Performance & Polish (Week 3)

#### 5.1 Caching Strategy
- LRU cache for frequently accessed Parquet files
- Query result caching
- Schema caching
- Automatic cache invalidation

#### 5.2 Advanced Features
- **Auto-refresh**: Watch file system for changes
- **Versioning**: Keep history of imported files
- **Sharing**: Export/import data source configurations
- **Templates**: Save import configurations for reuse

#### 5.3 Error Handling & Recovery
- Graceful handling of corrupt files
- Resume interrupted imports
- Clear error messages with solutions
- Automatic cleanup of failed imports

## Technical Decisions

### Why Parquet for Imports?
1. **Compression**: 50-80% smaller than CSV
2. **Performance**: 10-100x faster queries
3. **Type Safety**: Schema embedded in file
4. **Compatibility**: Works with Arrow, DuckDB, and more

### Why Keep SQLite?
1. **Portability**: Single file databases
2. **No Setup**: Works everywhere
3. **SQL Standard**: Familiar query language
4. **Reliability**: Battle-tested for decades

### Why This Architecture?
1. **Clean Separation**: Data sources aren't forced to be "connections"
2. **Performance**: Optimal format for each use case
3. **Scalability**: Handles MB to GB files efficiently
4. **User Experience**: Fast, predictable, intuitive

## Migration Strategy

### For Existing Users
1. Auto-detect existing SQLite connections
2. Convert to new data source format
3. Preserve all queries and settings
4. One-time migration on first launch

### Gradual Rollout
1. Feature flag for new import system
2. Keep old system available initially
3. Gather feedback and iterate
4. Deprecate old system after stability

## Success Metrics

- Import speed: 10x faster than current CSV → SQLite
- Query performance: Sub-second for most operations
- File size: 50% reduction via Parquet compression
- User satisfaction: Reduced clicks, clearer mental model
- Code quality: 50% less code, better separation of concerns

## Example User Flows

### Import CSV File
1. Drag CSV onto app → Drop zone highlights
2. Preview shows with inferred schema → Adjust if needed
3. Click Import → Progress bar with ETA
4. File appears in sources → Ready to query immediately

### Query Data
1. Select data source from panel
2. Write SQL in editor
3. Execute query → Results stream in
4. Export or visualize results

### Manage Sources
1. Right-click source → Context menu
2. Options: Rename, Delete, Export, Properties
3. Bulk select → Organize into folders
4. Search → Find by name, type, or date

## Conclusion

This architecture embraces the fundamental differences between databases and file imports while providing a unified, elegant interface. By leveraging modern tools (Arrow, Parquet, DuckDB) and treating data import as a first-class feature, we create a system that's both more powerful and easier to use than the current approach.

The key insight: **Don't force files to pretend to be databases. Instead, create a data source abstraction that handles both elegantly.**