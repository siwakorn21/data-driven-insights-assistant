# 🚀 Data-Driven Insights Assistant

> An AI-powered data analysis platform that transforms natural language questions into SQL queries and visualizations.

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.11-green.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green.svg)](https://fastapi.tiangolo.com/)
[![DuckDB](https://img.shields.io/badge/DuckDB-0.9-yellow.svg)](https://duckdb.org/)

---

## 📖 Table of Contents

- [Demo](#-demo)
- [Overview](#-overview)
- [Project Highlights](#-project-highlights)
- [Architecture](#%EF%B8%8F-architecture)
- [Quick Start](#-quick-start)
- [Usage Examples](#-usage-examples)
- [API Documentation](#-api-documentation)
- [Technical Stack](#-technology-stack)
- [Key Design Decisions](#-key-design-decisions)
- [Project Structure](#-project-structure)
- [Documentation](#-documentation)
- [Development](#%EF%B8%8F-development)

---

## 🎥 Demo

### Live Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs (Interactive API documentation)
- **ReDoc**: http://localhost:8000/redoc (Alternative API documentation)

### Demo Workflow

1. **Upload CSV** → Application automatically infers schema and displays data preview
2. **Ask Questions** → "Top 3 hotels by revenue" (natural language)
3. **Get Results** → AI generates SQL, executes query, shows results in table and charts
4. **Conversational** → Say "Hello" to get helpful suggestions instead of queries

**Example Interaction:**
```
User: "Top 5 hotels by revenue"
AI:   Generates → SELECT * FROM "data" ORDER BY "revenue" DESC LIMIT 5
      Executes → Returns data + bar chart visualization
```

---

## 📖 Overview

Data-Driven Insights Assistant is a production-ready full-stack application that enables non-technical users to analyze CSV data through natural language queries. Built with modern technologies and best practices, it showcases enterprise-grade architecture suitable for Agoda's data-driven environment.

### ✨ Key Features

- **🤖 AI-Powered Query Generation**: Natural language to SQL using OpenAI GPT models
- **💰 Production-Scale Query Routing**: Intelligent cost optimization (78% savings)
  - Simple queries → Template-based (free, instant)
  - Medium queries → GPT-3.5-turbo ($0.001/query)
  - Complex queries → GPT-4 ($0.024/query)
- **📊 Automatic Visualizations**: Smart chart selection (bar/line) based on data types
- **🔍 Live Data Preview**: First 50 rows displayed immediately after upload
- **💬 Conversational AI**: Recognizes greetings and provides contextual help
- **🎯 Intelligent Clarifications**: Asks follow-up questions for ambiguous queries
- **📥 Export Results**: Download query results as CSV
- **🔒 Secure Sessions**: UUID-based isolation with automatic cleanup (2-hour TTL)
- **📚 Interactive API Docs**: Swagger UI and ReDoc for testing and exploring APIs
- **⚡ Real-time Updates**: Hot-reload in development mode
- **🎨 Modern UI**: Responsive design with Tailwind CSS and Framer Motion

---

## 🏆 Project Highlights

### Why This Architecture?

**Problem**: Users need to analyze data quickly without SQL knowledge, but client-side solutions don't scale.

**Solution**: Full-stack architecture with intelligent backend processing.

### Performance Considerations

- **DuckDB** over in-memory databases → Handles large CSVs efficiently
- **Session management** → Automatic cleanup prevents storage bloat
- **Lazy loading** → Only fetch necessary data (50-row preview, pagination)
- **Smart caching** → Schema inference cached per session

---

## 🏗️ Architecture

### System Design

```
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Components:                                               │  │
│  │  • Chat Interface with Message History                     │  │
│  │  • CSV Upload with Validation                              │  │
│  │  • Data Preview Table (50 rows)                            │  │
│  │  • Dynamic Chart Rendering (Bar/Line)                      │  │
│  │  • Query Result Table with Export                          │  │
│  │  • SQL Editor with Syntax Highlighting                     │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ REST API (JSON)
┌────────────────────────────┴─────────────────────────────────────┐
│                    Backend (FastAPI + DuckDB)                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  API Layer (FastAPI Routers):                              │  │
│  │  • POST /api/upload         → Upload CSV, create session   │  │
│  │  • GET  /api/sessions/{id}  → Get schema & metadata        │  │
│  │  • POST /api/query          → NL → SQL → Execute           │  │
│  │  • POST /api/execute-sql    → Direct SQL execution         │  │
│  │  • GET  /api/health         → Health check                 │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  Service Layer:                                             │  │
│  │  • LLMService      → OpenAI integration, intelligent routing│  │
│  │  • QueryRouter     → Cost optimization, complexity analysis │  │
│  │  • DuckDBService   → Query execution, schema inference     │  │
│  │  • SessionService  → File management, cleanup scheduler    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Background Tasks: APScheduler → Cleanup expired sessions        │
└───────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

#### 1. CSV Upload Flow

```
┌─────────┐                                                    ┌─────────────┐
│  User   │                                                    │   Backend   │
└────┬────┘                                                    └──────┬──────┘
     │                                                                │
     │  1. Upload CSV File (multipart/form-data)                     │
     ├──────────────────────────────────────────────────────────────>│
     │                                                                │
     │                    2. Validate file size/type                 │
     │                    3. Generate UUID session_id                │
     │                    4. Save to uploads/{session_id}.csv        │
     │                                                                │
     │                    ┌─────────────────────┐                    │
     │                    │   DuckDB Service    │                    │
     │                    │  ┌───────────────┐  │                    │
     │                    │  │ DESCRIBE CSV  │  │                    │
     │                    │  │ Get row count │  │                    │
     │                    │  │ Infer schema  │  │                    │
     │                    │  │ Extract samples│ │                    │
     │                    │  └───────────────┘  │                    │
     │                    └─────────────────────┘                    │
     │                                                                │
     │  5. Return session metadata                                   │
     │  {session_id, filename, rows, columns}                        │
     │<──────────────────────────────────────────────────────────────┤
     │                                                                │
     │  6. Fetch preview data (first 50 rows)                        │
     ├──────────────────────────────────────────────────────────────>│
     │                                                                │
     │                    7. SELECT * LIMIT 50                        │
     │                                                                │
     │  8. Return preview data                                        │
     │<──────────────────────────────────────────────────────────────┤
     │                                                                │
     │  9. Display data preview in UI                                │
     │                                                                │
```

#### 2. Natural Language Query Flow

```
┌─────────┐                  ┌─────────────┐                  ┌──────────┐
│  User   │                  │   Backend   │                  │  OpenAI  │
└────┬────┘                  └──────┬──────┘                  └────┬─────┘
     │                              │                               │
     │  1. Type question:           │                               │
     │     "Top 5 hotels by revenue"│                               │
     ├─────────────────────────────>│                               │
     │                              │                               │
     │                              │  2. Get CSV schema            │
     │                              │     (columns, types, samples) │
     │                              │                               │
     │                              │  3. Build prompt with schema  │
     │                              ├──────────────────────────────>│
     │                              │     + user question           │
     │                              │                               │
     │                              │                               │
     │                              │  4. GPT-4 generates SQL       │
     │                              │     + explanation             │
     │                              │<──────────────────────────────┤
     │                              │                               │
     │                ┌─────────────┴──────────────┐                │
     │                │     DuckDB Service         │                │
     │                │  ┌──────────────────────┐  │                │
     │                │  │ CREATE VIEW "data"   │  │                │
     │                │  │ Execute SQL query    │  │                │
     │                │  │ Fetch results        │  │                │
     │                │  │ Convert numpy types  │  │                │
     │                │  └──────────────────────┘  │                │
     │                └────────────────────────────┘                │
     │                              │                               │
     │  5. Return query results:    │                               │
     │     {sql, columns, rows,     │                               │
     │      explanation}            │                               │
     │<─────────────────────────────┤                               │
     │                              │                               │
     │  6. Render results:          │                               │
     │     • Display SQL            │                               │
     │     • Show data table        │                               │
     │     • Auto-generate chart    │                               │
     │       (bar/line based on     │                               │
     │        data types)           │                               │
     │                              │                               │
```

#### 3. Conversational AI Flow

```
┌─────────┐                  ┌─────────────┐                  ┌──────────┐
│  User   │                  │   Backend   │                  │  OpenAI  │
└────┬────┘                  └──────┬──────┘                  └────┬─────┘
     │                              │                               │
     │  1. Send greeting: "Hello"   │                               │
     ├─────────────────────────────>│                               │
     │                              │                               │
     │                              │  2. Detect conversation       │
     │                              │     (not a data query)        │
     │                              ├──────────────────────────────>│
     │                              │                               │
     │                              │  3. GPT-4 returns friendly    │
     │                              │     response with suggestions │
     │                              │     (sql: null)               │
     │                              │<──────────────────────────────┤
     │                              │                               │
     │  4. Return conversational    │                               │
     │     response without         │                               │
     │     executing SQL            │                               │
     │<─────────────────────────────┤                               │
     │                              │                               │
     │  5. Display friendly message │                               │
     │     with query suggestions   │                               │
     │                              │                               │
```

#### 4. Session Management Flow

```
┌──────────────────┐              ┌─────────────────────┐
│  Session Service │              │   APScheduler       │
└────────┬─────────┘              └──────────┬──────────┘
         │                                   │
         │  Application Startup              │
         │  • Load existing sessions         │
         │  • Calculate expiration times     │
         │                                   │
         │                                   │  Every 1 hour:
         │                                   │  Check for expired sessions
         │<──────────────────────────────────┤
         │                                   │
         │  Find sessions older than 2 hours │
         │  (created_at + 2h < now)          │
         │                                   │
         │  For each expired session:        │
         │  1. Delete CSV file               │
         │  2. Remove from active sessions   │
         │  3. Log cleanup action            │
         │                                   │
         │  Cleanup complete                 │
         ├──────────────────────────────────>│
         │                                   │
         │                                   │  Continue monitoring...
         │                                   │
```

#### 5. Complete Request-Response Cycle

```
     User Action                  Backend Processing              External Services
         │                              │                               │
         │  Upload CSV                  │                               │
         ├─────────────────────────────>│                               │
         │                              │ Save file + Create session    │
         │                              │ DuckDB: Infer schema          │
         │                              │                               │
         │<─────────────────────────────┤ Return session_id             │
         │                              │                               │
         │                              │                               │
         │  Ask Question                │                               │
         ├─────────────────────────────>│                               │
         │                              │ Get schema from DuckDB        │
         │                              │                               │
         │                              │ Send to OpenAI                │
         │                              ├──────────────────────────────>│
         │                              │                               │
         │                              │         GPT-4 generates SQL   │
         │                              │<──────────────────────────────┤
         │                              │                               │
         │                              │ Execute SQL in DuckDB         │
         │                              │ Convert results to JSON       │
         │                              │                               │
         │<─────────────────────────────┤ Return data + visualization   │
         │                              │                               │
         │  Display Results             │                               │
         │  • Show data table           │                               │
         │  • Render chart              │                               │
         │  • Allow SQL editing         │                               │
         │                              │                               │
         │                              │                               │
         │  (2 hours later...)          │                               │
         │                              │                               │
         │                              │ APScheduler: Cleanup trigger  │
         │                              │ Delete expired session files  │
         │                              │                               │
```

#### 6. Intelligent Model Selection Flow (Production-Scale Routing)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         User Query: "show all"                              │
│                   "Top 5 hotels by revenue last month"                      │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   QueryRouter.route   │
                    │  (Complexity Analysis) │
                    └───────────┬───────────┘
                                │
                                ▼
            ┌───────────────────────────────────────┐
            │  QueryComplexityAnalyzer.analyze()    │
            │                                       │
            │  1. Word count                        │
            │  2. Pattern matching:                 │
            │     • Date/time keywords              │
            │     • Multiple aggregations           │
            │     • Subqueries, JOINs               │
            │  3. Column name awareness             │
            └───────────────┬───────────────────────┘
                            │
                ┌───────────┴───────────┐
                │   Complexity Level     │
                └───┬───────────┬───────┬┘
                    │           │       │
        ┌───────────▼─┐   ┌────▼────┐  ┌▼─────────┐
        │   SIMPLE    │   │  MEDIUM │  │ COMPLEX  │
        │ (3 words or │   │ (single │  │(date/time│
        │  template   │   │  aggr,  │  │multiple  │
        │  patterns)  │   │ filter) │  │patterns) │
        └──────┬──────┘   └────┬────┘  └────┬─────┘
               │               │            │
               ▼               ▼            ▼
    ┌──────────────────┐  ┌──────────┐  ┌──────────┐
    │ Template Matcher │  │ GPT-3.5  │  │  GPT-4   │
    │                  │  │ -turbo   │  │          │
    │ Pattern: "show"  │  │          │  │          │
    │ Pattern: "count" │  │ $0.001/  │  │ $0.024/  │
    │ Pattern: "first" │  │  query   │  │  query   │
    │                  │  │          │  │          │
    │ Cost: FREE       │  │          │  │          │
    │ Time: <10ms      │  │ Time:1-2s│  │ Time:2-5s│
    └────────┬─────────┘  └─────┬────┘  └─────┬────┘
             │                  │             │
             │                  │             │
             └──────────────────┴─────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Generate SQL        │
                    │   + Explanation       │
                    │   + Routing Metadata  │
                    └───────────┬───────────┘
                                │
                                ▼
            ┌───────────────────────────────────────┐
            │          Response Format              │
            │  {                                    │
            │    "sql": "SELECT * ...",             │
            │    "explanation": "...",              │
            │    "routing": {                       │
            │      "strategy": "template",          │
            │      "complexity": "simple",          │
            │      "reason": "Matches template",    │
            │      "model": null                    │
            │    }                                  │
            │  }                                    │
            └───────────────────────────────────────┘
```

**Query Examples by Routing:**

| Query | Complexity | Route | Cost | Reason |
|-------|-----------|-------|------|---------|
| "show all" | SIMPLE | Template | $0 | Matches template pattern |
| "count" | SIMPLE | Template | $0 | Matches template pattern |
| "first 10 rows" | SIMPLE | Template | $0 | Matches template with parameter |
| "average rating by country" | MEDIUM | GPT-3.5 | $0.001 | Single aggregation + grouping |
| "top 5 hotels by revenue" | MEDIUM | GPT-3.5 | $0.001 | Single sort + limit |
| "Top 5 hotels by revenue last month" | COMPLEX | GPT-4 | $0.024 | Contains date/time reference |
| "hotels with revenue above median and rating > 4.5" | COMPLEX | GPT-4 | $0.024 | Multiple conditions + subquery |

**Cost Savings Example:**

```
1000 queries/day distribution:
- 300 simple (templates)    → $0.00
- 500 medium (GPT-3.5)      → $0.50
- 200 complex (GPT-4)       → $4.80
                     Total  → $5.30/day

Without routing (all GPT-4) → $24.00/day
Savings: 78% ($18.70/day)
```

---

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **OpenAI API Key** ([Get one](https://platform.openai.com/api-keys))
- **Available Ports**: 8000, 5173

### Setup (3 Steps)

```bash
# 1. Clone and navigate
git clone <repository-url>
cd data-driven-insight-assistant-agoda

# 2. Configure environment
cp .env.example .env
# Edit .env and add: OPENAI_API_KEY=sk-your-key-here

# 3. Start services
docker-compose -f docker-compose.dev.yml up
```

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Main application UI |
| Backend | http://localhost:8000 | API server |
| API Docs | http://localhost:8000/docs | Interactive Swagger UI |

### Test It Out

1. Open http://localhost:5173
2. Upload `examples/test_data.csv`
3. Try: **"Top 3 hotels by revenue"**
4. View table + chart results

---

## 📊 Usage Examples

### Natural Language Queries

| Query | Generated SQL | Visualization |
|-------|---------------|---------------|
| "Top 5 hotels by revenue" | `SELECT * FROM "data" ORDER BY "revenue" DESC LIMIT 5` | Bar chart |
| "Average rating by country" | `SELECT "country", AVG("rating") FROM "data" GROUP BY "country"` | Bar chart |
| "Count bookings per country" | `SELECT "country", COUNT(*) FROM "data" GROUP BY "country"` | Bar chart |
| "Show all data" | `SELECT * FROM "data" LIMIT 50` | Table only |

### Conversational AI

```
User: "Hello"
AI:   "Hello! I'm here to help you analyze your data. 
       You can ask me questions like:
       • Top 5 hotels by revenue
       • Average rating by country
       • Count of bookings
       
       What would you like to know about your data?"
```

### Sample Data

```csv
hotel,revenue,country,rating,bookings
Hotel A,50000,USA,4.5,120
Hotel B,75000,UK,4.8,200
Hotel C,30000,France,4.2,80
Hotel D,95000,USA,4.9,250
Hotel E,45000,Germany,4.3,100
```

---

## 📚 API Documentation

The backend provides **interactive API documentation** powered by OpenAPI (Swagger):

### Swagger UI (http://localhost:8000/docs)

Full-featured interactive documentation where you can:
- **Explore all endpoints** - View request/response schemas for all 6 API endpoints
- **Try it out** - Execute API calls directly from the browser
- **See examples** - View sample requests and responses
- **Test authentication** - No authentication required for this demo
- **Download OpenAPI spec** - Export as JSON/YAML for client generation

### ReDoc (http://localhost:8000/redoc)

Alternative documentation interface with:
- **Clean, responsive design** - Better for reading and sharing
- **Search functionality** - Quickly find endpoints
- **Code samples** - Multiple language examples
- **Nested schemas** - Clear data model visualization

### Features

✅ **Auto-generated** - FastAPI automatically creates docs from code
✅ **Always up-to-date** - Documentation syncs with code changes
✅ **Request validation** - Shows required fields, types, constraints
✅ **Response examples** - See exactly what each endpoint returns
✅ **Error codes** - Documented HTTP status codes and error messages
✅ **Type information** - Full Pydantic model schemas displayed

### Example Use Cases

**For Developers:**
- Test endpoints without writing code
- Understand request/response formats
- Debug API integration issues
- Generate client SDKs using OpenAPI spec

**For Interviewers:**
- Explore API capabilities interactively
- Verify endpoint functionality
- See request/response examples
- Test error handling

### API Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with DuckDB version |
| `/api/upload` | POST | Upload CSV and create session |
| `/api/sessions/{id}/schema` | GET | Get table schema with samples |
| `/api/query` | POST | Natural language to SQL query |
| `/api/execute-sql` | POST | Execute raw SQL query |
| `/api/sessions/{id}` | DELETE | Delete session and cleanup |

See [backend/README.md](backend/README.md) for detailed request/response examples.

---

## 🔧 Technology Stack

### Backend
| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **FastAPI** | Web framework | Modern, fast, async support, auto-docs |
| **DuckDB** | Query engine | Embedded, fast CSV querying, no memory load |
| **OpenAI GPT-4** | NL to SQL | 95%+ SQL accuracy, superior reasoning for complex queries (see [analysis](docs/IMPLEMENTATION_SUMMARY.md#why-gpt-4-over-other-models)) |
| **Pydantic** | Validation | Type safety, automatic validation, clear errors |
| **APScheduler** | Background tasks | Session cleanup, scheduled jobs |
| **Uvicorn** | ASGI server | High performance, async support |

### Frontend
| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **React 18** | UI framework | Component reusability, virtual DOM |
| **TypeScript** | Type safety | Catch errors at compile time |
| **Vite** | Build tool | Fast HMR, optimized builds |
| **TailwindCSS** | Styling | Utility-first, responsive design |
| **Recharts** | Visualization | Declarative charts, D3-based |
| **Framer Motion** | Animations | Smooth transitions, engaging UX |

### Infrastructure
| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **Docker** | Containerization | Consistent environments, easy deployment |
| **Docker Compose** | Orchestration | Multi-service management |
| **Nginx** | Web server | Production-grade static file serving |

---

## 🎯 Key Design Decisions

### 1. **DuckDB over SQLite**
- **Rationale**: DuckDB reads CSV directly without importing, better for analytical queries
- **Benefit**: Faster uploads, lower memory usage, better performance on large files

### 2. **Backend SQL Generation**
- **Rationale**: Security (API key protection), better control, server-side validation
- **Alternative Rejected**: Client-side with sql.js (security risk, limited scalability)

### 3. **Session-based Architecture**
- **Rationale**: Multi-user support, isolation, automatic cleanup
- **Implementation**: UUID sessions, 2-hour TTL, background scheduler

### 4. **Pydantic Models Throughout**
- **Rationale**: Type safety, validation, OpenAPI auto-generation
- **Benefit**: Fewer bugs, better documentation, client SDKs possible

### 5. **Separation of Concerns**
- **Routers**: HTTP request handling
- **Services**: Business logic
- **Models**: Data validation
- **Rationale**: Testability, maintainability, scalability

### 6. **Intelligent Query Routing (Production-Scale)**
- **Implementation**: Automatic routing based on query complexity
  - **Simple queries** → Template-based generation (free, instant)
  - **Medium queries** → GPT-3.5-turbo ($0.001 per query)
  - **Complex queries** → GPT-4 ($0.024 per query)
- **Results**: 78% cost savings vs. GPT-4 only ($5.30 vs $24 per 1000 queries)
- **Complexity Analysis**: Pattern-based detection for:
  - Date/time operations (always routed to GPT-4 for better clarification)
  - Multiple aggregations and joins
  - Subqueries and window functions
- **Rationale**: Balances cost efficiency with quality - GPT-4 reserved for queries requiring superior reasoning
- **See**: [Production Scale Guide](docs/PRODUCTION_SCALE.md)

---

## 📁 Project Structure

```
.
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── routers/           # API endpoints (health, upload, query)
│   │   ├── services/          # Business logic (LLM, DuckDB, session, query router)
│   │   ├── models.py          # Pydantic models
│   │   ├── config.py          # Settings (env vars, constants)
│   │   └── main.py            # FastAPI app + CORS + scheduler
│   ├── uploads/               # Session CSV files (gitignored)
│   ├── Dockerfile             # Production image (smaller)
│   ├── Dockerfile.dev         # Dev image (hot-reload)
│   └── requirements.txt       # Python dependencies
│
├── src/                       # React application
│   ├── api/                   # API client (fetch wrapper)
│   ├── components/ui/         # Reusable UI components
│   ├── config/                # Constants (colors, messages)
│   ├── types/                 # TypeScript interfaces
│   ├── App.tsx                # Main component (state + UI)
│   └── main.tsx               # Entry point + CSS
│
├── docker/                    # Docker configs
│   ├── Dockerfile             # Frontend production (Nginx)
│   └── Dockerfile.dev         # Frontend dev (Vite server)
│
├── docs/                      # Documentation
│   ├── DEPLOYMENT.md          # CI/CD and deployment guide
│   ├── DOCKER_SETUP.md        # Docker configuration
│   ├── TESTING_GUIDE.md       # Test instructions
│   ├── PRODUCTION_SCALE.md    # Intelligent query routing guide
│   └── IMPLEMENTATION_SUMMARY.md  # Architecture details
│
├── examples/                  # Sample data
│   └── test_data.csv          # Demo CSV
│
├── scripts/                   # Deployment scripts
│   └── deploy.sh              # Production deployment script
│
├── .gitlab-ci.yml             # GitLab CI/CD pipeline configuration
├── .gitleaks.toml             # Secret scanning configuration
├── docker-compose.dev.yml     # Dev environment (hot-reload)
├── docker-compose.prod.yml    # Production environment
├── docker-compose.yml         # All services
├── .env.example               # Env template
└── README.md                  # This file
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Production Scale](docs/PRODUCTION_SCALE.md) | Intelligent query routing with 78% cost savings |
| [Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md) | Technical architecture + implementation phases |
| [Docker Setup](docs/DOCKER_SETUP.md) | Detailed Docker configuration guide |
| [Testing Guide](docs/TESTING_GUIDE.md) | Comprehensive test scenarios + expected results |
| [Deployment Guide](docs/DEPLOYMENT.md) | CI/CD pipeline setup and production deployment |

---

## 🛠️ Development

### Running Locally

```bash
# Development mode (hot-reload)
docker-compose -f docker-compose.dev.yml up

# Production mode
docker-compose -f docker-compose.prod.yml up --build -d

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Development Workflow

1. **Backend changes**: Auto-reload (Uvicorn watchfiles)
2. **Frontend changes**: HMR (Vite hot module replacement)
3. **View logs**: `docker-compose logs -f [service-name]`
4. **Backend logs**: `docker logs data-insight-backend-dev`

### Testing

```bash
# API health check
curl http://localhost:8000/api/health

# Upload test CSV
curl -X POST http://localhost:8000/api/upload \
  -F "file=@examples/test_data.csv"

# Full test suite
cd docs && cat TESTING_GUIDE.md  # Follow guide
```

### Environment Variables

```env
# Required
OPENAI_API_KEY=sk-your-key-here

# Optional (defaults shown)
ENABLE_QUERY_ROUTING=true  # Intelligent routing for cost optimization
SESSION_TTL_HOURS=2
MAX_FILE_SIZE_MB=100
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
VITE_API_URL=http://localhost:8000
```

---

## 🤝 Contributing

This project was created as an interview assignment. Feedback and suggestions are welcome!

---

## 📝 License

This project is for educational and interview purposes.

---

## 👤 Author

**Created for Agoda Interview Process**

Built with ❤️ using modern web technologies and best practices.

---

## 🙏 Acknowledgments

- **OpenAI** for GPT-4 API
- **FastAPI** community for excellent framework
- **DuckDB** team for powerful embedded database
- **React** and **Vite** teams for amazing developer experience

---

**⭐ If you find this project interesting, please star it!**

---

*Last Updated: November 2024*
