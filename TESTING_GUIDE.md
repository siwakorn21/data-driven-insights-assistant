# Testing Guide

## Prerequisites Check

Before starting, ensure you have:
- [ ] Docker Desktop installed and running
- [ ] OpenAI API key ready
- [ ] Port 8000 and 5173 available (or 8080 for production)

## Quick Test (Docker - Recommended)

### Step 1: Set Up Environment

```bash
# Create .env file
cp .env.example .env

# Open .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-key-here
```

### Step 2: Start Development Environment

```bash
# Start both backend and frontend
docker-compose -f docker-compose.dev.yml up
```

**Expected Output:**
```
✅ backend-dev  | INFO:     Uvicorn running on http://0.0.0.0:8000
✅ frontend-dev | VITE ready in X ms
✅ frontend-dev | ➜  Local:   http://localhost:5173/
✅ backend-dev  | ✅ Background cleanup scheduler started
```

### Step 3: Verify Services

Open these URLs in your browser:

1. **Frontend**: http://localhost:5173
   - Should see "Data-Driven Insights Assistant" page

2. **Backend API**: http://localhost:8000/api/health
   - Should return: `{"status":"healthy","duckdb_version":"...","version":"1.0.0"}`

3. **API Docs**: http://localhost:8000/docs
   - Should see interactive Swagger UI

---

## Manual Test Flow

### Test 1: Upload CSV

**Sample CSV** (create `test_data.csv`):
```csv
hotel,revenue,country,rating,bookings
Hotel A,50000,USA,4.5,120
Hotel B,75000,UK,4.8,200
Hotel C,30000,France,4.2,80
Hotel D,95000,USA,4.9,250
Hotel E,45000,Germany,4.3,100
```

**Steps:**
1. Go to http://localhost:5173
2. Click "Choose File" in left panel
3. Select your CSV file
4. Wait for success message

**Expected Result:**
- ✅ "Loaded 5 rows, 5 columns" message appears
- ✅ Schema appears in "Schema & Hints" section:
  ```
  - hotel (VARCHAR) e.g. Hotel A
  - revenue (BIGINT) e.g. 50000
  - country (VARCHAR) e.g. USA
  - rating (DOUBLE) e.g. 4.5
  - bookings (BIGINT) e.g. 120
  ```

### Test 2: Natural Language Query

**Test Query 1: Simple Select**
```
Show all data
```

**Expected:**
- ✅ Table shows all 5 rows
- ✅ SQL tab shows: `SELECT * FROM "data" LIMIT 50`

**Test Query 2: Aggregation**
```
Top 3 hotels by revenue
```

**Expected:**
- ✅ Results show: Hotel D, Hotel B, Hotel A
- ✅ SQL includes: `ORDER BY "revenue" DESC LIMIT 3`

**Test Query 3: Group By**
```
Count bookings by country
```

**Expected:**
- ✅ Groups results by country
- ✅ Shows count for USA, UK, France, Germany
- ✅ Chart tab shows bar chart

**Test Query 4: Average**
```
Average rating by country
```

**Expected:**
- ✅ Shows average rating for each country
- ✅ Chart visualization appears

### Test 3: SQL Execution

**Steps:**
1. Click "SQL" tab
2. Edit the SQL query manually:
   ```sql
   SELECT country, SUM("revenue") as total_revenue
   FROM "data"
   GROUP BY country
   ORDER BY total_revenue DESC
   ```
3. Click "Run SQL"

**Expected:**
- ✅ Results update with new query
- ✅ Table shows grouped data
- ✅ Chart updates automatically

### Test 4: Chart Visualization

**Steps:**
1. Run query: `Sum revenue by country`
2. Click "Chart" tab

**Expected:**
- ✅ Bar chart appears with colors
- ✅ X-axis shows countries
- ✅ Y-axis shows revenue values
- ✅ Legend appears

### Test 5: Export Results

**Steps:**
1. Run any query with results
2. Go to "Table" tab
3. Click "Download CSV"

**Expected:**
- ✅ CSV file downloads
- ✅ File contains query results

---

## Backend API Testing

### Using curl

```bash
# 1. Health Check
curl http://localhost:8000/api/health

# 2. Upload CSV
curl -X POST http://localhost:8000/api/upload \
  -F "file=@test_data.csv"

# Save the session_id from response, then:

# 3. Get Schema
curl http://localhost:8000/api/sessions/YOUR_SESSION_ID/schema

# 4. Execute Query
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "YOUR_SESSION_ID",
    "question": "top 3 by revenue"
  }'

# 5. Execute SQL
curl -X POST http://localhost:8000/api/execute-sql \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "YOUR_SESSION_ID",
    "sql": "SELECT * FROM \"data\" LIMIT 3"
  }'
```

### Using Swagger UI

1. Open http://localhost:8000/docs
2. Click on any endpoint to expand
3. Click "Try it out"
4. Fill in parameters
5. Click "Execute"

---

## Error Testing

### Test 6: Invalid CSV

**Steps:**
1. Create invalid CSV (no headers or corrupted)
2. Try to upload

**Expected:**
- ✅ Error message appears
- ✅ Application remains stable

### Test 7: Large File

**Steps:**
1. Create CSV with 100MB+ data
2. Try to upload

