"""
Query routing service for production-scale optimization.
Routes queries based on complexity to optimize cost while maintaining quality.
"""
import re
from typing import Dict, List, Optional, Tuple
from enum import Enum


class QueryComplexity(str, Enum):
    """Query complexity levels"""
    SIMPLE = "simple"      # Template-based
    MEDIUM = "medium"      # GPT-3.5-turbo
    COMPLEX = "complex"    # GPT-4


class QueryTemplate:
    """Template-based query generator for simple queries"""

    # Common simple query patterns
    TEMPLATES = {
        # Show all data
        r"(?i)(show|display|get|select)\s+(all|everything|entire)": {
            "sql": 'SELECT * FROM "data" LIMIT 50',
            "explanation": "Showing first 50 rows of all data"
        },
        r"(?i)^(all|everything)$": {
            "sql": 'SELECT * FROM "data" LIMIT 50',
            "explanation": "Showing first 50 rows of all data"
        },

        # Show first N rows
        r"(?i)(show|display|get|select)\s+(first|top)\s+(\d+)(\s+rows?)?": {
            "sql": 'SELECT * FROM "data" LIMIT {limit}',
            "explanation": "Showing first {limit} rows"
        },

        # Count all rows
        r"(?i)(count|total|how\s+many)\s+(all|rows?|records?)": {
            "sql": 'SELECT COUNT(*) as count FROM "data"',
            "explanation": "Counting total rows in the dataset"
        },
        r"(?i)^count$": {
            "sql": 'SELECT COUNT(*) as count FROM "data"',
            "explanation": "Counting total rows in the dataset"
        },
    }

    @classmethod
    def match(cls, question: str) -> Optional[Dict]:
        """
        Try to match question with a template.
        Returns SQL and explanation if matched, None otherwise.
        """
        for pattern, template in cls.TEMPLATES.items():
            match = re.search(pattern, question.strip())
            if match:
                # Extract limit if present
                if "limit" in template["sql"]:
                    try:
                        limit = int(match.group(3)) if match.lastindex >= 3 else 10
                        return {
                            "sql": template["sql"].format(limit=limit),
                            "explanation": template["explanation"].format(limit=limit)
                        }
                    except (IndexError, ValueError):
                        pass

                return {
                    "sql": template["sql"],
                    "explanation": template["explanation"]
                }

        return None


class QueryComplexityAnalyzer:
    """Analyzes query complexity to determine routing strategy"""

    # Keywords indicating complex queries
    COMPLEX_KEYWORDS = [
        # Multiple operations
        r'\band\b', r'\bor\b', r'\bnot\b',
        # Subqueries and CTEs
        r'\bwith\b.*\bas\b', r'\bselect\b.*\bfrom\b.*\bselect\b',
        # Window functions
        r'\bover\b.*\bpartition\b', r'\brow_number\b', r'\brank\b', r'\blead\b', r'\blag\b',
        # Complex aggregations
        r'\bhaving\b', r'\bcase\b.*\bwhen\b', r'\bcoalesce\b',
        # Multiple joins
        r'\bjoin\b.*\bjoin\b',
        # Date/time operations (SQL and natural language)
        r'\bdate_trunc\b', r'\binterval\b', r'\bextract\b',
        r'\blast\s+(week|month|year|quarter|day)\b',
        r'\bthis\s+(week|month|year|quarter)\b',
        r'\byesterday\b', r'\btoday\b', r'\btomorrow\b',
        r'\bpast\s+\d+\s+(days?|weeks?|months?|years?)\b',
        r'\bnext\s+\d+\s+(days?|weeks?|months?|years?)\b',
        # Complex conditions
        r'\bbetween\b.*\band\b', r'\bin\b\s*\(.*,.*,.*\)',
        # Multiple exclusions
        r'\bexcluding\b', r'\bexcept\b', r'\bnot\s+in\b',
    ]

    # Keywords indicating medium complexity
    MEDIUM_KEYWORDS = [
        # Single aggregations
        r'\bavg\b', r'\bsum\b', r'\bcount\b', r'\bmax\b', r'\bmin\b',
        # Grouping
        r'\bgroup\s+by\b', r'\bper\b',
        # Single join
        r'\bjoin\b',
        # Sorting
        r'\border\s+by\b', r'\btop\b', r'\bbottom\b',
        # Filtering
        r'\bwhere\b', r'\bfilter\b', r'\bgreater\b', r'\bless\b',
    ]

    @classmethod
    def analyze(cls, question: str, schema: Optional[Dict] = None) -> Tuple[QueryComplexity, Dict]:
        """
        Analyze query complexity.

        Returns:
            Tuple of (complexity_level, metadata)
        """
        question_lower = question.lower()
        word_count = len(question.split())

        metadata = {
            "word_count": word_count,
            "has_column_names": False,
            "complexity_score": 0
        }

        # Check if question mentions specific column names
        if schema and "columns" in schema:
            column_names = [col["name"].lower() for col in schema["columns"]]
            for col_name in column_names:
                if col_name in question_lower:
                    metadata["has_column_names"] = True
                    break

        # Check for template match first
        if QueryTemplate.match(question):
            metadata["complexity_score"] = 0
            metadata["reason"] = "Matches simple template"
            return QueryComplexity.SIMPLE, metadata

        # Very short questions are typically simple
        if word_count <= 3:
            metadata["complexity_score"] = 1
            metadata["reason"] = "Very short question"
            return QueryComplexity.SIMPLE, metadata

        # Check for complex patterns
        complex_matches = 0
        has_datetime = False
        datetime_patterns = [
            r'\blast\s+(week|month|year|quarter|day)\b',
            r'\bthis\s+(week|month|year|quarter)\b',
            r'\byesterday\b', r'\btoday\b', r'\btomorrow\b',
            r'\bpast\s+\d+\s+(days?|weeks?|months?|years?)\b',
            r'\bnext\s+\d+\s+(days?|weeks?|months?|years?)\b',
        ]

        for pattern in cls.COMPLEX_KEYWORDS:
            if re.search(pattern, question_lower):
                complex_matches += 1
                # Check if this is a date/time pattern
                if pattern in datetime_patterns:
                    has_datetime = True

        # Date/time queries should always use GPT-4 for better clarification handling
        if has_datetime:
            metadata["complexity_score"] = 3
            metadata["reason"] = "Contains date/time reference (requires clarification handling)"
            metadata["complex_matches"] = complex_matches
            return QueryComplexity.COMPLEX, metadata

        if complex_matches >= 2:
            metadata["complexity_score"] = 3
            metadata["reason"] = f"Multiple complex patterns ({complex_matches})"
            metadata["complex_matches"] = complex_matches
            return QueryComplexity.COMPLEX, metadata

        # Check for medium complexity patterns
        medium_matches = 0
        for pattern in cls.MEDIUM_KEYWORDS:
            if re.search(pattern, question_lower):
                medium_matches += 1

        # Long questions with multiple medium keywords are complex
        if word_count > 15 and medium_matches >= 2:
            metadata["complexity_score"] = 3
            metadata["reason"] = "Long question with multiple operations"
            metadata["medium_matches"] = medium_matches
            return QueryComplexity.COMPLEX, metadata

        # Medium complexity if has aggregation/grouping/filtering keywords
        if medium_matches >= 1 or word_count >= 8:
            metadata["complexity_score"] = 2
            metadata["reason"] = "Contains aggregation/grouping/filtering"
            metadata["medium_matches"] = medium_matches
            return QueryComplexity.MEDIUM, metadata

        # Default to simple for short, straightforward questions
        metadata["complexity_score"] = 1
        metadata["reason"] = "Simple query"
        return QueryComplexity.SIMPLE, metadata


