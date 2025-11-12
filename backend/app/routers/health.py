"""
Health check endpoint
"""
from fastapi import APIRouter
import duckdb
from app.models import HealthResponse
from app import __version__

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns the API status and DuckDB version
    """
    # Get DuckDB version
    conn = duckdb.connect(':memory:')
    duckdb_version = conn.execute("SELECT version()").fetchone()[0]
    conn.close()

    return HealthResponse(
        status="healthy",
        duckdb_version=duckdb_version,
        version=__version__
    )
