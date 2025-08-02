# Module-level docstrings

The following docstrings describe the purpose of each module in the DataAsk repository. These should be inserted at the top of the corresponding source files as JSDoc comments.

## Backend

### `apps/backend/src/app.ts`

    /**
     * Express application initialization file.
     *
     * Creates an Express app, applies security middleware (helmet and CORS),
     * parses JSON bodies and mounts API routers for database operations and
     * LLM‑powered functionality. It also defines a simple root message and
     * health‑check endpoint and attaches a global error handler. The configured
     * Express instance is exported for use by the server entrypoint.
     */

### `apps/backend/src/server.ts`

    /**
     * Entrypoint for the backend service.
     *
     * Loads environment variables via dotenv, determines the port and runtime
     * environment, starts the Express server exported from `app.ts` and logs
     * startup information. It also listens for process signals to perform
     * graceful shutdown when the application is terminated.
     */

### `apps/backend/src/api/db.ts`

    /**
     * API router for database operations.
     *
     * Defines Express routes to test database connections, create/list/delete
     * saved connections, retrieve a database's schema, run read‑only SQL queries
     * and fetch table metadata, column definitions and preview data. Each
     * endpoint validates its payload using zod schemas and delegates the
     * underlying work to the `DatabaseManager`. Queries are sanitized and
     * validated to ensure they are safe and read‑only. Uses centralized error
     * handling utilities for consistent error responses.
     */

### `apps/backend/src/api/files.ts`

    /**
     * API router for file import operations.
     *
     * Provides endpoints for importing CSV/Excel files as SQLite tables:
     * - POST /import: Combined upload and import with automatic processing
     * - POST /upload: (Deprecated) Legacy endpoint for file preview
     * 
     * Features automatic column type detection, table name generation,
     * batch insertion for performance, and transaction support. Uses multer
     * for file handling and xlsx library for parsing. Creates SQLite databases
     * that integrate seamlessly with the connection management system.
     */

### `apps/backend/src/api/llm.ts`

    /**
     * API router that interfaces with OpenAI to provide AI‑powered SQL and
     * insights.
     *
     * Exposes endpoints to classify user questions into exploratory or specific
     * categories, translate natural language into SQL based on the current
     * database schema, analyze query result sets to generate narrative insights
     * and summarize queries into concise titles for history display. Implements
     * caching to avoid redundant LLM calls, builds dynamic prompts, validates
     * generated SQL via the sanitization utilities and returns structured
     * responses. Uses centralized error handling and common patterns for input
     * sanitization and response validation.
     */

### `apps/backend/src/security/sanitize.ts`

    /**
     * Utilities for SQL sanitization and validation.
     *
     * Provides functions to ensure that a SQL statement is read‑only and free
     * of injection patterns, remove potentially dangerous characters from
     * parameters, detect and mask sensitive columns in query results and
     * limit the number of returned rows to prevent memory exhaustion. Returns
     * descriptive error messages when validation fails.
     */

### `apps/backend/src/security/promptSanitize.ts`

    /**
     * Prompt injection protection for LLM interactions.
     *
     * Provides functions to detect and prevent prompt injection attacks in user
     * input before it reaches language models. Includes pattern detection for
     * various injection techniques while allowing legitimate SQL syntax like
     * backticks (`) and percent signs (%) used in database queries and date
     * formatting. Categorizes inputs by risk level and provides sanitization
     * with configurable strictness modes.
     */

### `apps/backend/src/utils/logger.ts`

    /**
     * Configures the Winston logger for the backend.
     *
     * Exports a logger instance that outputs colorized logs in development and
     * JSON‑formatted logs in production. In production it writes error logs
     * and combined logs to rotating files. Used throughout the backend to
     * provide consistent logging behavior.
     */

### `apps/backend/src/utils/cache.ts`

    /**
     * Simple in‑memory cache used to store expensive LLM results.
     *
     * Implements a map keyed by SHA‑256 hashes of request payloads and stores
     * values alongside an expiration timestamp. Includes helper functions to
     * generate cache keys for classification, SQL generation, analysis and
     * summary tasks, set and retrieve values, and periodically evict expired
     * entries. Exported as a singleton (`llmCache`).
     */

### `apps/backend/src/utils/database.ts`

    /**
     * Singleton `DatabaseManager` class responsible for managing database
     * connections and executing queries.
     *
     * Supports PostgreSQL, SQLite and MySQL drivers. Provides methods to test
     * connectivity, create and delete saved connections, execute sanitized
     * read‑only queries with timing and database‑specific error mapping and
     * inspect database schemas (table names, metadata, column definitions and
     * sample rows). Stores connections in memory and abstracts over driver
     * differences.
     */

### `apps/backend/src/utils/errors.ts`

    /**
     * Centralized error handling utilities for the backend API.
     * 
     * Provides consistent error responses across all endpoints with proper
     * logging, status codes, and user-friendly messages. Handles Zod validation
     * errors, database errors, and generic errors with appropriate HTTP status
     * codes and response formats. Includes connection error guidance for common
     * network and database connectivity issues.
     */

