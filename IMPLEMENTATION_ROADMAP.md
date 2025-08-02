# Implementation Roadmap: Data Source Architecture

## Week 1: Foundation - Data Source Manager

### Day 1-2: Core Infrastructure

#### Morning: Setup and Planning
```bash
# Create new service directory structure
apps/backend/src/services/
├── dataSourceManager.ts
├── importPipeline.ts
├── queryEngine.ts
└── __tests__/
    ├── dataSourceManager.test.ts
    └── importPipeline.test.ts
```

#### Afternoon: Implement DataSourceManager
```typescript
// apps/backend/src/services/dataSourceManager.ts
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DataSource {
  id: string;
  name: string;
  type: 'sqlite' | 'parquet' | 'live-import';
  metadata: {
    path: string;
    size: number;
    created: Date;
    lastAccessed: Date;
    tableCount?: number;
    rowCount?: number;
  };
  status: 'ready' | 'importing' | 'error';
}

export class DataSourceManager {
  private sourcesPath = path.join(process.cwd(), 'data', 'sources.json');
  private sources: Map<string, DataSource> = new Map();

  async initialize() {
    // Load existing sources from disk
    await this.loadSources();
  }

  async registerSQLite(filePath: string, name?: string): Promise<DataSource> {
    const id = uuidv4();
    const stats = await fs.stat(filePath);
    
    const source: DataSource = {
      id,
      name: name || path.basename(filePath, '.db'),
      type: 'sqlite',
      metadata: {
        path: filePath,
        size: stats.size,
        created: new Date(),
        lastAccessed: new Date()
      },
      status: 'ready'
    };
    
    this.sources.set(id, source);
    await this.persistSources();
    return source;
  }
}
```

### Day 3-4: Import Pipeline

#### Create Smart Import Pipeline
```typescript
// apps/backend/src/services/importPipeline.ts
import * as arrow from 'apache-arrow';
import * as XLSX from 'xlsx';
import { EventEmitter } from 'events';

export interface ImportProgress {
  phase: 'parsing' | 'converting' | 'writing' | 'complete';
  progress: number;
  rowsProcessed?: number;
  totalRows?: number;
  estimatedTimeRemaining?: number;
}

export class ImportPipeline extends EventEmitter {
  async importCSV(filePath: string, options?: ImportOptions): Promise<string> {
    this.emit('progress', { phase: 'parsing', progress: 0 });
    
    // Stream parse CSV
    const table = await this.parseCSV(filePath);
    
    this.emit('progress', { phase: 'converting', progress: 30 });
    
    // Convert to Parquet
    const parquetPath = await this.writeParquet(table);
    
    this.emit('progress', { phase: 'complete', progress: 100 });
    
    return parquetPath;
  }
  
  private async parseCSV(filePath: string): Promise<arrow.Table> {
    // Use arrow's CSV reader for efficient streaming
    const reader = await arrow.RecordBatchReader.from(
      arrow.tableFromCSV(await fs.readFile(filePath))
    );
    return new arrow.Table(await reader.readAll());
  }
}
```

### Day 5: Query Engine Integration

#### Unified Query Interface
```typescript
// apps/backend/src/services/queryEngine.ts
import Database from 'better-sqlite3';
import * as duckdb from 'duckdb';

export class QueryEngine {
  async query(source: DataSource, sql: string): Promise<QueryResult> {
    switch (source.type) {
      case 'sqlite':
        return this.querySQLite(source, sql);
      case 'parquet':
        return this.queryParquet(source, sql);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }
  
  private async querySQLite(source: DataSource, sql: string): Promise<QueryResult> {
    const db = new Database(source.metadata.path, { readonly: true });
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all();
      return { rows, fields: stmt.columns() };
    } finally {
      db.close();
    }
  }
  
  private async queryParquet(source: DataSource, sql: string): Promise<QueryResult> {
    const db = new duckdb.Database(':memory:');
    const conn = db.connect();
    
    // Register parquet file
    conn.run(`CREATE VIEW data AS SELECT * FROM '${source.metadata.path}'`);
    
    // Run query
    const result = await new Promise((resolve, reject) => {
      conn.all(sql.replace(/FROM\s+\w+/i, 'FROM data'), (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    conn.close();
    return { rows: result };
  }
}
```

