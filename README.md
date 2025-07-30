# DataAsk repository architecture

DataAsk is an AI‑native SQL analysis tool. The project is organized as a monorepo with distinct backend, frontend and desktop applications plus shared infrastructure. This document explains the architecture and key modules to aid large‑language‑model agents in navigating, testing and extending the codebase.

## Repository structure

* `apps/backend/` – Node.js/TypeScript Express server providing API endpoints for database management and LLM‑powered analysis.
* `apps/frontend/` – React/TypeScript single‑page application with a three‑panel interface for exploring schemas, running queries and visualizing results.
* `apps/electron-shell/` – Electron wrapper that packages the frontend into a desktop app.
* `docker/` – Docker Compose configuration and seed data for local databases.
* `packages/` – placeholder for shared code (currently empty).
* `docs/` – documentation.

### Backend architecture

The backend is built with Express. The entry point (`app.ts`) initializes the Express app, sets security middleware like helmet and cors, mounts API routers for database and LLM functions and defines root/health endpoints with a global error handler. `server.ts` reads environment variables, configures the listening port and starts the server with graceful shutdown handling.

#### Database API

**Authentication (Optional)**: The system now includes optional user authentication with JWT tokens. Users can create accounts for cross-device sync while maintaining privacy-first principles. All existing localStorage functionality remains unchanged.

Routes under `/api/db` are defined in `api/db.ts`. They expose operations to test a database connection, create/list/delete connections, retrieve a connection’s schema, run read‑only SQL queries and get table metadata/columns/preview data. The route for executing queries validates that generated SQL is read‑only and safe using the sanitization utilities.

Database connections are handled by a `DatabaseManager` class in `utils/database.ts`. It creates, stores and removes connections for PostgreSQL, SQLite and MySQL, executes sanitized queries with timing and error mapping, and exposes methods to fetch schema information such as table metadata and columns.

Security is critical. The `security/sanitize.ts` module validates that a SQL statement is read‑only (no writes, multiple statements or injection patterns), sanitizes parameters and limits result size. Logging is configured via a Winston logger that uses different formats for development and production. An in‑memory cache (`utils/cache.ts`) stores results from expensive LLM operations using hashed keys and TTL to reduce costs.

#### LLM API

The `/api/llm` router (`api/llm.ts`) provides AI‑powered functions. It classifies natural language queries, generates SQL from plain English using OpenAI, analyzes query result sets to produce narrative insights and summarizes queries for history titles. Dynamic prompts incorporate database schemas and security rules, and outputs are validated using the sanitization layer. The module uses the shared LLM cache to avoid recomputing identical requests.

### Frontend architecture

The frontend is a React SPA written in TypeScript. The top‑level component (`App.tsx`) manages global state (selected connection, query text and results, panel sizes) and renders a three‑panel layout: a schema browser on the left, an analysis panel below and a chat/SQL panel on the right. It loads available connections when the app mounts.

#### Components

* **SchemaBrowser** (`SchemaBrowser.tsx`) – displays the list of database connections and, for the selected connection, a collapsible tree of tables and columns; loads schemas via API calls and tracks which tables are expanded.
* **ConnectionModal** (`ConnectionModal.tsx`) – modal dialog that collects connection parameters (host, port, database, username, password or SQLite filename), tests connectivity and creates new connections using backend endpoints.
* **TableDetails** (`TableDetails.tsx`) – when a table is selected, fetches and displays metadata (row counts, size), column list and a preview of the first rows with tabs for overview and preview.
* **AnalysisPanel** (`AnalysisPanel.tsx`) – shows AI‑generated insights, raw data and charts for the current query result; triggers analysis by calling `/api/llm/analyze`, and uses the copy service to copy data or insights to clipboard.
* **DataVisualizer** (`DataVisualizer.tsx`) – inspects the result set to choose an appropriate visualization (bar, line, pie or KPI), processes data accordingly, provides controls to toggle series and warns about mixed scales. Charts are rendered with Recharts and can be copied as an image via the copy service.
* **ChatPanel** (`ChatPanel.tsx`) – conversational interface where users type natural language questions. It sends queries to `/api/llm/sql` to generate SQL, executes the SQL via the database API, and displays both the assistant’s messages and user input. The panel also offers a tab to edit SQL directly and a history tab that stores past queries in local storage. It summarizes natural language queries into short titles using `/api/llm/summarize` and provides copy buttons for SQL and natural language queries.

#### Services & utilities

* **copyService.ts** – exposes functions to copy text to the clipboard with user feedback; includes helpers to copy tables as CSV/TSV, copy insights text, copy SQL queries and capture chart images.
* **storage.ts** – simple client‑side persistence layer that stores connections (encrypting passwords), panel sizes, expanded tables and query history in `localStorage`, with helper methods to add/update connections and manage history.
* **auth.ts** – authentication service for user accounts with JWT token management, registration/login flows, and automatic token refresh.
* **userConnections.ts** – service for managing user connections stored server-side, with optional migration from localStorage for cross-device sync.

### Electron shell

The electron shell (`apps/electron-shell`) wraps the frontend into a desktop application. The main process (`main.ts`) creates a browser window with a preload script, loads the React dev server in development or the built frontend in production, and restricts navigation to external sites. The preload script (`preload.js`) exposes a minimal API (platform and version) to the renderer and maintains context isolation for security.

### Development environment

Docker Compose spins up PostgreSQL and MySQL containers with initial sample data and an optional pgAdmin instance for development. Scripts in `docker/seed` insert sample customers, products, orders and order items to enable realistic queries. The top‑level `README.md` in the repository contains installation and development instructions with `npm` scripts for running backend, frontend or electron individually and for starting/stopping Docker containers.

---

This architecture description is intended to help LLM agents navigate the codebase. When modifying or testing the system, pay attention to the strict read‑only constraints enforced by the backend, validate SQL through the `sanitize` module, and maintain consistency between the database and LLM layers.

For detailed module‑level docstrings, see [DOCSTRINGS.md](./DOCSTRINGS.md).
