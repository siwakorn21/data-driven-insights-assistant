# Production Scale: Intelligent Query Routing

## Overview

The application includes a **production-scale intelligent query routing system** that automatically optimizes cost while maintaining quality by routing queries based on complexity.

## How It Works

### Routing Strategy

```
Simple Queries → Templates (Free, Instant)
  ↓
Medium Queries → GPT-3.5-turbo ($0.001/query)
  ↓
Complex Queries → GPT-4 ($0.024/query)
```

### Cost Optimization

| Query Type | Method | Cost | Speed | Use Case |
|------------|--------|------|-------|----------|
| **Simple** | Template-based | $0 | Instant | "show all", "count", "first 10 rows" |
| **Medium** | GPT-3.5-turbo | $0.001 | 1-2s | Single aggregations, filtering, grouping |
| **Complex** | GPT-4 | $0.024 | 2-5s | Multi-step reasoning, multiple joins |

### Expected Savings

Assuming typical query distribution:
- 30% simple queries (templates)
- 50% medium queries (GPT-3.5)
- 20% complex queries (GPT-4)

**Cost comparison per 1000 queries:**
- Without routing (all GPT-4): **$24.00**
- With routing: **$5.30**
- **Savings: 78%** (~$18.70 per 1000 queries)

## Architecture

### Components

1. **Query Complexity Analyzer** (`QueryComplexityAnalyzer`)
   - Analyzes natural language questions
   - Detects patterns indicating complexity
   - Considers word count, keywords, and schema awareness

2. **Template System** (`QueryTemplate`)
   - Matches common patterns against pre-defined templates
   - Instant SQL generation for simple queries
   - No LLM calls required

3. **Query Router** (`QueryRouter`)
   - Routes queries to appropriate strategy
   - Tracks metrics for cost analysis
   - Supports A/B testing and forced routing

4. **LLM Service Integration** (`LLMService.generate_sql_with_routing`)
   - Seamlessly integrates routing
   - Falls back to templates when possible
   - Selects appropriate model based on complexity

## Query Complexity Analysis

### Simple Queries (Template-based)

Patterns:
- "show all" / "display everything"
- "first N rows" / "top N"
- "count" / "how many"
- Very short questions (≤3 words)

Examples:
```
"show all" → SELECT * FROM "data" LIMIT 50
"count" → SELECT COUNT(*) as count FROM "data"
"first 10 rows" → SELECT * FROM "data" LIMIT 10
```

### Medium Queries (GPT-3.5-turbo)

Indicators:
- Single aggregation (AVG, SUM, COUNT, MAX, MIN)
- GROUP BY operations
- Simple filtering (WHERE clauses)
- ORDER BY / sorting
- 4-15 words

Examples:
```
"average rating by country"
"top 5 hotels by revenue"
"count bookings per month"
```

### Complex Queries (GPT-4)

Indicators:
- Multiple operations (AND/OR/NOT)
- Subqueries or CTEs
- Window functions
- Multiple JOINs
- HAVING clauses
- Complex date/time operations
- >15 words or multiple aggregations

Examples:
```
"top 5 hotels by revenue, excluding those with less than 50 bookings"
"average rating per country for hotels with revenue above median"
"year-over-year growth rate for each hotel"
```

## Configuration

### Enable/Disable Routing

```env
# .env
ENABLE_QUERY_ROUTING=true  # Default: true
```

When disabled, all queries use the configured `OPENAI_MODEL` (no routing).

### Model Configuration

```python
# backend/app/config.py
ENABLE_QUERY_ROUTING: bool = True
DEFAULT_MODEL_FOR_SIMPLE: str = "template"
DEFAULT_MODEL_FOR_MEDIUM: str = "gpt-3.5-turbo"
DEFAULT_MODEL_FOR_COMPLEX: str = "gpt-4"
```


## Future Enhancements

1. **ML-based Routing**
   - Train classifier on historical query → complexity mapping
   - Improve routing accuracy

2. **User-specific Routing**
   - Track user expertise level
   - Route power users to GPT-4 more often

3. **Adaptive Thresholds**
   - Automatically adjust based on error rates
   - Balance cost and quality dynamically

4. **Query Result Caching**
   - Cache frequent queries
   - Reduce LLM calls for repeated questions
