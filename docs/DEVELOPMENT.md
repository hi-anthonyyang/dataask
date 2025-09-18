# DataAsk Development Guide

## Overview

This guide covers development practices, architecture, and workflows for the DataAsk application.

## Architecture

### Backend (Express.js + Pandas-like Processing)
- **API Server**: `apps/backend/src/app.ts`
- **DataFrame Management**: `apps/backend/src/utils/dataFrameManager.ts`
- **Code Execution**: `apps/backend/src/utils/pandasExecutor.ts`
- **File Processing**: `apps/backend/src/api/files.ts`
- **AI Integration**: `apps/backend/src/api/llm.ts`

### Frontend (React + TypeScript)
- **Main App**: `apps/frontend/src/components/DataAskApp.tsx`
- **File Management**: `apps/frontend/src/components/DataFrameBrowser.tsx`
- **Query Interface**: `apps/frontend/src/components/ChatPanel.tsx`
- **Results Display**: `apps/frontend/src/components/AnalysisPanel.tsx`
- **Visualization**: `apps/frontend/src/components/DataVisualizer.tsx`

## Development Setup

### Prerequisites
- Node.js 18+ and npm 9+
- API Key for AI features

### Installation
```bash
# Clone and install dependencies
git clone <repository-url>
cd dataask
npm install

# Configure environment
cp env.example apps/backend/.env
# Edit apps/backend/.env and set API_KEY
```

### Running Development
```bash
# Start all services
npm run dev

# Individual services
npm run dev:backend    # API server on port 3001
npm run dev:frontend   # React app on port 3000
npm run dev:electron   # Desktop app
```

## Core Workflows

### 1. File Upload Process
1. **Frontend**: User drops CSV/Excel file
2. **Backend**: File processed by `DataFrameManager`
3. **Storage**: DataFrame stored in memory
4. **Response**: File info returned to frontend

### 2. Natural Language Query Process
1. **Frontend**: User types question in `ChatPanel`
2. **Backend**: Question sent to AI service via `llm.ts`
3. **AI**: Generates pandas code from question
4. **Execution**: Code executed by `PandasExecutor`
5. **Results**: Data and visualizations returned

### 3. DataFrame Operations
- **List**: Get all uploaded DataFrames
- **Preview**: Show sample data
- **Execute**: Run pandas code on DataFrame
- **Stats**: Get statistical information
- **Delete**: Remove DataFrame from memory

## Key Components

### DataFrameManager
- **Purpose**: In-memory DataFrame management
- **Features**: CSV/Excel loading, type detection, statistics
- **Memory**: DataFrames stored in application memory

### PandasExecutor
- **Purpose**: Safe pandas code execution
- **Security**: Sandboxed environment with validation
- **Features**: Error handling, memory limits, safe execution

### AI Integration
- **Purpose**: Natural language to pandas code conversion
- **Models**: AI service for code generation
- **Security**: Prompt injection protection

## Development Best Practices

### Code Organization
- **Components**: Single responsibility, reusable
- **Services**: API abstraction layers
- **Utils**: Shared utility functions
- **Types**: TypeScript interfaces and types

### Error Handling
- **Frontend**: User-friendly error messages
- **Backend**: Comprehensive logging
- **Validation**: Zod schema validation
- **Recovery**: Graceful error recovery

### Testing
```bash
# Run all tests
npm test

# Frontend tests
cd apps/frontend && npm test

# Backend tests
cd apps/backend && npm test
```

### Code Quality
- **Linting**: ESLint for code quality
- **Formatting**: Prettier for consistent formatting
- **Type Safety**: TypeScript for type checking
- **Documentation**: JSDoc comments

## Security Considerations

### Input Validation
- **Zod Schemas**: Validate all API inputs
- **File Validation**: Check file types and sizes
- **Content Sanitization**: Clean user inputs

### Code Execution
- **Sandboxing**: Safe pandas code execution
- **Memory Limits**: Prevent memory exhaustion
- **Error Sanitization**: Safe error messages

### API Security
- **Rate Limiting**: Prevent abuse
- **CORS**: Proper cross-origin handling
- **Authentication**: Future implementation

## Performance Optimization

### Frontend
- **Lazy Loading**: Load components on demand
- **Memoization**: React.memo for expensive components
- **Virtualization**: For large data lists
- **Caching**: API response caching

### Backend
- **Memory Management**: Efficient DataFrame storage
- **Code Execution**: Optimized pandas operations
- **API Response**: Compressed responses
- **Error Handling**: Fast error recovery

## Deployment

### Production Build
```bash
# Build all applications
npm run build

# Start production server
npm start
```

### Environment Configuration
- **Development**: Local file processing
- **Production**: Optimized for performance
- **Testing**: Isolated test environment

## Troubleshooting

### Common Issues
1. **File Upload Fails**: Check file format and size
2. **AI Queries Fail**: Verify API key
3. **Memory Issues**: Large files may cause problems
4. **Performance**: Monitor DataFrame memory usage

### Debug Tools
- **Frontend**: React DevTools
- **Backend**: Node.js debugging
- **Network**: Browser developer tools
- **Logs**: Application logging

## Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

## Future Enhancements

### Planned Features
- **Persistence**: Save DataFrames to disk
- **Collaboration**: Share analysis results
- **Advanced AI**: More sophisticated code generation
- **Mobile Support**: Responsive design improvements

### Technical Improvements
- **Performance**: Optimize large file handling
- **Security**: Enhanced code execution safety
- **UX**: Improved user interface
- **Testing**: Comprehensive test coverage 