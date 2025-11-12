# Data-Driven Insights Assistant

A full-stack application that enables natural language querying of CSV data using OpenAI and DuckDB.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  React + TypeScript + Vite                         │    │
│  │  - Upload CSV interface                            │    │
│  │  - Natural language chat                           │    │
│  │  - Results visualization (tables + charts)         │    │
│  └──────────────────┬─────────────────────────────────┘    │
└─────────────────────┼──────────────────────────────────────┘
                      │ REST API
                      │
┌─────────────────────▼──────────────────────────────────────┐
│                    Backend Server                           │
│  ┌────────────────────────────────────────────────────┐    │
│  │  FastAPI + Python                                  │    │
│  │  ├── CSV Upload & Session Management              │    │
│  │  ├── DuckDB for SQL Execution                     │    │
│  │  ├── OpenAI for NL → SQL Conversion              │    │
│  │  └── Background Cleanup Tasks                     │    │
│  └──────────────────┬─────────────────────────────────┘    │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │  OpenAI API  │
              └──────────────┘
```

## Features

- **Natural Language Queries**: Ask questions in plain English
- **Automatic SQL Generation**: Powered by OpenAI GPT models
- **Fast CSV Processing**: DuckDB queries data directly without loading into memory
- **Smart Clarifications**: System asks for clarification when needed
- **Interactive Visualizations**: Auto-generated charts (bar/line) based on data
- **Session Management**: Automatic cleanup of uploaded files after 2 hours
- **Docker Support**: Full Docker setup for development and production

## Tech Stack

### Frontend
- **React** 18 with TypeScript
- **Vite** for blazing fast builds
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Framer Motion** for animations

### Backend
- **FastAPI** for high-performance API
- **DuckDB** for efficient CSV querying
- **OpenAI** for natural language processing
- **Pydantic** for data validation
- **APScheduler** for background tasks

## Quick Start

### Prerequisites

- Docker & Docker Compose (recommended)
- OR: Node.js 18+ and Python 3.11+ (for local development)
- OpenAI API Key

### 1. Clone and Setup

```bash
git clone <your-repo>
cd data-driven-insight-assistant-agoda

# Copy environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-key-here
```

### 2. Start with Docker (Recommended)

#### Development Mode (with hot-reload)

```bash
docker-compose -f docker-compose.dev.yml up
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

#### Production Mode

```bash
docker-compose -f docker-compose.prod.yml up
```

- Frontend: http://localhost:8080
- Backend: http://localhost:8000

### 3. Start Without Docker

#### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Add your OpenAI API key to .env
python -m app.main
```

#### Frontend

```bash
npm install
npm run dev
```

## Usage

1. **Upload CSV**: Click "Upload CSV" and select your data file
2. **Ask Questions**: Type natural language questions like:
   - "Show me the top 5 hotels by revenue"
   - "What's the average booking value by country?"
   - "Count bookings per day last month"
3. **View Results**: See results in table format, charts, or raw SQL

## Project Structure

```
.
├── backend/                # Backend API
│   ├── app/
│   │   ├── main.py        # FastAPI app
│   │   ├── config.py      # Configuration
│   │   ├── models.py      # Pydantic models
│   │   ├── routers/       # API endpoints
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utilities
│   ├── uploads/           # Temporary CSV storage
│   ├── Dockerfile
│   └── requirements.txt
│
├── src/                   # Frontend
│   ├── api/              # API client
│   ├── types/            # TypeScript types
│   ├── components/       # UI components
│   ├── config/           # Configuration
│   └── App.tsx           # Main app
│
├── docker-compose.yml    # All services
├── docker-compose.dev.yml   # Development
├── docker-compose.prod.yml  # Production
├── DOCKER_SETUP.md       # Docker guide
└── MIGRATION_GUIDE.md    # Migration details
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/upload` | Upload CSV file |
| GET | `/api/sessions/{id}/schema` | Get table schema |
| POST | `/api/query` | Natural language query |
| POST | `/api/execute-sql` | Execute raw SQL |
| DELETE | `/api/sessions/{id}` | Delete session |

Full API documentation: http://localhost:8000/docs

## Configuration

### Environment Variables

**Backend** (`backend/.env`):
```env
OPENAI_API_KEY=sk-...          # Required
OPENAI_MODEL=gpt-4o-mini       # Optional
SESSION_TTL_HOURS=2            # Optional
MAX_FILE_SIZE_MB=100           # Optional
```

**Frontend** (`.env.local`):
```env
VITE_API_URL=http://localhost:8000
```

## Development

### Backend Development

```bash
cd backend
pip install -r requirements.txt

# Run with hot-reload
python -m app.main

# Or with uvicorn directly
uvicorn app.main:app --reload
```

### Frontend Development

```bash
npm install
npm run dev
```

### Docker Development

```bash
# Start dev environment
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose logs -f backend-dev

# Rebuild
docker-compose up --build
```

## Testing

### Manual Testing Flow

1. Start the application
2. Upload a CSV file
3. Ask questions:
   - "Show all data"
   - "Top 5 by revenue"
   - "Count by category"
4. Verify:
   - CSV uploads successfully
   - Questions generate SQL
   - Results display correctly
   - Charts render properly

### API Testing

Use the interactive docs at http://localhost:8000/docs to test endpoints directly.

## Security

- **API Key Protection**: OpenAI key stored only on backend, never exposed to browser
- **SQL Injection Prevention**: Parameterized queries with DuckDB
- **File Upload Limits**: Max 100MB file size (configurable)
- **Session Expiration**: Automatic cleanup after 2 hours
- **CORS Configuration**: Restricted origins in production

## Performance

- **DuckDB**: Queries CSV directly without loading into memory
- **Fast Processing**: Can handle 100MB+ CSV files efficiently
- **Session Management**: Automatic cleanup prevents storage bloat
- **Docker Optimization**: Multi-stage builds for small images

## Documentation

- [Docker Setup Guide](./DOCKER_SETUP.md) - Detailed Docker instructions
- [Migration Guide](./MIGRATION_GUIDE.md) - Client-side to backend migration
- [Backend README](./backend/README.md) - Backend-specific documentation
- [API Documentation](http://localhost:8000/docs) - Interactive API docs

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Verify OpenAI key is set
grep OPENAI_API_KEY .env
```

### Frontend can't connect to backend
```bash
# Check backend health
curl http://localhost:8000/api/health

# Verify VITE_API_URL
cat .env.local
```

### CSV upload fails
- Check file size (max 100MB by default)
- Verify CSV format (must have header row)
- Check backend logs for errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License

## Support

For issues or questions:
- Open an issue on GitHub
- Check the documentation files
- Review API docs at `/docs`

---

Built with ❤️ using React, FastAPI, and DuckDB