## Week 2: Frontend Transformation

### Day 6-7: New Data Sources Panel

#### Rename and Refactor SchemaBrowser
```tsx
// apps/frontend/src/components/DataSourcesPanel.tsx
import React, { useState, useEffect } from 'react';
import { Database, FileText, Upload, Search } from 'lucide-react';

interface DataSourcesPanelProps {
  onSourceSelect: (sourceId: string) => void;
  onImport: () => void;
}

export function DataSourcesPanel({ onSourceSelect, onImport }: DataSourcesPanelProps) {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredSources = sources.filter(source => 
    source.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <h2 className="text-lg font-semibold mb-3">Data Sources</h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search sources..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredSources.map(source => (
          <SourceItem
            key={source.id}
            source={source}
            onClick={() => onSourceSelect(source.id)}
          />
        ))}
      </div>
      
      {/* Import Button */}
      <div className="p-4 border-t bg-white">
        <button
          onClick={onImport}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Upload className="h-4 w-4" />
          Import Data
        </button>
      </div>
    </div>
  );
}

function SourceItem({ source, onClick }: { source: DataSource; onClick: () => void }) {
  const Icon = source.type === 'sqlite' ? Database : FileText;
  
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors"
    >
      <Icon className="h-5 w-5 text-gray-600" />
      <div className="flex-1 text-left">
        <div className="font-medium">{source.name}</div>
        <div className="text-sm text-gray-500">
          {formatFileSize(source.metadata.size)} • {source.type}
        </div>
      </div>
      {source.status === 'importing' && (
        <div className="text-sm text-blue-600">Importing...</div>
      )}
    </button>
  );
}
```

### Day 8-9: Modern Import Dialog

#### Create Elegant Import Experience
```tsx
// apps/frontend/src/components/ImportDialog.tsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, X, AlertCircle } from 'lucide-react';

export function ImportDialog({ isOpen, onClose, onImport }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setFile(file);
    setIsAnalyzing(true);
    
    // Analyze file for preview
    const preview = await analyzeFile(file);
    setPreview(preview);
    setIsAnalyzing(false);
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1
  });
  
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="w-full max-w-2xl">
        <DialogHeader>
          <h2 className="text-xl font-semibold">Import Data</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>
        
        <DialogContent>
          {!file ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">
                Drop your file here, or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Supports CSV, XLS, and XLSX files
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <FilePreview file={file} onRemove={() => setFile(null)} />
              
              {isAnalyzing ? (
                <LoadingSpinner message="Analyzing file..." />
              ) : preview && (
                <SchemaPreview preview={preview} />
              )}
            </div>
          )}
        </DialogContent>
        
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-gray-600">
            Cancel
          </button>
          <button
            onClick={() => file && onImport(file)}
            disabled={!file || isAnalyzing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            Import
          </button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
```

### Day 10: Progress Tracking

#### Real-time Import Progress
```tsx
// apps/frontend/src/components/ImportProgress.tsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';

export function ImportProgress({ importId }: { importId: string }) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  
  useEffect(() => {
    // Connect to SSE endpoint for progress updates
    const eventSource = new EventSource(`/api/import/${importId}/progress`);
    
    eventSource.onmessage = (event) => {
      const progress = JSON.parse(event.data);
      setProgress(progress);
    };
    
    return () => eventSource.close();
  }, [importId]);
  
  if (!progress) return <LoadingSpinner />;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{getPhaseLabel(progress.phase)}</span>
        <span className="text-sm text-gray-500">{progress.progress}%</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      
      {progress.rowsProcessed && (
        <div className="text-sm text-gray-600">
          {progress.rowsProcessed.toLocaleString()} / {progress.totalRows?.toLocaleString() || '?'} rows
        </div>
      )}
    </div>
  );
}
```

## Week 3: Performance & Polish

### Day 11-12: Add DuckDB Integration

