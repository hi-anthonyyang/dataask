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
     * validated to ensure they are safe and read‑only.
     */

### `apps/backend/src/api/files.ts`

    /**
     * API router for file import operations.
     *
     * Provides endpoints for uploading CSV/Excel files, parsing and previewing
     * their contents, and importing them as SQLite tables. Features include:
     * - POST /upload: Handles multipart file uploads with validation
     * - POST /import: Creates SQLite tables from parsed file data
     * 
     * Supports automatic column type detection, data validation, and proper
     * error handling. Uses multer for file handling and xlsx library for
     * Excel parsing. Creates temporary SQLite databases that integrate
     * seamlessly with the existing connection management system.
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
     * responses.
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

## Frontend

### `apps/frontend/src/App.tsx`

    /**
     * Top‑level React component that orchestrates the DataAsk UI.
     *
     * Manages global state such as the currently selected database connection,
     * the active SQL query and its results, and the sizes of the resizable
     * panels. Renders the `SchemaBrowser`, `ChatPanel`, `AnalysisPanel` and
     * `TableDetails` components within a three‑panel layout and handles
     * connection selection, panel resizing and query execution events. Loads
     * existing connections from local storage on mount.
     */

### `apps/frontend/src/main.tsx`

    /**
     * Entry point for the frontend application.
     *
     * Imports global styles and mounts the root `App` component into the DOM.
     * This module is minimal because all logic lives in `App.tsx` and child
     * components.
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
     * Provides a multi-step workflow:
     * - Upload: Drag & drop or file selection with validation
     * - Preview: Display parsed data with auto-detected column types
     * - Configure: Edit table name and adjust column types before import
     * 
     * Integrates with FileDropZone, DataPreview, and ColumnTypeEditor components.
     * Handles file upload, parsing, type detection, and table creation via the
     * backend API. Creates SQLite tables that appear as regular connections.
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

### `apps/frontend/src/components/DataPreview.tsx`

    /**
     * Component for previewing imported file data before table creation.
     *
     * Displays file metadata (name, row count, column count), shows detected
     * column types with color coding, and renders a scrollable table preview
     * of the first 10 rows. Provides visual feedback for data quality and
     * structure to help users verify their import before proceeding.
     */

### `apps/frontend/src/components/ColumnTypeEditor.tsx`

    /**
     * Component for editing column names and types during file import.
     *
     * Allows users to modify auto-detected column names and types before
     * table creation. Provides dropdowns for type selection (Text, Integer,
     * Number, Date) with visual indicators and sample values. Includes
     * explanatory information about each data type.
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

## Electron

### `apps/electron-shell/src/main.ts`

    /**
     * Main process script for the Electron desktop application.
     *
     * Creates a browser window with specific dimensions and configuration,
     * loads the React development server during development or the built
     * frontend in production, shows the window when ready, logs errors on
     * failed loads and prevents untrusted navigation. Handles application
     * lifecycle events such as activation and window closure and restricts
     * external link handling for security.
     */

### `apps/electron-shell/src/preload.js`

    /**
     * Preload script executed in Electron’s isolated context before the
     * renderer loads.
     *
     * Uses Electron's `contextBridge` to expose a minimal API (`electronAPI`)
     * to the renderer process containing the operating system platform and
     * Electron version. Can be extended with additional secure APIs in the
     * future. Maintains context isolation to prevent privilege escalation.
     */
