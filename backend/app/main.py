"""
FastAPI application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import duckdb

from app.config import settings
from app.routers import health, upload, query
from app.services.session_service import SessionService


# Background scheduler for cleanup tasks
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup: Start background cleanup scheduler
    session_service = SessionService()
    scheduler.add_job(
        session_service.cleanup_expired_sessions,
        'interval',
        hours=1,
        id='cleanup_sessions'
    )
    scheduler.start()
    print("✅ Background cleanup scheduler started")

    yield

    # Shutdown: Stop scheduler
    scheduler.shutdown()
    print("✅ Background cleanup scheduler stopped")


# Create FastAPI app
app = FastAPI(
    title="Data-Driven Insights Assistant API",
    description="Backend API for natural language data querying with DuckDB",
    version="1.0.0",
    lifespan=lifespan,
    redoc_url=None  # Disable ReDoc documentation
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(query.router, prefix="/api", tags=["Query"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Data-Driven Insights Assistant API",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