#### Install Dependencies
```bash
cd apps/backend
npm install duckdb apache-arrow parquetjs
```

#### Optimize Query Performance
```typescript
// apps/backend/src/services/queryEngine.ts
export class QueryEngine {
  private duckdb: duckdb.Database;
  
  constructor() {
    // Initialize DuckDB with optimal settings
    this.duckdb = new duckdb.Database(':memory:', {
      max_memory: '1GB',
      threads: 4
    });
  }
  
  async queryParquet(source: DataSource, sql: string): Promise<QueryResult> {
    const conn = this.duckdb.connect();
    
    try {
      // Register parquet file as view
      await this.exec(conn, `
        CREATE OR REPLACE VIEW "${source.id}" AS 
        SELECT * FROM read_parquet('${source.metadata.path}')
      `);
      
      // Execute query with automatic optimization
      const result = await this.all(conn, sql);
      
      return {
        rows: result,
        executionTime: Date.now() - start,
        rowCount: result.length
      };
    } finally {
      conn.close();
    }
  }
}
```

### Day 13-14: Caching & Optimization

#### Implement Smart Caching
```typescript
// apps/backend/src/services/cacheManager.ts
import LRU from 'lru-cache';

export class CacheManager {
  private schemaCache = new LRU<string, Schema>({ max: 100 });
  private queryCache = new LRU<string, QueryResult>({ 
    max: 50,
    maxSize: 100 * 1024 * 1024, // 100MB
    sizeCalculation: (result) => JSON.stringify(result).length
  });
  
  getCachedSchema(sourceId: string): Schema | undefined {
    return this.schemaCache.get(sourceId);
  }
  
  cacheSchema(sourceId: string, schema: Schema): void {
    this.schemaCache.set(sourceId, schema);
  }
  
  getCachedQuery(hash: string): QueryResult | undefined {
    return this.queryCache.get(hash);
  }
  
  cacheQuery(hash: string, result: QueryResult): void {
    this.queryCache.set(hash, result);
  }
}
```

### Day 15: Final Polish

#### Add Advanced Features
```typescript
// Auto-refresh for file changes
import { watch } from 'chokidar';

export class FileWatcher {
  private watcher: FSWatcher;
  
  watchDataSources(sources: DataSource[], onChange: (sourceId: string) => void) {
    const paths = sources
      .filter(s => s.type === 'sqlite')
      .map(s => s.metadata.path);
    
    this.watcher = watch(paths, {
      persistent: true,
      ignoreInitial: true
    });
    
    this.watcher.on('change', (path) => {
      const source = sources.find(s => s.metadata.path === path);
      if (source) onChange(source.id);
    });
  }
}
```

## Deployment Strategy

### Feature Flag Implementation
```typescript
// apps/backend/src/config/features.ts
export const features = {
  newDataSources: process.env.ENABLE_NEW_DATA_SOURCES === 'true',
  parquetImport: process.env.ENABLE_PARQUET_IMPORT === 'true'
};

// Usage
if (features.newDataSources) {
  app.use('/api/sources', dataSourceRoutes);
} else {
  app.use('/api/db', legacyDbRoutes);
}
```

### Gradual Rollout Plan
1. **Week 1**: Deploy to internal testing
2. **Week 2**: 10% of users with feature flag
3. **Week 3**: 50% rollout, gather feedback
4. **Week 4**: 100% rollout
5. **Week 5**: Remove legacy code

## Success Tracking

### Metrics to Monitor
```typescript
// Track import performance
analytics.track('import_completed', {
  fileSize: file.size,
  fileType: file.type,
  duration: Date.now() - startTime,
  rowCount: result.rowCount,
  compressionRatio: originalSize / parquetSize
});

// Track query performance  
analytics.track('query_executed', {
  sourceType: source.type,
  queryLength: sql.length,
  executionTime: result.executionTime,
  rowCount: result.rowCount,
  cacheHit: cached
});
```

## Conclusion

This implementation roadmap provides a clear path from the current architecture to a modern, elegant data source system. By following this plan, we'll deliver a 10x improvement in performance while significantly simplifying the codebase and improving the user experience.