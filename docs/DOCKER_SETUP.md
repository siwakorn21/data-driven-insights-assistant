# Docker Setup Guide

This project includes Docker configurations for both development and production environments.

## Quick Start

### 1. Set up environment variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-key-here
```

### 2. Choose your setup

#### Option A: Development (Recommended for local development)

```bash
# Start development servers with hot-reload
docker-compose -f docker-compose.dev.yml up

# Or use the shorthand
docker-compose -f docker-compose.dev.yml up -d
```

**Ports:**
- Frontend: http://localhost:5173 (Vite dev server with HMR)
- Backend: http://localhost:8000 (FastAPI with auto-reload)
- API Docs: http://localhost:8000/docs

#### Option B: Production

```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up --build

# Or in detached mode
docker-compose -f docker-compose.prod.yml up -d
```

**Ports:**
- Frontend: http://localhost:8080 (Nginx)
- Backend: http://localhost:8000 (FastAPI)
- API Docs: http://localhost:8000/docs

#### Option C: All Services (Both Dev and Prod)

```bash
# Start all services defined in docker-compose.yml
docker-compose up

# This starts:
# - backend (prod) on :8000
# - backend-dev on :8001
# - frontend (prod) on :8080
# - frontend-dev on :5173
```

## Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                     (app-network)                        │
│                                                          │
│  ┌──────────────┐              ┌──────────────┐        │
│  │   Frontend   │─────────────▶│   Backend    │        │
│  │  (React +    │              │  (FastAPI +  │        │
│  │   Vite)      │              │   DuckDB)    │        │
│  │              │              │              │        │
│  │  Port: 5173  │              │  Port: 8000  │        │
│  │  (dev)       │              │              │        │
│  │  Port: 8080  │              │              │        │
│  │  (prod)      │              │              │        │
│  └──────────────┘              └──────────────┘        │
│                                       │                 │
│                                       │                 │
│                                 ┌─────▼──────┐         │
│                                 │  OpenAI    │         │
│                                 │    API     │         │
│                                 └────────────┘         │
└─────────────────────────────────────────────────────────┘
```

## Service Details

### Backend Services

| Service | Port | Description | Volume Mounts |
|---------|------|-------------|---------------|
| `backend` | 8000 | Production FastAPI | `backend-uploads:/app/uploads` |
| `backend-dev` | 8000 | Dev FastAPI with hot-reload | `./backend:/app` |

### Frontend Services

| Service | Port | Description | Volume Mounts |
|---------|------|-------------|---------------|
| `frontend` | 8080 | Production Nginx | None (built assets) |
| `frontend-dev` | 5173 | Dev Vite with HMR | `.:/app` |

## Common Commands

### Start Services

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.prod.yml up

# All services
docker-compose up
```

### Stop Services

```bash
# Stop dev services
docker-compose -f docker-compose.dev.yml down

# Stop prod services
docker-compose -f docker-compose.prod.yml down

# Stop all
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend-dev
```

### Rebuild Services

```bash
# Rebuild dev services
docker-compose -f docker-compose.dev.yml up --build

# Rebuild prod services
docker-compose -f docker-compose.prod.yml up --build

# Rebuild specific service
docker-compose build backend
```

### Clean Up

```bash
# Remove containers and networks
docker-compose down

# Remove containers, networks, and volumes
docker-compose down -v

# Remove containers, networks, volumes, and images
docker-compose down -v --rmi all
```

## Development Workflow

### Backend Development

1. Start backend dev server:
   ```bash
   docker-compose -f docker-compose.dev.yml up backend-dev
   ```

2. Code changes in `backend/` are automatically reflected (hot-reload enabled)

3. View logs:
   ```bash
   docker-compose logs -f backend-dev
   ```

4. Access API docs: http://localhost:8000/docs

### Frontend Development

1. Start frontend dev server:
   ```bash
   docker-compose -f docker-compose.dev.yml up frontend-dev
   ```

2. Code changes in `src/` trigger HMR (Hot Module Replacement)

3. View logs:
   ```bash
   docker-compose logs -f frontend-dev
   ```

4. Access app: http://localhost:5173

### Full Stack Development

Start both dev services:
```bash
docker-compose -f docker-compose.dev.yml up
```

## Environment Variables

### Required

- `OPENAI_API_KEY`: Your OpenAI API key

### Optional

- `SESSION_TTL_HOURS`: Session expiration time (default: 2)
- `MAX_FILE_SIZE_MB`: Max CSV upload size (default: 100)
- `VITE_API_URL`: Backend API URL for frontend

## Volumes

### Backend Uploads

- `backend-uploads`: Production uploads (persisted)
- `backend-uploads-dev`: Development uploads (persisted)

CSV files are automatically cleaned up after `SESSION_TTL_HOURS`.

## Network

All services communicate through the `app-network` bridge network, which allows:
- Frontend to call backend APIs
- Service discovery by container name
- Isolated network from host

## Troubleshooting

### Port Already in Use

If you see "port already allocated" errors:

```bash
# Find process using the port
lsof -i :8000

# Kill the process or use different ports in docker-compose
```

### Backend can't connect to OpenAI

1. Check your `.env` file has `OPENAI_API_KEY`
2. Restart backend service:
   ```bash
   docker-compose restart backend
   ```

### Frontend can't reach backend

1. Check backend is running:
   ```bash
   docker-compose ps
   ```

2. Check `VITE_API_URL` environment variable

3. Verify network:
   ```bash
   docker network inspect data-driven-insight-assistant-agoda_app-network
   ```

### Volume permission issues

```bash
# Reset volumes
docker-compose down -v
docker-compose up
```

## Production Deployment

For production deployment:

1. Update `CORS_ORIGINS` in docker-compose.prod.yml with your domain
2. Consider using nginx as reverse proxy
3. Set up HTTPS/SSL certificates
4. Use docker secrets for sensitive data
5. Set up monitoring and logging
6. Configure backup for uploads volume

Example with reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
    }

    location /api {
        proxy_pass http://localhost:8000;
    }
}
```
