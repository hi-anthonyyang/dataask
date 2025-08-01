# DataAsk

AI-native, minimal SQL data analysis tool

## Features

- **Natural Language to SQL**: Convert plain English questions into SQL queries
- **Multi-Database Support**: Works with PostgreSQL, MySQL, and SQLite
- **AI-Powered Analysis**: Get insights and explanations from your query results
- **Secure by Design**: Built-in SQL injection protection and input sanitization
- **Cross-Platform**: Desktop app with web interface

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose (for databases)
- **OpenAI API Key** (required for AI features)

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd dataask
   npm run setup
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

### Troubleshooting

#### "Failed to generate SQL" Error

If you see this error when asking questions, it means the OpenAI API key is not configured properly:

**Root Cause:** The `OPENAI_API_KEY` environment variable is missing, empty, or set to a placeholder value.

**Solution:**
1. Ensure you have created `apps/backend/.env` file
2. Set a valid OpenAI API key: `OPENAI_API_KEY=sk-your-actual-api-key`
3. Restart the backend server

**Check API Key Status:**
```bash
curl http://localhost:3001/api/llm/health
```

This will show if your API key is configured correctly.

## Architecture

- **Frontend**: React with TypeScript
- **Backend**: Express.js API server
- **Desktop**: Electron wrapper
- **AI**: OpenAI GPT models for natural language processing
- **Databases**: Support for PostgreSQL, MySQL, SQLite

## Development

```bash
# Start all services in development mode
npm run dev

# Start individual services
npm run dev:backend    # API server on port 3001
npm run dev:frontend   # React app on port 3000
npm run dev:electron   # Desktop app

# Build for production
npm run build

# Run tests
npm run test --workspaces  # Run all tests
cd apps/frontend && npm test  # Frontend tests with Vitest
cd apps/backend && npm test   # Backend tests with Jest

# Code quality
cd apps/frontend && npm run lint  # ESLint for frontend
```

## Database Connection Features

DataAsk provides enterprise-grade database connectivity options:

### Connection Types
- **PostgreSQL**: Full support with connection pooling
- **MySQL**: Complete compatibility with performance optimizations  
- **SQLite**: Embedded database support for local files
- **File Import**: CSV and Excel file import with automatic schema detection

### File Import Capabilities
- **Supported Formats**: CSV, XLS, and XLSX files
- **Drag & Drop**: Drop files directly into the main panel or use the import dialog
- **Auto-Detection**: Automatic column type detection (Text, Integer, Number, Date)
- **Schema Configuration**: Review and adjust column names and types before import
- **Data Preview**: See sample data and statistics before importing
- **Instant Querying**: Imported files become immediately queryable like database tables

### Security & Tunneling
- **SSH Tunneling**: Secure connections through SSH servers with password or private key authentication
- **SSL/TLS Encryption**: Configurable SSL modes (disable, allow, prefer, require) with custom certificates
- **Certificate Management**: Support for CA certificates, client certificates, and private keys

### Advanced Configuration
- **Connection Timeouts**: Configurable connection and query timeout settings
- **Connection Pooling**: Automatic connection pool management for optimal performance
- **Multiple Authentication**: Support for various authentication methods per database type

### Connection Management
- **Test Connections**: Built-in connection testing before saving
- **Connection Persistence**: Secure storage of connection configurations with encryption
- **Easy Management**: Intuitive UI for creating, editing, and managing database connections

## Security

DataAsk implements multiple security layers:

- Input sanitization and validation
- SQL injection prevention
- Prompt injection protection
- Rate limiting
- Secure database connections
- File upload validation and size limits

See `AUTHENTICATION.md`, `PROMPT_INJECTION_SECURITY.md`, and `TLS_SECURITY.md` for detailed security documentation.

## License

MIT License - see LICENSE file for details.
