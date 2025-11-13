# Migration Guide: Client-Side to Backend Architecture

This guide explains the changes from the client-side only architecture to the new frontend + backend architecture.

## What Changed?

### Architecture

**Before:**
```
Browser
├── React App (Frontend)
├── sql.js (Client-side SQLite)
├── PapaParse (CSV parsing)
└── OpenAI API (Direct calls)
```

**After:**
```
Browser                Backend Server
├── React App ────────▶ FastAPI
└── API Client         ├── DuckDB (SQL engine)
                       ├── CSV Processing
                       └── OpenAI API
```

### Key Changes

1. **No More Client-Side Dependencies**
   - Removed: `sql.js`, `papaparse`
   - CSV parsing and SQL execution now handled by backend

2. **No More API Keys in Browser**
   - OpenAI API key is now stored in backend `.env` file
   - More secure - users can't see or extract your API key

3. **Backend API Integration**
   - New API client in `src/api/client.ts`
   - All data operations go through backend endpoints

4. **Session Management**
   - Each CSV upload creates a session on the backend
   - Sessions automatically expire after 2 hours
   - Files stored temporarily on backend

## File Changes

### New Files

```
src/
├── api/
│   ├── client.ts         # API client for backend
│   └── index.ts
├── types/
│   └── api.ts           # TypeScript types
└── App.tsx              # Updated to use backend

backend/                 # Entire backend directory
.env.local              # Frontend environment
.env.development
.env.production
docker-compose.yml      # Updated with backend services
DOCKER_SETUP.md
MIGRATION_GUIDE.md
```

### Modified Files

- `src/App.tsx` - Now uses backend APIs instead of client-side logic
- `docker-compose.yml` - Added backend services
- `.gitignore` - Added .env files

### Backup Files

- `src/App.old.tsx` - Original client-side version (backup)

## Migration Steps

### 1. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-key-here
```

### 2. Start the Backend

Choose one of these options:

**Option A: Docker (Recommended)**

```bash
# Development mode with hot-reload
docker-compose -f docker-compose.dev.yml up

# Or production mode
docker-compose -f docker-compose.prod.yml up
```

**Option B: Local Python**

```bash
cd backend
pip install -r requirements.txt
python -m app.main
```

The backend will start on http://localhost:8000

### 3. Start the Frontend

If using Docker, the frontend is already running.

If running locally:

```bash
npm install
npm run dev
```

The frontend will be on http://localhost:5173

### 4. Test the Application

1. Open http://localhost:5173 (dev) or http://localhost:8080 (prod)
2. Upload a CSV file
3. Ask a natural language question
4. Verify results are displayed

## API Endpoints

The backend exposes these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/upload` | Upload CSV file |
| GET | `/api/sessions/{id}/schema` | Get table schema |
| POST | `/api/query` | Execute natural language query |
| POST | `/api/execute-sql` | Execute raw SQL |
| DELETE | `/api/sessions/{id}` | Delete session |

API Documentation: http://localhost:8000/docs

## Code Comparison

### CSV Upload

**Before (Client-side):**
```typescript
Papa.parse(file, {
  header: true,
  complete: (res) => {
    // Parse CSV in browser
    // Create in-memory SQLite database
  }
});
```

**After (Backend):**
```typescript
const response = await apiClient.uploadCSV(file);
setSessionId(response.session_id);
```

### Query Execution

**Before (Client-side):**
```typescript
// Call OpenAI directly from browser
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  headers: { Authorization: `Bearer ${apiKey}` },
  // ...
});

// Execute SQL in browser
const result = dbRef.current.execute(sql);
```

**After (Backend):**
```typescript
const response = await apiClient.executeQuery({
  session_id: sessionId,
  question: userInput,
});
```

## Benefits of New Architecture

### 1. Security
- API keys never exposed in browser
- Server-side validation and sanitization
- No client-side SQL injection risks

### 2. Performance
- DuckDB is faster than sql.js for large datasets
- No need to download large SQLite WASM
- Queries CSV directly without loading into memory

### 3. Scalability
- Can handle multiple concurrent users
- Session management with automatic cleanup
- Can scale backend independently

### 4. Features
- Easier to add authentication
- Can implement rate limiting
- Better error handling and logging
- Can add caching layer

## Troubleshooting

### Backend Not Starting

```bash
# Check if port 8000 is already in use
lsof -i :8000

# Check backend logs
docker-compose logs -f backend-dev
```

### Frontend Can't Connect to Backend

1. Verify backend is running: http://localhost:8000/api/health
2. Check `VITE_API_URL` in `.env.local`
3. Check CORS settings in `backend/app/config.py`

### CSV Upload Fails

1. Check file size (default max: 100MB)
2. Verify file is valid CSV
3. Check backend logs for errors

### OpenAI API Errors

1. Verify API key in backend `.env` file
2. Check API key has credits
3. Restart backend after changing `.env`

## Optional: Removing Old Dependencies

If you no longer need the client-side version, you can remove these dependencies:

```bash
npm uninstall sql.js papaparse @types/papaparse
```

And delete the backup file:

```bash
rm src/App.old.tsx
```

## Reverting to Client-Side Version

If you need to revert to the client-side only version:

```bash
# Restore old App.tsx
cp src/App.old.tsx src/App.tsx

# Stop backend
docker-compose down
```

## Next Steps

1. **Add Authentication**: Implement user accounts and session management
2. **Add Caching**: Cache query results with Redis
3. **Add Rate Limiting**: Prevent API abuse
4. **Deploy**: Deploy backend and frontend to cloud
5. **Monitoring**: Add logging and monitoring tools

## Support

For issues or questions:
- Backend API Docs: http://localhost:8000/docs
- Backend README: `backend/README.md`
- Docker Setup: `DOCKER_SETUP.md`
