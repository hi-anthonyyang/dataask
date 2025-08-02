# SQLite + CSV/Excel Refactoring Plan

## Overview
This plan outlines the systematic refactoring of DataAsk to support only SQLite databases and CSV/Excel file imports, removing PostgreSQL and MySQL support. The refactor will be done incrementally on the main branch, reusing existing code where possible.

## Guiding Principles
1. **Reuse over rebuild** - Modify existing components rather than creating new ones
2. **Incremental changes** - Small, testable commits that maintain functionality
3. **No new abstractions** - Use existing patterns in the codebase
4. **Preserve working features** - Keep the app functional throughout the refactor

## Phase 1: Backend Simplification (Week 1)

### 1.1 Simplify DatabaseManager (`apps/backend/src/utils/database.ts`)
**Current**: 1522 lines with support for 3 database types
**Target**: ~400 lines focused on SQLite only

**Actions**:
- Remove PostgreSQL-specific methods (lines 572-895)
- Remove MySQL-specific methods (lines 896-1250)
- Remove SSH tunnel support (lines 267-290)
- Remove SSL/TLS configuration (lines 587-650)
- Keep and enhance SQLite methods
- Simplify connection config interface
- Remove connection pooling (not needed for SQLite)

**Preserve**:
- SQLite connection methods
- Schema retrieval logic
- Query execution with parameter sanitization
- Error handling patterns

### 1.2 Update Database Types (`apps/backend/src/types/database.ts`)
**Actions**:
- Simplify `DatabaseType` to only 'sqlite'
- Remove PostgreSQL/MySQL specific config fields
- Simplify `ConnectionConfig` interface:
  ```typescript
  interface ConnectionConfig {
    type: 'sqlite';
    name: string;
    config: {
      filename: string;
    };
  }
  ```

### 1.3 Simplify API Routes (`apps/backend/src/api/db.ts`)
**Actions**:
- Remove complex connection validation
- Simplify test-connection endpoint
- Remove connection timeout configurations
- Keep query execution and schema endpoints

### 1.4 Enhance File Import (`apps/backend/src/api/files.ts`)
**Current**: Creates temporary SQLite databases
**Enhancement**: Make this the primary way to work with data

**Actions**:
- Move file import logic to be more prominent
- Add better progress tracking
- Enhance error messages
- Add support for larger files
- Consider streaming for better performance

### 1.5 Remove User Connections (`apps/backend/src/api/user-connections.ts`)
**Actions**:
- Remove entire file (371 lines)
- Remove route from `app.ts`
- Local SQLite files don't need user-specific management

## Phase 2: Frontend Simplification (Week 1-2)

### 2.1 Simplify Connection Modal (`apps/frontend/src/components/ConnectionModal.tsx`)
**Current**: 805 lines with complex forms
**Target**: ~200 lines for SQLite file selection

**Actions**:
- Remove PostgreSQL/MySQL tabs
- Simplify to just SQLite file picker
- Remove SSH tunnel configuration
- Remove SSL/TLS options
- Keep file validation logic

### 2.2 Unify Data Import (`apps/frontend/src/components/FileImportModal.tsx`)
**Actions**:
- Enhance as the primary data import method
- Add SQLite file support alongside CSV/Excel
- Improve progress indication
- Better error handling

### 2.3 Rename and Simplify Schema Browser (`apps/frontend/src/components/SchemaBrowser.tsx`)
**Rename to**: `DataSourceBrowser.tsx`

**Actions**:
- Change "Connections" to "Data Sources"
- Show both SQLite databases and imported files
- Add file type icons
- Simplify the UI

### 2.4 Update Database Service (`apps/frontend/src/services/database.ts`)
**Actions**:
- Remove PostgreSQL/MySQL specific logic
- Simplify connection testing
- Focus on file-based operations

### 2.5 Clean Up Constants (`apps/frontend/src/utils/constants.ts`)
**Actions**:
- Remove DATABASE_TYPES for postgres/mysql
- Update error messages
- Simplify API endpoints

## Phase 3: Data Management Enhancement (Week 2)

### 3.1 Create Unified Data Source Manager
**Location**: Extend existing `apps/backend/src/utils/database.ts`

**New Methods**:
```typescript
class DatabaseManager {
  // Existing SQLite methods...
  
  // New unified methods
  async importCSV(filePath: string, tableName: string): Promise<string>
  async importExcel(filePath: string, tableName: string): Promise<string>
  async listDataSources(): Promise<DataSource[]>
  async deleteDataSource(id: string): Promise<void>
}
```

### 3.2 Improve Data Persistence
**Location**: Reuse existing persistence in `database.ts`

**Actions**:
- Enhance `data/connections.json` to track all data sources
- Add metadata (import date, original filename, size)
- Auto-cleanup old temporary imports

