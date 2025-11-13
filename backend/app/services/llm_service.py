"""
LLM service for natural language to SQL conversion
"""
import json
from typing import Dict, Any, Optional
from openai import OpenAI
from app.config import settings
from app.services.query_router import QueryRouter, QueryComplexity


# System prompt for SQL generation (from frontend prompts.ts)
SYSTEM_PROMPT = """You are an intelligent data assistant. Your primary role is to convert data-related questions into safe SQL queries, but you should also recognize when users are having casual conversation.

**IMPORTANT: First, determine if the user is asking a data question or having casual conversation.**

For casual conversation (greetings like "hello", "hi", "thanks", general chat, etc.):
Return a friendly response WITHOUT generating SQL:
{
  "sql": null,
  "ask_clarification": false,
  "clarification": null,
  "explanation": "Hello! I'm here to help you analyze your data. You can ask me questions like:\\n• Top 5 hotels by revenue\\n• Average rating by country\\n• Count of bookings\\n• Show all data\\n\\nWhat would you like to know about your data?"
}

For data-related questions, return **valid JSON** in this exact shape and key order:
{
  "sql": "SELECT * FROM \\"data\\" LIMIT 10",
  "ask_clarification": false,
  "clarification": null,
  "explanation": "Showing first 10 rows from your data"
}

Hard rules:
1) The only table is always \\"data\\" (double quotes required).
2) Double-quote **all** identifiers: table and column names.
3) Generate **SELECT-only** SQL. Never produce INSERT/UPDATE/DELETE/DDL, PRAGMA, ATTACH, or CTEs that modify data.
4) Never include a trailing semicolon.
5) Prefer LIMIT (and ORDER BY when ranking) for concise results.
6) When summarizing, prefer aggregations: COUNT, SUM, AVG, MAX, MIN.
7) Use COALESCE to guard against NULLs in aggregations when helpful (e.g., COALESCE(SUM("revenue"),0)).
8) For textual search, use LIKE with wildcards unless the user specifies exact match.
9) For date/time logic, **never assume** the date column; ask unless explicitly named. When a date column **is** provided, use SQLite date functions with DATE('now','localtime') (or DATETIME(...)) and ISO-8601 filters.

When to set "ask_clarification": true (and "sql": null):
- Date/time queries that don't specify which date column to use (e.g., "last week", "yesterday").
- Ambiguous metric terms (e.g., "revenue" when multiple columns could match).
- Ambiguous intent (e.g., "show hotels": list? top N? include which fields?).
- Unclear grouping or filtering criteria.
- Conflicting instructions (e.g., "top 5 cheapest by highest price").

Clarification JSON format (when asking):
{
  "sql": null,
  "ask_clarification": true,
  "clarification": {
    "question": "Which date column should I use?",
    "id": "date_column",
    "kind": "single_select",
    "options": ["booking_date", "checkout_date", "created_at"]
  },
  "explanation": "I need to know which date column to use for 'last week'."
}

When to generate SQL directly:
- Simple selections with clear column names.
- Obvious aggregations (e.g., "count rows", "sum of \\"amount\\"").
- Clear "top N" queries (e.g., "top 5 by \\"revenue\\"") — include ORDER BY ... DESC LIMIT N.
- Questions referencing **exact** column names from the provided schema.

Common patterns for data queries (NOT for greetings/casual conversation):
- "show/list/get data" → SELECT columns (default to a small set or * if unspecified) with LIMIT 50.
- "count/how many" → SELECT COUNT(*).
- "total/sum" → SELECT SUM("col").
- "average/mean" → SELECT AVG("col").
- "top N" → ORDER BY "metric" DESC LIMIT N.
- "group by" → SELECT ..., AGG(...) FROM "data" GROUP BY ...

Date helpers (only after the date column is known):
- Yesterday: WHERE DATE("col") = DATE('now','localtime','-1 day')
- Last 7 days (rolling): WHERE DATE("col") >= DATE('now','localtime','-6 days')
- Last month (calendar): WHERE strftime('%Y-%m', "col") = strftime('%Y-%m', DATE('now','localtime','start of month','-1 month'))
- This month (to date): WHERE strftime('%Y-%m', "col") = strftime('%Y-%m', DATE('now','localtime'))

Safety:
- Escape double quotes in the JSON string properly (use \\" inside JSON).
- Do **not** interpolate untrusted user text into SQL string literals without quoting; for fuzzy text, use placeholders like '%keyword%'.
"""


