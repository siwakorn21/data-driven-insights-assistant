# OpenAI API Request Documentation

This document explains exactly what data is sent to OpenAI when you use this application.

## Overview

The application uses the OpenAI Chat Completions API to convert natural language questions into SQL queries. This document provides transparency about what data is transmitted.

## API Endpoint

```
POST https://api.openai.com/v1/chat/completions
```

## Request Structure

### Headers
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <YOUR_API_KEY>"
}
```

### Request Body
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "<System prompt from src/config/prompts.ts>"
    },
    {
      "role": "user",
      "content": "<Constructed user message>"
    }
  ],
  "temperature": 0.2
}
```

## What Data is Sent?

### 1. System Prompt
The system prompt from `src/config/prompts.ts` is sent as the first message. This contains:
- Instructions for SQL generation
- Format requirements
- Common patterns and examples
- **Does NOT contain any user data**

### 2. User Message
The user message is constructed from:

```
User question: <your natural language question>

Table schema (SQLite):
<inferred schema from your CSV>

Context (answers to prior clarifications):
<any previous context>
```

#### Schema Format
For each column in your CSV:
```
- column_name (TYPE) e.g. sample_value
```

Example:
```
- hotel (TEXT) e.g. Hotel A
- revenue (REAL) e.g. 10000
- country (TEXT) e.g. USA
```

## Real Example

### Input
- **User uploads:** CSV with columns `hotel`, `revenue`, `country`
- **User asks:** "Show me top 5 hotels by revenue"

### Actual Request Sent to OpenAI
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "You are a SQL query generator. Convert natural language questions into valid SQLite queries.\n\nCRITICAL: You must ALWAYS return valid JSON in this exact format:\n{\n  \"sql\": \"SELECT * FROM \\\"data\\\" LIMIT 10\",\n  \"ask_clarification\": false,\n  \"clarification\": null,\n  \"explanation\": \"Showing first 10 rows from your data\"\n}\n\nRules:\n1. The table is ALWAYS named \"data\" (use double quotes: \"data\")\n2. ALWAYS generate a SQL query unless the question is completely unclear\n3. Use double quotes for ALL column names and table names\n4. For vague questions, make your best guess and generate SQL anyway\n5. Include ORDER BY and LIMIT when appropriate for better results\n6. Prefer aggregations (COUNT, SUM, AVG, MAX, MIN) when summarizing\n7. For date/time questions, use date() or datetime() functions\n8. If truly unable to generate SQL, set ask_clarification: true\n\nCommon patterns:\n- \"show/list/get\" → SELECT\n- \"count/how many\" → COUNT()\n- \"total/sum\" → SUM()\n- \"average/mean\" → AVG()\n- \"top N\" → ORDER BY ... DESC LIMIT N\n- \"group by\" → GROUP BY\n\nExamples:\n- \"top 5 by revenue\" → SELECT *, revenue FROM \"data\" ORDER BY revenue DESC LIMIT 5\n- \"count by category\" → SELECT category, COUNT(*) as count FROM \"data\" GROUP BY category"
    },
    {
      "role": "user",
      "content": "User question: Show me top 5 hotels by revenue\n\nTable schema (SQLite):\n- hotel (TEXT) e.g. Hotel A\n- revenue (REAL) e.g. 10000\n- country (TEXT) e.g. USA\n\nContext (answers to prior clarifications):\n{}"
    }
  ],
  "temperature": 0.2
}
```

## Privacy Analysis

### ✅ What OpenAI Receives
- Your natural language question
- Column names from your CSV
- Inferred data types (TEXT, REAL, INTEGER)
- **One sample value per column** (from the first row)
- System instructions for SQL generation

### ❌ What OpenAI Does NOT Receive
- Full CSV file content
- All data rows (only first row sample values)
- Your API key (used only for authentication, not sent in body)
- Any other files from your computer
- Your browser history or personal information
- Previous queries (no conversation history)

## Response Format

OpenAI returns a JSON response:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"sql\":\"SELECT * FROM \\\"data\\\" ORDER BY revenue DESC LIMIT 5\",\"ask_clarification\":false,\"clarification\":null,\"explanation\":\"Showing the top 5 rows ordered by revenue in descending order\"}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 450,
    "completion_tokens": 50,
    "total_tokens": 500
  }
}
```

The application extracts the SQL query from `choices[0].message.content` and executes it locally.

## Configuration

### Temperature: 0.2
- Lower temperature = more deterministic output
- Ensures consistent SQL generation
- Reduces creative variations

### Model Options
- **gpt-4o-mini** (default) - Fast, cost-effective
- **gpt-4o** - More capable, higher accuracy
- **gpt-4.1-mini** - Latest mini model

## Data Flow

```
┌─────────────┐
│   Browser   │
│  (Your CSV) │
└──────┬──────┘
       │ CSV uploaded
       ▼
┌─────────────┐
│   sql.js    │
│  SQLite DB  │
└──────┬──────┘
       │ Schema extracted
       ▼
┌─────────────┐
│   React     │
│  Component  │
└──────┬──────┘
       │ Question + Schema
       ▼
┌─────────────┐
│  OpenAI API │
│  (External) │
└──────┬──────┘
       │ SQL Query JSON
       ▼
┌─────────────┐
│   sql.js    │
│ Execute SQL │
└──────┬──────┘
       │ Results
       ▼
┌─────────────┐
│   Display   │
│ Table/Chart │
└─────────────┘
```

## Implementation

The API call is implemented in `src/App.tsx`:

```typescript
async function callPlanner(nl: string, context: Record<string, any> = {}) {
  if (!apiKey) throw new Error("Please enter your OpenAI API key.");

  const user = `User question: ${nl}\n\nTable schema (SQLite):\n${schemaText}\n\nContext (answers to prior clarifications):\n${JSON.stringify(context)}`;

  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user }
    ],
    temperature: 0.2
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  // ... response handling
}
```

## Monitoring Requests

### Using Browser DevTools
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Filter by "chat/completions" or "openai"
4. Click on a request to see:
   - Request headers
   - Request payload (what was sent)
   - Response (what was received)

### Console Logging
To see requests in console, add this before the fetch:
```typescript
console.log('Request to OpenAI:', body);
```

## Security Notes

1. **API Key Security**
   - API key is stored only in component state
   - Not persisted to localStorage or cookies
   - Cleared when page is refreshed
   - Never sent in request body (only Authorization header)

2. **Data Minimization**
   - Only schema + sample values sent, not full dataset
   - Each request is independent (no conversation history)
   - No user identification data sent

3. **HTTPS**
   - All requests use HTTPS encryption
   - Data encrypted in transit

## OpenAI Data Usage Policy

According to OpenAI's policy:
- API requests are NOT used to train models (as of 2023)
- Data may be retained for up to 30 days for abuse monitoring
- Enterprise customers can opt for zero retention

For latest policy, see: https://openai.com/policies/api-data-usage-policies

## Questions?

If you have concerns about data privacy:
1. Review this document
2. Check OpenAI's data usage policy
3. Consider using your own OpenAI API key with appropriate usage limits
4. For sensitive data, consider running a local LLM instead

## Last Updated

November 2024
