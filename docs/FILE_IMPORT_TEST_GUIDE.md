# File Import Test Guide

This guide documents the comprehensive testing suite for file import functionality in DataAsk, covering CSV and Excel file uploads, data type inference, and large file handling.

## Overview

The file import testing suite validates:
- CSV file parsing and import
- Excel file parsing with multiple sheets
- Data type inference accuracy
- Performance with large files (up to 100K rows)
- Edge cases and error handling
- API integration

## Test Files

### Generated Test Files

Run the following script to generate all test files:
```bash
node scripts/create-test-files.js
```

This creates the following files in `/test-data`:

#### Small Test Files
- `employees_small.csv` - 5 rows with various data types
- `products_mixed.csv` - 5 rows with null values
- `special_characters.csv` - Tests Unicode, quotes, and special characters
- `test_data.xlsx` - Multi-sheet Excel file

#### Large Test Files
- `employees_10k.csv` - 10,000 rows (0.90 MB)
- `employees_50k.csv` - 50,000 rows (4.55 MB)
- `employees_100k.csv` - 100,000 rows (9.12 MB)
- `employees_10k.xlsx` - 10,000 rows in Excel format (4.13 MB)

#### Edge Case Files
- `empty.csv` - Empty file
- `headers_only.csv` - Only headers, no data
- `single_column.csv` - Single column data

## Running Tests

### Complete Test Suite

Run all tests:
```bash
node scripts/test-file-import.js
```

### Individual Test Categories

```javascript
const tests = require('./scripts/test-file-import');

// Run specific test categories
tests.testDataTypeInference();    // Data type detection
tests.testCSVParsing();           // CSV parsing validation
tests.testExcelParsing();         // Excel file handling
tests.testPerformance();          // Performance benchmarks
tests.testEdgeCases();            // Edge case handling
tests.testAPIImport();            // API integration (requires backend)
```

## Test Results

### Data Type Inference ✅

The system correctly identifies:
- **INTEGER**: Whole numbers (1, 2, 3)
- **REAL**: Decimal numbers (1.5, 2.7, 3.14)
- **BOOLEAN**: True/false values
- **DATE**: ISO date formats (2024-01-15)
- **TEXT**: Mixed or string data

### CSV Parsing ✅

| Test | Result | Details |
|------|---------|---------|
| Small CSV (5 rows) | ✅ PASS | Correctly parsed all columns and rows |
| Special characters | ✅ PASS | Handles Unicode, quotes, commas |
| Single column | ✅ PASS | Parses single-column files |
| Empty file | ✅ PASS | Gracefully handles empty files |
| Headers only | ✅ PASS | Handles files with no data rows |

### Excel Parsing ✅

| Test | Result | Details |
|------|---------|---------|
| Multi-sheet | ✅ PASS | Reads all sheets correctly |
| Large file (10K) | ✅ PASS | Handles large Excel files |
| Data preservation | ✅ PASS | Maintains data types and nulls |

### Performance Benchmarks ✅

| File Size | Format | Parse Time | Status |
|-----------|---------|------------|---------|
| 10K rows | CSV | 6ms | ✅ PASS (< 2s) |
| 50K rows | CSV | 30ms | ✅ PASS (< 5s) |
| 100K rows | CSV | ~60ms | ✅ PASS (< 10s) |
| 10K rows | Excel | 240ms | ✅ PASS (< 3s) |

## Component Tests

### FileImportModal Component

Run frontend tests:
```bash
cd apps/frontend
npm test -- FileImportModal.test.tsx
```

Tests cover:
- Modal rendering and state management
- File selection and validation
- Upload progress tracking
- Error handling
- Table name generation

### FileDropZone Component

Tests include:
- Drag and drop functionality
- File type validation
- Size limit enforcement
- Error message display

## Integration Tests

### Backend Integration

Run backend tests:
```bash
cd apps/backend
npm test -- file-import-integration.test.ts
```

Tests validate:
- CSV parsing pipeline
- Excel parsing pipeline
- Data type inference
- SQLite table creation
- Error handling

## API Testing

### Manual API Test

With the backend running:
```bash
# Upload CSV file
curl -X POST http://localhost:3001/api/files/import \
  -F "file=@test-data/employees_small.csv" \
  -F "tableName=test_employees"

# Check import progress
curl http://localhost:3001/api/files/import-progress/{importId}
```

### Expected Response
```json
{
  "connectionId": "sqlite_file",
  "message": "File imported successfully",
  "rowCount": 5,
  "tableName": "test_employees"
}
```

## Data Type Inference Logic

The system uses the following rules for type detection:

1. **Sample First 100 Rows**: Analyzes up to 100 rows to determine types
2. **Null Handling**: Ignores null/empty values during inference
3. **Type Priority**:
   - BOOLEAN → INTEGER → REAL → DATE → TEXT
4. **Fallback**: Defaults to TEXT for mixed or ambiguous data

### Type Detection Examples

```javascript
// INTEGER detection
[1, 2, "3", null, "5"] → INTEGER

// REAL detection
[1.5, "2.7", 3.14, null] → REAL

// BOOLEAN detection
[true, "false", true, null] → BOOLEAN

// DATE detection
["2024-01-15", "2024-02-20", null] → DATE

// TEXT fallback
["abc", 123, true, "2024-01-01"] → TEXT
```

## Large File Handling

### Recommendations

1. **Batch Processing**: Files > 50K rows are processed in batches
2. **Progress Tracking**: Real-time progress updates for large imports
3. **Memory Management**: Streaming parser for CSV files
4. **Timeout Handling**: 5-minute timeout for very large files

### Performance Tips

- **CSV**: Faster parsing, smaller file size
- **Excel**: Better for multi-sheet data, preserves formatting
- **Compression**: Consider zipping very large files before upload

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|--------|----------|
| "File is empty" | No data rows | Add at least one data row |
| "Invalid file format" | Wrong extension | Use .csv, .xlsx, or .xls |
| "File too large" | > 50MB | Split into smaller files |
| "Invalid table name" | Special characters | Use alphanumeric + underscore |
| "Corrupted file" | Binary data in CSV | Re-save in proper format |

## Best Practices

### File Preparation

1. **Headers**: First row should contain column names
2. **Consistency**: Keep data types consistent within columns
3. **Encoding**: Use UTF-8 for international characters
4. **Dates**: Use ISO format (YYYY-MM-DD)
5. **Booleans**: Use true/false or 1/0

### Testing Workflow

1. Generate test files with various data patterns
2. Test small files first to verify functionality
3. Test edge cases (empty, special characters)
4. Test performance with large files
5. Verify data integrity after import

## Troubleshooting

### Debug Mode

Enable detailed logging:
```javascript
// In browser console
localStorage.setItem('debug', 'dataask:import:*')
```

### Common Issues

1. **Progress Stuck**: Check browser console for errors
2. **Slow Upload**: Check network speed and file size
3. **Type Mismatch**: Review first 100 rows for consistency
4. **Import Fails**: Check server logs for detailed errors

## Future Enhancements

1. **Streaming Upload**: For files > 100MB
2. **Column Mapping**: Custom column name mapping
3. **Data Validation**: Pre-import data validation rules
4. **Format Detection**: Auto-detect delimiter for CSV
5. **Compression Support**: Direct upload of .zip files