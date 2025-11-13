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
- **API Docs**: http://localhost:8000/docs (Interactive Swagger UI)

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

- **🤖 AI-Powered Query Generation**: Natural language to SQL using OpenAI GPT-4
- **📊 Automatic Visualizations**: Smart chart selection (bar/line) based on data types
- **🔍 Live Data Preview**: First 50 rows displayed immediately after upload
- **💬 Conversational AI**: Recognizes greetings and provides contextual help
- **🎯 Intelligent Clarifications**: Asks follow-up questions for ambiguous queries
- **📥 Export Results**: Download query results as CSV
- **🔒 Secure Sessions**: UUID-based isolation with automatic cleanup (2-hour TTL)
- **⚡ Real-time Updates**: Hot-reload in development mode
- **🎨 Modern UI**: Responsive design with Tailwind CSS and Framer Motion

---

## 🏆 Project Highlights

### Why This Architecture?

**Problem**: Users need to analyze data quickly without SQL knowledge, but client-side solutions don't scale.

**Solution**: Full-stack architecture with intelligent backend processing.

### Technical Achievements

✅ **Scalable Backend**: DuckDB processes CSV files directly without loading into memory  
✅ **Type Safety**: Full TypeScript frontend + Pydantic backend validation  
✅ **Security First**: API keys never exposed to client, session isolation  
✅ **Production Ready**: Docker containerization, environment configs, error handling  
✅ **Clean Code**: Separation of concerns, service layer pattern, clear project structure  
✅ **Developer Experience**: Hot-reload, comprehensive logging, API documentation  

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
│  │  • LLMService      → OpenAI integration, prompt engineering │  │
│  │  • DuckDBService   → Query execution, schema inference     │  │
│  │  • SessionService  → File management, cleanup scheduler    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Background Tasks: APScheduler → Cleanup expired sessions        │
└───────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Upload CSV → Saved to uploads/ → UUID session created
2. Schema inference → DuckDB DESCRIBE → Column types + samples
3. User query → LLM (GPT-4) → SQL generation
4. SQL validation → DuckDB execution → Results
5. Auto-charting → Detect X/Y columns → Render visualization
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

## 🔧 Technology Stack

### Backend
| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **FastAPI** | Web framework | Modern, fast, async support, auto-docs |
| **DuckDB** | Query engine | Embedded, fast CSV querying, no memory load |
| **OpenAI GPT-4** | NL to SQL | State-of-the-art language understanding |
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

---

## 📁 Project Structure

```
.
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── routers/           # API endpoints (health, upload, query)
│   │   ├── services/          # Business logic (LLM, DuckDB, session)
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
│   ├── DOCKER_SETUP.md        # Docker guide
│   ├── TESTING_GUIDE.md       # Test instructions
│   └── IMPLEMENTATION_SUMMARY.md  # Architecture details
│
├── examples/                  # Sample data
│   └── test_data.csv          # Demo CSV
│
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
| [Docker Setup](docs/DOCKER_SETUP.md) | Detailed Docker configuration guide |
| [Testing Guide](docs/TESTING_GUIDE.md) | Comprehensive test scenarios + expected results |
| [Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md) | Technical architecture + implementation phases |

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
SESSION_TTL_HOURS=2
MAX_FILE_SIZE_MB=100
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
VITE_API_URL=http://localhost:8000
```

---

## 🔒 Security Features

✅ **API Key Protection**: Never exposed to frontend, backend-only  
✅ **Session Isolation**: UUID-based, each user has separate data space  
✅ **Auto Cleanup**: Expired sessions deleted automatically (2-hour TTL)  
✅ **SQL Injection Prevention**: Parameterized queries, SELECT-only enforcement  
✅ **File Size Limits**: 100MB default, prevents DoS attacks  
✅ **CORS Configuration**: Whitelist allowed origins  
✅ **Type Validation**: Pydantic validates all inputs  

---

## 🎓 What I Learned

### Technical Challenges Solved

1. **Numpy Type Serialization**: DuckDB returns numpy types → Added `.item()` conversion
2. **Docker Build Performance**: Network timeouts → Optimized package installation order
3. **Hot-Reload in Docker**: Volume mounting complexity → Proper Dockerfile layering
4. **LLM Prompt Engineering**: Balancing SQL generation vs conversation → Added conversation detection

### Architectural Insights

- **DuckDB is perfect for this use case** - Direct CSV querying beats import-first approaches
- **Session management is critical** - Multi-user support requires careful isolation
- **Type safety pays dividends** - TypeScript + Pydantic caught many bugs early
- **Good documentation accelerates development** - Swagger UI made API testing seamless

---

## 🚦 Production Readiness

✅ **Containerized**: Docker + Docker Compose  
✅ **Documented**: README + 4 detailed docs  
✅ **Typed**: TypeScript + Pydantic  
✅ **Tested**: Manual test suite + API docs  
✅ **Monitored**: Health check endpoint  
✅ **Logged**: Structured logging (Uvicorn)  
✅ **Configurable**: Environment variables  
✅ **Scalable**: Stateless backend, session-based  

### Deployment Checklist

- [ ] Set production `OPENAI_API_KEY`
- [ ] Configure `CORS_ORIGINS` for production domain
- [ ] Set up monitoring (e.g., Datadog, New Relic)
- [ ] Configure log aggregation (e.g., ELK stack)
- [ ] Set up backups for session data
- [ ] Configure SSL/TLS certificates
- [ ] Set up load balancer if needed
- [ ] Run security audit (e.g., Snyk, OWASP ZAP)

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