## Frontend

### `apps/frontend/src/App.tsx`

    /**
     * Top‑level React component that orchestrates the DataAsk UI.
     *
     * Manages authentication routing with protected routes for the main
     * application. Renders login/register pages for unauthenticated users
     * and the DataAskApp component for authenticated users. Uses React Router
     * for navigation and AuthProvider for authentication context.
     */

### `apps/frontend/src/main.tsx`

    /**
     * Entry point for the frontend application.
     *
     * Imports global styles and mounts the root `App` component into the DOM.
     * This module is minimal because all logic lives in `App.tsx` and child
     * components.
     */

### `apps/frontend/src/components/DataAskApp.tsx`

    /**
     * Main application component for authenticated users.
     *
     * Manages the three-panel layout with resizable panels using custom hooks.
     * Coordinates state between the schema browser, chat panel, and analysis
     * panel. Handles connection selection, query execution, and result display.
     * Uses the useResizablePanel hook to provide drag-to-resize functionality
     * for both side panels with proper constraints and visual feedback.
     */

### `apps/frontend/src/components/SchemaBrowser.tsx`

    /**
     * Component that displays available database connections and the schema of
     * the selected connection.
     *
     * Fetches the list of saved connections from the backend, allows users to
     * select a connection and, upon selection, retrieves the database schema.
     * Renders a collapsible tree of tables and columns, tracks which tables
     * are expanded and supports dragging items into the chat panel for query
     * generation. Handles loading states and propagates selection events.
     * Includes integrated connection management UI with add/edit/delete actions,
     * panel minimization controls, and user profile/logout functionality.
     */

### `apps/frontend/src/components/ConnectionModal.tsx`

    /**
     * Modal dialog used to add new database connections.
     *
     * Presents a form for connection parameters including:
     * - Basic settings: name, type, host, port, database, username, password, or filename
     * - SSH Tunnel configuration: host, port, username, password/private key authentication
     * - SSL/TLS configuration: SSL mode, certificates, and security settings
     * - Advanced settings: connection and query timeouts
     * 
     * Tests connectivity by calling the backend and, on success, creates a 
     * persistent connection. Provides feedback for connection tests and gracefully 
     * handles errors. Supports multiple database types with conditional fields and
     * collapsible advanced configuration sections for better UX.
     */

### `apps/frontend/src/components/FileImportModal.tsx`

    /**
     * Modal dialog for importing CSV and Excel files as queryable tables.
     *
     * Simplified single-step workflow:
     * - Upload: Drag & drop or file selection with validation
     * - Auto table name generation from filename
     * - Direct import with progress tracking
     * 
     * Integrates with FileDropZone component. Handles file upload and import
     * in a single API call. Creates SQLite tables that appear as regular connections.
     */

### `apps/frontend/src/components/FileDropZone.tsx`

    /**
     * Drag and drop zone component for file uploads.
     *
     * Provides visual feedback for drag operations and validates file types
     * and sizes. Supports both drag & drop and click-to-browse interactions.
     * Displays appropriate icons for different file types and shows error
     * messages for invalid files. Integrates with the file import workflow.
     */

### `apps/frontend/src/components/AddDataModal.tsx`

    /**
     * Combined modal for adding data through file import or database connection.
     *
     * Features tabbed interface with:
     * - File Import tab: Upload CSV/Excel files to create queryable tables
     * - Database Connection tab: Connect to PostgreSQL, MySQL, or SQLite databases
     * 
     * Embeds FileImportModal and ConnectionModal components in a unified interface.
     * Defaults to file import tab for easier data onboarding.
     */

### `apps/frontend/src/components/DataVisualizer.tsx`

    /**
     * Advanced data visualization component for query results.
     *
     * Provides multiple visualization types including tables, charts, and graphs.
     * Features include column sorting, data export, and interactive visualizations.
     * Automatically selects appropriate chart types based on data characteristics.
     */

### `apps/frontend/src/components/TableDetails.tsx`

    /**
     * Panel that shows detailed information about a selected table.
     *
     * Provides tabs for an overview (row count, table size and a list of
     * columns) and a data preview (first rows). Fetches metadata, column
     * definitions and sample rows from the backend when the selected table or
     * active tab changes, displays loading placeholders and resets to an
     * empty state when no table is selected.
     */

### `apps/frontend/src/components/AnalysisPanel.tsx`

    /**
     * Component that presents AI‑generated insights, raw data and visualizations
     * for the current query results.
     *
     * Observes changes to query results and triggers the LLM analysis endpoint
     * to produce narrative insights and chart configurations. Displays summary
     * statistics, AI‑generated text, a data table with copy buttons and a
     * visualization tab that delegates to the `DataVisualizer`. Includes
     * controls to copy insights or data using the copy service.
     */