### 3.3 Add Data Source Metadata
**Location**: Extend existing types in `apps/backend/src/types/database.ts`

```typescript
interface DataSourceMetadata {
  id: string;
  name: string;
  type: 'sqlite' | 'imported';
  path: string;
  originalName?: string;
  importDate?: Date;
  fileSize?: number;
  tableCount?: number;
  rowCount?: number;
}
```

## Phase 4: Testing and Migration (Week 2-3)

### 4.1 Update Tests
**Actions**:
- Remove PostgreSQL/MySQL tests
- Add comprehensive SQLite tests
- Test file import edge cases
- Add performance tests for large files

### 4.2 Migration Guide
**Location**: `docs/MIGRATION_TO_SQLITE.md`

**Content**:
- How to export data from PostgreSQL/MySQL
- Converting to SQLite format
- Using the new simplified interface

### 4.3 Update Documentation
**Actions**:
- Update README.md
- Simplify setup instructions
- Update DOCSTRINGS.md
- Remove references to removed features

## Phase 5: UI/UX Polish (Week 3)

### 5.1 Streamline the Interface
**Actions**:
- Single "Add Data" button for all imports
- Drag & drop for any supported file type
- Better empty states
- Clearer progress indicators

### 5.2 Improve Error Messages
**Actions**:
- File-specific error messages
- Better guidance for common issues
- Clear file size limits

### 5.3 Add Quality of Life Features
**Actions**:
- Recent files list
- Quick actions (refresh, delete, rename)
- Better file organization

## Implementation Order

1. **Day 1-2**: Backend type simplification
   - Update types/database.ts
   - Start trimming database.ts

2. **Day 3-4**: Remove PostgreSQL/MySQL code
   - Clean database.ts
   - Update API routes
   - Remove user-connections

3. **Day 5-6**: Frontend connection simplification
   - Simplify ConnectionModal
   - Update services

4. **Day 7-8**: Unify data import
   - Enhance FileImportModal
   - Create unified data source view

5. **Day 9-10**: Testing and polish
   - Update tests
   - Fix edge cases
   - Update documentation

## Benefits After Refactor

1. **Code Reduction**: ~3000 lines removed
2. **Simplified Dependencies**: Remove pg, mysql2, ssh2
3. **Faster Development**: Single database type to support
4. **Better UX**: Simpler, more focused interface
5. **Improved Reliability**: Fewer external dependencies

## Risks and Mitigations

1. **Risk**: Breaking existing SQLite functionality
   **Mitigation**: Incremental changes with testing

2. **Risk**: Users needing PostgreSQL/MySQL
   **Mitigation**: Clear migration guide, maintain legacy branch

3. **Risk**: Performance with large files
   **Mitigation**: Add streaming, progress indicators

## Success Metrics

- [ ] All tests passing
- [ ] CSV/Excel import working reliably
- [ ] SQLite connections stable
- [ ] Documentation updated
- [ ] Code coverage maintained
- [ ] Bundle size reduced by >20%

## Detailed Implementation Checklist

### Phase 1: Backend Changes

#### 1.1 Database Types Simplification
- [ ] Update `apps/backend/src/types/database.ts`:
  - [ ] Change `DatabaseType` to only include 'sqlite'
  - [ ] Remove MySQL/PostgreSQL specific fields from `ConnectionConfig`
  - [ ] Remove SSH tunnel types
  - [ ] Remove SSL/TLS configuration types

#### 1.2 DatabaseManager Cleanup (`apps/backend/src/utils/database.ts`)
- [ ] Remove PostgreSQL methods:
  - [ ] `testPostgreSQLConnection()` (lines 573-600)
  - [ ] `createPostgreSQLConnection()` (lines 602-650)
  - [ ] `getPostgreSQLSchema()` (lines 652-750)
  - [ ] PostgreSQL error handling (lines 751-895)
- [ ] Remove MySQL methods:
  - [ ] `testMySQLConnection()` (lines 896-950)
  - [ ] `createMySQLConnection()` (lines 951-1050)
  - [ ] `getMySQLSchema()` (lines 1051-1150)
  - [ ] MySQL error handling (lines 65-136)
- [ ] Remove infrastructure:
  - [ ] SSH tunnel support (lines 267-290)
  - [ ] SSL configuration methods (lines 587-650)
  - [ ] Connection pooling logic
- [ ] Simplify remaining methods:
  - [ ] `testConnection()` - only SQLite
  - [ ] `createConnection()` - only SQLite
  - [ ] `getSchema()` - only SQLite

#### 1.3 API Routes Cleanup
- [ ] Update `apps/backend/src/api/db.ts`:
  - [ ] Simplify connection validation schema
  - [ ] Remove database type validation
  - [ ] Update error messages
