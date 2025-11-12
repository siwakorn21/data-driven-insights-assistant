# Data-Driven Insights Assistant - Backend API

FastAPI backend with DuckDB for natural language data querying.

## Features

- **CSV Upload & Session Management**: Upload CSV files and create isolated sessions
- **Natural Language Querying**: Convert questions to SQL using OpenAI
- **DuckDB Integration**: Fast, efficient CSV querying without loading data into memory
- **Automatic Schema Detection**: Infer column types and provide samples
- **Session Cleanup**: Automatic cleanup of expired sessions (2-hour TTL)

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app initialization
│   ├── config.py            # Configuration management
│   ├── models.py            # Pydantic models
│   ├── routers/             # API endpoints
│   │   ├── health.py        # Health check
│   │   ├── upload.py        # CSV upload & session management
│   │   └── query.py         # Query execution
│   ├── services/            # Business logic
│   │   ├── duckdb_service.py   # DuckDB operations
│   │   ├── llm_service.py      # OpenAI integration
│   │   └── session_service.py  # Session management
│   └── utils/               # Utilities
│       └── cleanup.py       # File cleanup helpers
├── uploads/                 # Temporary CSV storage
├── requirements.txt
├── Dockerfile
└── .env.example
```

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### 3. Run Development Server

```bash
python -m app.main
# or
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Access API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Health Check
- `GET /api/health` - Check API status and DuckDB version

### Upload & Sessions
- `POST /api/upload` - Upload CSV file and create session
- `DELETE /api/sessions/{session_id}` - Delete session

### Query Execution
- `GET /api/sessions/{session_id}/schema` - Get table schema
- `POST /api/query` - Execute natural language query
- `POST /api/execute-sql` - Execute raw SQL query

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_MODEL` | Model to use | gpt-4o-mini |
| `CORS_ORIGINS` | Allowed CORS origins | localhost:5173,localhost:8080 |
| `SESSION_TTL_HOURS` | Session expiration time | 2 |
| `MAX_FILE_SIZE_MB` | Max upload size | 100 |

## Development

### Run with Docker

```bash
docker build -t data-insight-backend .
docker run -p 8000:8000 --env-file .env data-insight-backend
```

### Run Tests

```bash
pytest
```

## Architecture

The backend uses:
- **FastAPI**: Modern, fast web framework
- **DuckDB**: Embedded analytical database that queries CSV directly
- **OpenAI**: LLM for natural language to SQL conversion
- **Pydantic**: Data validation and settings management
- **APScheduler**: Background job scheduling for cleanup

## Why DuckDB?

DuckDB is perfect for this use case because:
- Queries CSV files directly without loading into memory
- Automatic schema detection with `read_csv_auto()`
- Fast columnar processing for analytics
- Full SQL support including aggregations
- Efficient for datasets larger than RAM