class QueryRouter:
    """
    Routes queries to appropriate generation strategy based on complexity.

    Strategy:
    - SIMPLE: Use template-based generation (free, instant)
    - MEDIUM: Use GPT-3.5-turbo ($0.001 per query)
    - COMPLEX: Use GPT-4 ($0.024 per query)
    """

    def __init__(self):
        self.analyzer = QueryComplexityAnalyzer()
        self.template = QueryTemplate()

    def route(
        self,
        question: str,
        schema: Optional[Dict] = None,
        force_model: Optional[str] = None
    ) -> Tuple[QueryComplexity, Optional[Dict], Dict]:
        """
        Route query to appropriate generation strategy.

        Args:
            question: User's natural language question
            schema: Optional table schema for better analysis
            force_model: Optional model to force (for testing)

        Returns:
            Tuple of (complexity, template_result, metadata)
            - complexity: Determined complexity level
            - template_result: Dict with SQL and explanation if template matched, None otherwise
            - metadata: Analysis metadata including routing decision
        """
        # Allow forcing specific model (useful for A/B testing)
        if force_model:
            if force_model == "template":
                template_result = self.template.match(question)
                return QueryComplexity.SIMPLE, template_result, {"forced": True}
            elif force_model == "gpt-3.5-turbo":
                return QueryComplexity.MEDIUM, None, {"forced": True, "model": force_model}
            elif force_model == "gpt-4":
                return QueryComplexity.COMPLEX, None, {"forced": True, "model": force_model}

        # Analyze complexity
        complexity, metadata = self.analyzer.analyze(question, schema)

        # Try template match for simple queries
        if complexity == QueryComplexity.SIMPLE:
            template_result = self.template.match(question)
            if template_result:
                metadata["strategy"] = "template"
                return complexity, template_result, metadata
            else:
                # No template match, upgrade to medium
                complexity = QueryComplexity.MEDIUM
                metadata["reason"] = "No template match, upgraded to GPT-3.5"

        # Set routing strategy metadata
        if complexity == QueryComplexity.MEDIUM:
            metadata["strategy"] = "gpt-3.5-turbo"
            metadata["model"] = "gpt-3.5-turbo"
        elif complexity == QueryComplexity.COMPLEX:
            metadata["strategy"] = "gpt-4"
            metadata["model"] = "gpt-4"

        return complexity, None, metadata