### `apps/frontend/src/components/DataVisualizer.tsx`

    /**
     * Dynamic charting component that examines query result data and selects
     * an appropriate visualization.
     *
     * Detects date and numeric patterns to choose between bar, line, pie and
     * KPI charts. Processes data into chart-friendly structures, computes
     * additional metrics such as scale ratios, renders the chosen chart with
     * Recharts and provides series visibility toggles and warnings for mixed
     * scales. Exposes a button to copy the chart as an image via the copy
     * service.
     */

### `apps/frontend/src/components/ChatPanel.tsx`

    /**
     * Conversational interface for natural language queries.
     *
     * Maintains a message list containing user prompts and assistant responses,
     * sends user questions to the backend to generate SQL via `/api/llm/sql` and
     * executes the returned SQL via the database API. Provides tabs for the
     * conversation, direct SQL editing and per-connection history, summarizes
     * natural language queries using `/api/llm/summarize`, stores history in
     * local storage and offers copy buttons for SQL and natural language text.
     */

## Services

### `apps/frontend/src/services/copyService.ts`

    /**
     * Shared clipboard utilities for the frontend.
     *
     * Implements a generic `copyToClipboard` that writes text to the system
     * clipboard with user feedback. Provides specialized helpers to copy table
     * data as CSV or TSV, copy AI insights text, copy SQL queries and capture
     * charts as PNG images using `html2canvas`. Returns status objects to
     * inform components of success or failure.
     */

### `apps/frontend/src/services/storage.ts`

    /**
     * Client-side storage service used to persist DataAsk state.
     *
     * Persists database connections (with simple password obfuscation), panel
     * sizes, selected connection, expanded tables and per-connection query
     * history in `localStorage`. Provides methods to save, update and remove
     * connections, update last-used timestamps, record query history, retrieve
     * state with sensible defaults and clear all stored data. Automatically
     * converts stored timestamps into `Date` objects when loading.
     */

### `apps/frontend/src/services/api.ts`

    /**
     * Centralized API service for frontend HTTP requests.
     * 
     * Provides a unified interface for making API calls with consistent error
     * handling, authentication via cookies, and TypeScript type safety. Handles
     * all HTTP methods (GET, POST, PUT, DELETE) and file uploads with automatic
     * JSON parsing and error response formatting. All requests include credentials
     * for cookie-based authentication.
     */

## Hooks

### `apps/frontend/src/hooks/useResizablePanel.ts`

    /**
     * Custom React hook for resizable panel functionality.
     * 
     * Provides drag-to-resize behavior for UI panels with configurable constraints.
     * Handles mouse events, boundary enforcement, and text selection prevention
     * during drag operations. Supports both left and right panel configurations
     * with automatic cleanup of event listeners. Returns panel width, drag state,
     * and mouse event handlers for integration with panel components.
     */

## Electron

### `apps/electron-shell/src/main.ts`

    /**
     * Main process script for the Electron desktop application.
     *
     * Manages the complete lifecycle of the DataAsk desktop application including:
     * - Automatic backend server process management (starts/stops with app)
     * - Creates a browser window with specific dimensions and configuration
     * - Sets Content Security Policy headers to prevent security warnings
     * - Loads the React development server during development or the built
     *   frontend in production
     * - Handles SQLite file operations through IPC channels
     * - Shows the window when ready, logs errors on failed loads and prevents
     *   untrusted navigation
     * - Manages application lifecycle events and restricts external link handling
     *   for security
     * - Gracefully shuts down backend server on app termination
     */

### `apps/electron-shell/src/preload.js`

    /**
     * Preload script executed in Electron's isolated context before the
     * renderer loads.
     *
     * Uses Electron's `contextBridge` to expose a minimal API (`electronAPI`)
     * to the renderer process containing the operating system platform and
     * Electron version. Can be extended with additional secure APIs in the
     * future. Maintains context isolation to prevent privilege escalation.
     */

## Project Structure

```
dataask/
├── apps/
│   ├── backend/           # Node.js Express backend
│   │   ├── src/
│   │   │   ├── api/      # API routes and controllers
│   │   │   ├── security/ # Security utilities
│   │   │   ├── test/     # Test utilities and fixtures
│   │   │   │   └── fixtures/ # Test data files
│   │   │   ├── types/    # TypeScript type definitions
│   │   │   └── utils/    # Utility functions
│   │   └── package.json
│   ├── frontend/          # React TypeScript frontend
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── services/    # API services
│   │   │   ├── types/       # TypeScript types
│   │   │   └── utils/       # Utility functions
│   │   └── package.json
│   └── electron-shell/    # Electron desktop wrapper
├── docker/                # Docker configuration
├── docs/                  # Technical documentation
├── scripts/               # Utility scripts
├── env.example           # Environment template
└── package.json          # Root package configuration
```
