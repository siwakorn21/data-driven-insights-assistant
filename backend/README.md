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

### 1. Health Check

**GET** `/api/health`

Check API status and DuckDB version.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "duckdb_version": "0.9.2"
}
```

---

### 2. Upload CSV File

**POST** `/api/upload`

Upload a CSV file and create a new session.

**Request:**
- Content-Type: `multipart/form-data`
- Body parameter: `file` (CSV file)

**Example:**
```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@data.csv"
```

**Response** (200 OK):
```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "filename": "data.csv",
  "rows": 1000,
  "columns": 5,
  "message": "File uploaded successfully"
}
```

**Error Response** (400 Bad Request):
```json
{
  "detail": "File size exceeds maximum allowed size of 100MB"
}
```

---

### 3. Get Schema

**GET** `/api/sessions/{session_id}/schema`

Get table schema with column information and sample values.

**Path Parameters:**
- `session_id` (string): Session UUID

**Example:**
```bash
curl http://localhost:8000/api/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/schema
```

**Response** (200 OK):
```json
{
  "columns": [
    {
      "name": "hotel",
      "type": "VARCHAR",
      "sample_values": ["Hotel A", "Hotel B", "Hotel C"]
    },
    {
      "name": "revenue",
      "type": "BIGINT",
      "sample_values": [50000, 75000, 30000]
    },
    {
      "name": "country",
      "type": "VARCHAR",
      "sample_values": ["USA", "UK", "France"]
    },
    {
      "name": "rating",
      "type": "DOUBLE",
      "sample_values": [4.5, 4.8, 4.2]
    },
    {
      "name": "bookings",
      "type": "BIGINT",
      "sample_values": [120, 200, 80]
    }
  ]
}
```

**Error Response** (404 Not Found):
```json
{
  "detail": "Session not found or expired"
}
```

---

### 4. Natural Language Query

**POST** `/api/query`

Convert natural language question to SQL and execute.

**Request Body:**
```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "question": "Top 5 hotels by revenue"
}
```

**Response - Successful Query** (200 OK):
```json
{
  "sql": "SELECT * FROM \"data\" ORDER BY \"revenue\" DESC LIMIT 5",
  "columns": ["hotel", "revenue", "country", "rating", "bookings"],
  "rows": [
    {
      "hotel": "Hotel D",
      "revenue": 95000,
      "country": "USA",
      "rating": 4.9,
      "bookings": 250
    },
    {
      "hotel": "Hotel B",
      "revenue": 75000,
      "country": "UK",
      "rating": 4.8,
      "bookings": 200
    },
    {
      "hotel": "Hotel A",
      "revenue": 50000,
      "country": "USA",
      "rating": 4.5,
      "bookings": 120
    },
    {
      "hotel": "Hotel E",
      "revenue": 45000,
      "country": "Germany",
      "rating": 4.3,
      "bookings": 100
    },
    {
      "hotel": "Hotel C",
      "revenue": 30000,
      "country": "France",
      "rating": 4.2,
      "bookings": 80
    }
  ],
  "ask_clarification": false,
  "clarification": null,
  "explanation": "Showing top 5 hotels sorted by revenue in descending order"
}
```

**Response - Clarification Needed** (200 OK):
```json
{
  "sql": null,
  "columns": [],
  "rows": [],
  "ask_clarification": true,
  "clarification": "Which column would you like to use for filtering? Available columns: hotel, revenue, country, rating, bookings",
  "explanation": "The question 'best hotels' is ambiguous. Please specify what makes a hotel 'best'."
}
```

**Response - Conversational (Greeting)** (200 OK):
```json
{
  "sql": null,
  "columns": [],
  "rows": [],
  "ask_clarification": false,
  "clarification": null,
  "explanation": "Hello! I'm here to help you analyze your data. You can ask me questions like:\n• Top 5 hotels by revenue\n• Average rating by country\n• Count of bookings\n\nWhat would you like to know about your data?"
}
```

**Error Response** (400 Bad Request):
```json
{
  "detail": "LLM did not generate valid SQL"
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "detail": "SQL execution error: column \"revenu\" does not exist"
}
```

---

### 5. Execute SQL Query

**POST** `/api/execute-sql`

Execute raw SQL query directly.

**Request Body:**
```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "sql": "SELECT country, AVG(rating) as avg_rating FROM \"data\" GROUP BY country ORDER BY avg_rating DESC"
}
```

**Response** (200 OK):
```json
{
  "columns": ["country", "avg_rating"],
  "rows": [
    {
      "country": "USA",
      "avg_rating": 4.7
    },
    {
      "country": "UK",
      "avg_rating": 4.8
    },
    {
      "country": "Germany",
      "avg_rating": 4.3
    },
    {
      "country": "France",
      "avg_rating": 4.2
    }
  ]
}
```

**Error Response** (400 Bad Request):
```json
{
  "detail": "Only SELECT queries are allowed"
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "detail": "SQL error: Parser Error: syntax error at or near \"FORM\""
}
```

---

### 6. Delete Session

**DELETE** `/api/sessions/{session_id}`

Delete session and cleanup associated files.

**Path Parameters:**
- `session_id` (string): Session UUID

**Example:**
```bash
curl -X DELETE http://localhost:8000/api/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response** (200 OK):
```json
{
  "message": "Session deleted successfully"
}
```

**Error Response** (404 Not Found):
```json
{
  "detail": "Session not found"
}
```

---

## Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid input, file too large, non-SELECT query) |
| 404 | Not Found (session expired or doesn't exist) |
| 500 | Internal Server Error (SQL execution error, OpenAI API error) |

## Example Workflow

```bash
# 1. Upload CSV file
response=$(curl -X POST http://localhost:8000/api/upload \
  -F "file=@examples/test_data.csv")
session_id=$(echo $response | jq -r '.session_id')

# 2. Get schema
curl http://localhost:8000/api/sessions/$session_id/schema

# 3. Query with natural language
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$session_id\",
    \"question\": \"Top 5 hotels by revenue\"
  }"

# 4. Execute custom SQL
curl -X POST http://localhost:8000/api/execute-sql \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$session_id\",
    \"sql\": \"SELECT country, COUNT(*) as count FROM data GROUP BY country\"
  }"

# 5. Cleanup (optional - auto-deleted after 2 hours)
curl -X DELETE http://localhost:8000/api/sessions/$session_id
```

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