**Expected:**
- ✅ Error: "File size exceeds 100MB limit"

### Test 8: Invalid SQL

**Steps:**
1. Go to SQL tab
2. Enter invalid SQL: `SELECT * FROM nonexistent_table`
3. Click "Run SQL"

**Expected:**
- ✅ Error message: "Table not found..."
- ✅ Application remains stable

### Test 9: No OpenAI Key

**Steps:**
1. Stop backend
2. Remove `OPENAI_API_KEY` from `.env`
3. Start backend
4. Try to ask a question

**Expected:**
- ✅ Backend fails to start OR
- ✅ Error message when querying

---

## Performance Testing

### Test 10: Large CSV

**Create large CSV** (using Python):
```python
import csv

with open('large_test.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['id', 'value', 'category', 'amount'])
    for i in range(50000):
        writer.writerow([i, f'value_{i}', f'cat_{i%10}', i * 1.5])
```

**Steps:**
1. Upload the 50k row CSV
2. Run aggregation queries
3. Check performance

**Expected:**
- ✅ Upload completes within seconds
- ✅ Queries execute quickly (<1s)
- ✅ Charts render smoothly

### Test 11: Concurrent Users

**Steps:**
1. Open app in 3 different browser tabs
2. Upload different CSVs in each tab
3. Run queries in parallel

**Expected:**
- ✅ Each session isolated
- ✅ No cross-contamination
- ✅ All queries execute correctly

---

## Session Management Testing

### Test 12: Session Expiration

**Note:** Default TTL is 2 hours, but you can change it for testing.

**Steps:**
1. Edit `backend/.env`: `SESSION_TTL_HOURS=0.001` (6 seconds)
2. Restart backend
3. Upload CSV
4. Wait 10 seconds
5. Try to query

**Expected:**
- ✅ File gets cleaned up
- ✅ Error: "Session not found"

**Remember to change back to 2 hours after testing!**

---

## Docker Testing

### Test 13: Production Build

```bash
# Stop dev services
docker-compose -f docker-compose.dev.yml down

# Start production services
docker-compose -f docker-compose.prod.yml up --build
```

**Access:**
- Frontend: http://localhost:8080
- Backend: http://localhost:8000

**Expected:**
- ✅ Production build works
- ✅ Optimized bundle sizes
- ✅ All features work

### Test 14: Container Logs

```bash
# View backend logs
docker-compose logs -f backend-dev

# View frontend logs
docker-compose logs -f frontend-dev
```

**Expected:**
- ✅ No error messages
- ✅ Request/response logs appear
- ✅ Cleanup scheduler messages

---

## Troubleshooting

### Backend won't start

```bash
# Check port 8000
lsof -i :8000

# Check Docker logs
docker-compose logs backend-dev

# Check .env file
cat .env | grep OPENAI_API_KEY
```

### Frontend can't connect to backend

```bash
# Test backend directly
curl http://localhost:8000/api/health

# Check CORS settings
grep CORS backend/app/config.py

# Check frontend env
cat .env.local
```

### CSV upload fails

```bash
# Check backend logs
docker-compose logs backend-dev

# Check uploads directory
ls -lh backend/uploads/

# Check file permissions
ls -la backend/uploads/
```

---

## Testing Checklist

### Basic Functionality
- [ ] Backend health check returns success
- [ ] Frontend loads without errors
- [ ] CSV upload works
- [ ] Schema displays correctly
- [ ] Natural language query generates SQL
- [ ] SQL executes and returns results
- [ ] Table view shows data
- [ ] Chart view renders
- [ ] Manual SQL editing works
- [ ] CSV export works

### Error Handling
- [ ] Invalid CSV shows error
- [ ] Large file shows size limit error
- [ ] Invalid SQL shows error message
- [ ] Missing session shows error

### Performance
- [ ] 10k+ row CSV uploads quickly
- [ ] Queries execute in <1 second
- [ ] Charts render smoothly
- [ ] Multiple tabs work independently

### Docker
- [ ] Dev build works
- [ ] Production build works
- [ ] Hot-reload works in dev mode
- [ ] Logs are accessible

---

## Success Criteria

✅ All tests pass
✅ No console errors
✅ Backend logs show no errors
✅ Session cleanup works
✅ Multiple concurrent users supported

---

## Next Steps After Testing

1. **If tests pass:**
   - Deploy to production
   - Set up monitoring
   - Configure backups

2. **If tests fail:**
   - Check logs: `docker-compose logs`
   - Review error messages
   - Check GitHub issues
   - Consult TROUBLESHOOTING section in README.md

---

## Sample Test Data

Create more test CSVs for thorough testing:

**bookings.csv:**
```csv
booking_id,hotel,check_in,check_out,guests,total_price
1,Hotel A,2024-01-15,2024-01-17,2,500
2,Hotel B,2024-01-16,2024-01-18,3,750
3,Hotel C,2024-01-17,2024-01-19,1,300
```

**sales.csv:**
```csv
product,category,price,quantity,date
Laptop,Electronics,1200,5,2024-01-15
Mouse,Electronics,25,50,2024-01-15
Desk,Furniture,400,10,2024-01-16
Chair,Furniture,200,20,2024-01-16
```

---

**Happy Testing! 🚀**
