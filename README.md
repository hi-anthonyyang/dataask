# DataAsk

AI-powered data analysis tool for CSV and Excel files

## Features

- **Natural Language to Pandas**: Convert plain English questions into pandas code
- **CSV/Excel Support**: Upload and analyze spreadsheet data instantly
- **AI-Powered Analysis**: Get insights and explanations from your data
- **Interactive Visualizations**: Auto-generated charts and graphs
- **In-Memory Processing**: Fast analysis using pandas-like operations
- **Secure Code Execution**: Safe execution of generated pandas code

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- **OpenAI API Key** (required for AI features)

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd dataask
   npm install
   ```

2. **Configure OpenAI API Key:**
   ```bash
   # Copy the environment template
   cp env.example apps/backend/.env
   
   # Edit the .env file and set your OpenAI API key
   # Replace the placeholder with your actual API key:
   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   ```

   **Important:** You need a valid OpenAI API key for the AI features to work. Get one from [OpenAI's API platform](https://platform.openai.com/api-keys).

3. **Start the application:**
   ```bash
   npm run dev
   ```

   The app will be available at http://localhost:3000

## How It Works

1. **Upload Your Data**: Drag and drop a CSV or Excel file
2. **Ask Questions**: Type questions in natural language like:
   - "What are the top 5 products by sales?"
   - "Show me monthly revenue trends"
   - "Which categories have the highest profit margins?"
3. **Get Results**: DataAsk generates pandas code, executes it, and displays results with visualizations

## Architecture

DataAsk uses a modern web stack optimized for data analysis:

- **Frontend**: React with TypeScript for a responsive UI
- **Backend**: Express.js API server with pandas-like data processing
- **AI Integration**: OpenAI GPT models for natural language understanding
- **Data Processing**: In-memory DataFrames for fast analysis

## Project Structure

```
dataask/
├── apps/
│   ├── backend/           # Express.js API server
│   │   └── src/
│   │       ├── api/       # API endpoints
│   │       ├── utils/     # DataFrame and pandas executor
│   │       └── services/  # Business logic
│   ├── frontend/          # React application
│   │   └── src/
│   │       ├── components/  # UI components
│   │       └── services/    # API clients
│   └── electron-shell/    # Desktop app wrapper
├── docs/                  # Documentation
└── package.json          # Root package configuration
```

## API Endpoints

### File Operations
- `POST /api/files/upload` - Upload CSV/Excel files
- `GET /api/files/dataframes` - List uploaded DataFrames
- `GET /api/files/dataframes/:id/preview` - Preview DataFrame data
- `DELETE /api/files/dataframes/:id` - Remove DataFrame

### DataFrame Operations
- `POST /api/dataframes/:id/execute` - Execute pandas code
- `GET /api/dataframes/:id/info` - Get DataFrame information
- `GET /api/dataframes/:id/stats` - Get statistical summary

### AI Operations
- `POST /api/llm/nl-to-pandas` - Convert natural language to pandas code
- `POST /api/llm/analyze` - Generate insights from results

## Development

### Running Locally

```bash
# Start backend and frontend
npm run dev

# Start individual services
npm run backend   # API server on port 3001
npm run frontend  # React app on port 3000

# Run as desktop app
npm run dev:all   # Includes Electron wrapper
```

### Testing

```bash
# Run all tests
npm test

# Frontend tests
cd apps/frontend && npm test

# Backend tests
cd apps/backend && npm test
```

## Data Processing

DataAsk uses an in-memory DataFrame approach similar to pandas:

1. **File Upload**: CSV/Excel files are parsed and loaded into memory
2. **Data Storage**: Each file becomes a DataFrame with:
   - Column names and types
   - Row data
   - Statistical metadata
3. **Query Processing**: Natural language → pandas code → results
4. **Memory Management**: DataFrames are kept in memory for fast access

## Security

- **Code Validation**: Generated pandas code is validated before execution
- **Sandboxed Execution**: Code runs in a controlled environment
- **Input Sanitization**: All user inputs are sanitized
- **Rate Limiting**: API endpoints are rate-limited
- **File Validation**: Uploaded files are validated for type and size

## Limitations

- **File Size**: Maximum 50MB per file
- **Memory**: Large files may impact performance
- **Data Types**: Best suited for tabular data (CSV/Excel)
- **Persistence**: Data is stored in memory only (not persisted)

## Troubleshooting

### "Failed to generate pandas code" Error

This usually means the OpenAI API key is not configured:

1. Check your `.env` file exists in `apps/backend/`
2. Ensure `OPENAI_API_KEY` is set to a valid key
3. Restart the backend server

### File Upload Issues

- Ensure files are CSV (.csv) or Excel (.xls, .xlsx) format
- Check file size is under 50MB
- Verify the file contains valid tabular data

### Memory Issues

For large datasets:
- Consider splitting files into smaller chunks
- Monitor browser memory usage
- Refresh the page to clear memory

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
