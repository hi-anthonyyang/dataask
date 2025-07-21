# DataAsk

An AI-native, minimal SQL data analysis tool. Think DBeaver, but radically simplified with a chat-first AI interface for fast, secure, read-only database exploration.

## Features

- **Three-Panel Interface**: Familiar layout with schema browser, analysis panel, and chat interface
- **Natural Language Queries**: Ask questions in plain English, get SQL and insights
- **Security First**: Read-only queries, backend-only API keys, encrypted credential storage
- **Multiple Database Support**: PostgreSQL and SQLite support
- **AI-Powered Analysis**: Auto-generated insights, summaries, and visualizations
- **Desktop Native**: Electron app with familiar desktop database tool experience

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose (for local database development)

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd dataask
   npm run setup  # Installs dependencies and starts Docker containers
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your OpenAI API key and other configuration
   ```

3. **Start development environment:**
   ```bash
   npm run dev  # Starts backend, frontend, and electron concurrently
   ```

## Architecture

This is a monorepo with three main applications:

- **`apps/backend/`**: Node.js/Express API server handling database connections and LLM integration
- **`apps/frontend/`**: React/TypeScript UI with three-panel layout
- **`apps/electron-shell/`**: Electron wrapper for desktop experience

## Security

### API Keys & Secrets
- **NEVER** store API keys in frontend code or commit them to git
- All secrets belong in `.env` files or environment variables
- OpenAI API key is only accessible to the backend

### Database Security
- All queries are validated for read-only operations (SELECT, EXPLAIN, DESCRIBE only)
- SQL injection prevention through parameterized queries
- Database credentials encrypted in local storage
- Connection strings never exposed to frontend

### Development Security
- Use `.env.example` for documentation, never commit real `.env` files
- Review generated SQL before execution
- Sanitize all user inputs and LLM outputs

## Development

### Available Scripts

```bash
# Development
npm run dev                 # Start all services
npm run dev:backend        # Backend only
npm run dev:frontend       # Frontend only  
npm run dev:electron       # Electron only

# Docker services
npm run docker:up          # Start PostgreSQL container
npm run docker:down        # Stop containers

# Build & deployment
npm run build              # Build all apps
npm run clean              # Clean build artifacts
```

### Project Structure

```
dataask/
├── apps/
│   ├── backend/          # Express API server
│   ├── frontend/         # React UI application  
│   └── electron-shell/   # Electron desktop wrapper
├── packages/
│   └── shared/          # Shared types and utilities
├── docker/              # Docker Compose setup
└── docs/               # Documentation
```

## Contributing

1. Follow the security guidelines above
2. Test with both PostgreSQL and SQLite databases
3. Ensure all queries remain read-only
4. Add TypeScript types for new features
5. Update tests for API changes

## License

MIT License 