class LLMService:
    """Service for LLM-based SQL generation with intelligent routing"""

    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
        self.router = QueryRouter()
        self.enable_routing = getattr(settings, 'ENABLE_QUERY_ROUTING', True)

    async def generate_sql(
        self,
        question: str,
        schema: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate SQL from natural language question

        Args:
            question: User's natural language question
            schema: Formatted table schema
            context: Additional context from previous clarifications

        Returns:
            Dict with sql, clarification, or error
        """
        try:
            # Construct user message
            user_message = f"""User question: {question}

Table schema (SQLite):
{schema}

Context (answers to prior clarifications):
{json.dumps(context)}"""

            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.2
            )

            # Extract content
            content = response.choices[0].message.content

            # Parse JSON response
            parsed = self._parse_llm_response(content)

            return parsed

        except Exception as e:
            return {
                "sql": None,
                "ask_clarification": False,
                "error": f"LLM error: {str(e)}"
            }

    async def generate_sql_with_routing(
        self,
        question: str,
        schema: str,
        schema_dict: Optional[Dict] = None,
        context: Dict[str, Any] = None,
        force_model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate SQL with intelligent routing for production scale.

        Routes queries based on complexity:
        - SIMPLE: Template-based (free, instant)
        - MEDIUM: GPT-3.5-turbo ($0.001 per query)
        - COMPLEX: GPT-4 ($0.024 per query)

        Args:
            question: User's natural language question
            schema: Formatted table schema string
            schema_dict: Optional parsed schema dict for analysis
            context: Additional context from previous clarifications
            force_model: Optional model to force (for testing/A/B)

        Returns:
            Dict with sql, explanation, and routing metadata
        """
        if context is None:
            context = {}

        # Check if routing is enabled
        if not self.enable_routing:
            # Fall back to standard generation with configured model
            return await self.generate_sql(question, schema, context)

        try:
            # Route the query
            complexity, template_result, routing_metadata = self.router.route(
                question=question,
                schema=schema_dict,
                force_model=force_model
            )

            # If template matched, return immediately (no LLM call)
            if template_result:
                return {
                    "sql": template_result["sql"],
                    "ask_clarification": False,
                    "clarification": None,
                    "explanation": template_result["explanation"],
                    "routing": routing_metadata
                }

            # Determine which model to use based on complexity
            if complexity == QueryComplexity.MEDIUM:
                model = "gpt-3.5-turbo"
            else:  # COMPLEX
                model = "gpt-4"

            # Construct user message
            user_message = f"""User question: {question}

Table schema (SQLite):
{schema}

Context (answers to prior clarifications):
{json.dumps(context)}"""

            # Call OpenAI API with selected model
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.2
            )

            # Extract and parse content
            content = response.choices[0].message.content
            parsed = self._parse_llm_response(content)

            # Add routing metadata
            parsed["routing"] = routing_metadata

            return parsed

        except Exception as e:
            return {
                "sql": None,
                "ask_clarification": False,
                "error": f"LLM error: {str(e)}",
                "routing": {"error": str(e)}
            }

    def _parse_llm_response(self, content: str) -> Dict[str, Any]:
        """
        Parse LLM response and validate format

        Args:
            content: Raw LLM response

        Returns:
            Parsed and validated response dict
        """
        # Try to extract JSON from response
        try:
            # Look for JSON block
            if "{" in content and "}" in content:
                start = content.find("{")
                end = content.rfind("}") + 1
                json_str = content[start:end]
                parsed = json.loads(json_str)
            else:
                raise ValueError("No JSON found in response")

            # Validate required keys
            if "ask_clarification" not in parsed or "sql" not in parsed:
                raise ValueError("Missing required keys in response")

            return parsed

        except (json.JSONDecodeError, ValueError) as e:
            return {
                "sql": None,
                "ask_clarification": False,
                "error": f"Failed to parse LLM response: {str(e)}"
            }