- [ ] Remove `apps/backend/src/api/user-connections.ts` entirely
- [ ] Update `apps/backend/src/app.ts`:
  - [ ] Remove user-connections route
  - [ ] Remove database pool initialization

#### 1.4 Dependencies Cleanup
- [ ] Update `apps/backend/package.json`:
  - [ ] Remove `pg` and `@types/pg`
  - [ ] Remove `mysql2`
  - [ ] Remove `ssh2` and `@types/ssh2`
- [ ] Run `npm install` to update lock file

### Phase 2: Frontend Changes

#### 2.1 Connection Modal Simplification
- [ ] Update `apps/frontend/src/components/ConnectionModal.tsx`:
  - [ ] Remove database type tabs
  - [ ] Remove PostgreSQL form fields
  - [ ] Remove MySQL form fields
  - [ ] Remove SSH tunnel section
  - [ ] Remove SSL/TLS section
  - [ ] Keep only SQLite file picker
  - [ ] Simplify validation logic

#### 2.2 Constants and Types
- [ ] Update `apps/frontend/src/utils/constants.ts`:
  - [ ] Remove POSTGRESQL and MYSQL from DATABASE_TYPES
  - [ ] Update error messages
  - [ ] Remove unused API endpoints
- [ ] Update `apps/frontend/src/types/index.ts`:
  - [ ] Simplify ConnectionConfig type
  - [ ] Remove database-specific fields

#### 2.3 Services Update
- [ ] Update `apps/frontend/src/services/database.ts`:
  - [ ] Remove PostgreSQL/MySQL specific logic
  - [ ] Simplify connection testing
  - [ ] Remove type-specific handling

#### 2.4 UI Components
- [ ] Rename `SchemaBrowser.tsx` to `DataSourceBrowser.tsx`:
  - [ ] Update terminology from "Connections" to "Data Sources"
  - [ ] Add file type icons
  - [ ] Simplify the tree structure
- [ ] Update `DataAskApp.tsx`:
  - [ ] Update imports and component names
  - [ ] Simplify connection handling

### Phase 3: Testing Updates

#### 3.1 Remove Database-Specific Tests
- [ ] Delete PostgreSQL test files
- [ ] Delete MySQL test files
- [ ] Delete SSH tunnel tests
- [ ] Update integration tests

#### 3.2 Update Existing Tests
- [ ] Update `apps/backend/src/api/__tests__/db.test.ts`
- [ ] Update `apps/backend/src/api/__tests__/files.test.ts`
- [ ] Focus on SQLite and file import scenarios

### Phase 4: Documentation Updates

#### 4.1 User Documentation
- [ ] Update `README.md`:
  - [ ] Remove PostgreSQL/MySQL references
  - [ ] Simplify setup instructions
  - [ ] Update feature list
- [ ] Update `docs/TROUBLESHOOTING.md`:
  - [ ] Remove database-specific sections
  - [ ] Focus on file-based issues

#### 4.2 Technical Documentation
- [ ] Update `DOCSTRINGS.md`:
  - [ ] Remove obsolete function documentation
  - [ ] Update with new simplified API
- [ ] Create `docs/MIGRATION_TO_SQLITE.md`:
  - [ ] Migration guide for existing users
  - [ ] Data export instructions

### Phase 5: Final Polish

#### 5.1 Code Cleanup
- [ ] Remove unused imports
- [ ] Remove commented code
- [ ] Run linter and fix issues
- [ ] Check for unused dependencies

#### 5.2 Performance Testing
- [ ] Test with large CSV files (>100MB)
- [ ] Test with large SQLite databases
- [ ] Optimize import performance if needed

#### 5.3 User Experience
- [ ] Add helpful empty states
- [ ] Improve error messages
- [ ] Add loading indicators
- [ ] Test drag & drop functionality

## Components to Preserve and Enhance

### Backend
1. **SQLite Methods in DatabaseManager**:
   - `testSQLiteConnection()`
   - `createSQLiteConnection()`
   - `getSQLiteSchema()`
   - Connection persistence logic

2. **File Import Logic**:
   - CSV parsing in `files.ts`
   - Excel parsing in `files.ts`
   - Batch insertion logic
   - Progress tracking

3. **Security Features**:
   - SQL injection prevention
   - Query validation
   - Parameter sanitization

### Frontend
1. **File Import Modal**:
   - Drag & drop functionality
   - File validation
   - Progress tracking
   - Error handling

2. **Query Interface**:
   - SQL editor
   - Query execution
   - Results display
   - Export functionality

3. **Data Visualization**:
   - Table viewer
   - Schema browser
   - Data analysis tools