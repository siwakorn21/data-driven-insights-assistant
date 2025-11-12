"""
Query execution endpoints (natural language and SQL)
"""
from fastapi import APIRouter, HTTPException, status
from app.models import (
    QueryRequest, QueryResponse,
    ExecuteSQLRequest, ExecuteSQLResponse,
    SchemaResponse
)
from app.services.session_service import SessionService
from app.services.duckdb_service import DuckDBService
from app.services.llm_service import LLMService

router = APIRouter()
session_service = SessionService()
duckdb_service = DuckDBService()
llm_service = LLMService()


@router.get("/sessions/{session_id}/schema", response_model=SchemaResponse)
async def get_schema(session_id: str):
    """
    Get the schema of the uploaded CSV

    Args:
        session_id: Session ID

    Returns:
        SchemaResponse with column information and samples
    """
    # Validate session exists
    if not session_service.session_exists(session_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )

    try:
        csv_path = session_service.get_csv_path(session_id)
        columns, row_count = duckdb_service.get_schema(csv_path)

        return SchemaResponse(
            session_id=session_id,
            columns=columns,
            row_count=row_count
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schema: {str(e)}"
        )


@router.post("/query", response_model=QueryResponse)
async def execute_query(request: QueryRequest):
    """
    Execute a natural language query using LLM to generate SQL

    Args:
        request: QueryRequest with session_id, question, and optional context

    Returns:
        QueryResponse with SQL, results, or clarification question
    """
    # Validate session exists
    if not session_service.session_exists(request.session_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {request.session_id} not found"
        )

    try:
        # Get schema for LLM context
        csv_path = session_service.get_csv_path(request.session_id)
        columns, _ = duckdb_service.get_schema(csv_path)
        schema_text = duckdb_service.format_schema_for_llm(columns)

        # Call LLM to generate SQL or ask clarification
        llm_response = await llm_service.generate_sql(
            question=request.question,
            schema=schema_text,
            context=request.context
        )

        # If asking for clarification, return early
        if llm_response.get("ask_clarification"):
            return QueryResponse(
                ask_clarification=True,
                clarification=llm_response.get("clarification"),
                explanation=llm_response.get("explanation")
            )

        # Execute SQL if provided
        sql = llm_response.get("sql")
        if not sql:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LLM did not generate SQL"
            )

        # Execute SQL with DuckDB
        columns_list, rows = duckdb_service.execute_query(csv_path, sql)

        return QueryResponse(
            sql=sql,
            columns=columns_list,
            rows=rows,
            ask_clarification=False,
            explanation=llm_response.get("explanation")
        )

    except HTTPException:
        raise
    except Exception as e:
        return QueryResponse(
            error=str(e),
            ask_clarification=False
        )


@router.post("/execute-sql", response_model=ExecuteSQLResponse)
async def execute_sql(request: ExecuteSQLRequest):
    """
    Execute raw SQL query

    Args:
        request: ExecuteSQLRequest with session_id and sql

    Returns:
        ExecuteSQLResponse with columns and rows
    """
    # Validate session exists
    if not session_service.session_exists(request.session_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {request.session_id} not found"
        )

    try:
        csv_path = session_service.get_csv_path(request.session_id)
        columns, rows = duckdb_service.execute_query(csv_path, request.sql)

        return ExecuteSQLResponse(
            columns=columns,
            rows=rows,
            row_count=len(rows)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SQL execution failed: {str(e)}"
        )
