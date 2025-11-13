# Privacy Policy

## Data Processing Location

All data processing happens **locally in your browser**. Your CSV files never leave your machine.

## What Data is Sent to OpenAI?

When you ask a question, the following is sent to OpenAI's API:

### ✅ Sent to OpenAI:
1. **Your question** - The natural language query you typed
2. **Column names** - Names of columns from your CSV
3. **Data types** - Inferred types (TEXT, REAL, INTEGER)
4. **Sample values** - One example value per column (from first row only)
5. **System prompt** - Instructions for SQL generation

### ❌ NOT Sent to OpenAI:
1. **Full CSV content** - Only schema information is sent
2. **All data rows** - Only first row sample values
3. **Your API key in body** - Only used for authentication header
4. **Personal information** - No tracking or identification data
5. **File names** - Not included in requests
6. **Previous queries** - No conversation history maintained

## Example

If you upload this CSV:
```csv
hotel,revenue,country
Hotel A,10000,USA
Hotel B,15000,UK
Hotel C,8000,USA
```

And ask: **"Top 3 by revenue"**

**OpenAI receives:**
```
User question: Top 3 by revenue

Table schema (SQLite):
- hotel (TEXT) e.g. Hotel A
- revenue (REAL) e.g. 10000
- country (TEXT) e.g. USA
```

**OpenAI does NOT receive:**
- The other rows (Hotel B, Hotel C data)
- The fact that there are 3 total rows
- Any other data from your CSV

## Data Storage

- **Browser:** Data stored in memory only (lost on page refresh)
- **API Key:** Stored in component state (not persisted)
- **CSV File:** Loaded into in-browser SQLite database (sql.js)
- **OpenAI:** May retain requests for up to 30 days for abuse monitoring (per their policy)

## Third-Party Services

### OpenAI API
- **Purpose:** Convert natural language to SQL queries
- **Data sent:** Question + schema (see above)
- **Privacy policy:** https://openai.com/policies/privacy-policy
- **Data usage:** API data not used for training (as of 2023)

### No Other Services
This application does not use:
- Analytics (no Google Analytics, etc.)
- Tracking pixels
- Cookies
- Backend servers
- Third-party databases

## Security Measures

1. **HTTPS Only** - All API requests encrypted in transit
2. **Client-Side Processing** - No data sent to our servers (we don't have any!)
3. **No Persistence** - API key cleared on page refresh
4. **Minimal Data Sharing** - Only essential schema info sent to OpenAI

## Your Rights

You have full control over your data:
- **Use your own API key** - Full control over OpenAI account
- **Clear data anytime** - Refresh page to clear everything
- **Inspect requests** - Use browser DevTools to see exactly what's sent
- **Work offline** - Upload and process CSV locally (queries require API)

## Recommendations for Sensitive Data

If you're working with sensitive/confidential data:

1. ✅ **Review column names** - Ensure they're not revealing
2. ✅ **Check sample values** - First row will be sent as examples
3. ✅ **Use generic names** - Consider renaming sensitive columns
4. ⚠️ **Consider alternatives** - For highly sensitive data, use local LLM instead

## Contact

Questions about privacy?
- Review the detailed [API Request Documentation](docs/API_REQUEST.md)
- Check OpenAI's privacy policy at https://openai.com/policies/privacy-policy
- Inspect network requests in your browser DevTools

## Updates

This privacy policy was last updated: **November 2024**

Changes will be reflected in this document and the README.md file.
