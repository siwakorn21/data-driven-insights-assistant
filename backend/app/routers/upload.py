"""
CSV upload and session management endpoints
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.models import UploadResponse, DeleteSessionResponse
from app.services.session_service import SessionService
from app.services.duckdb_service import DuckDBService
from app.config import settings

router = APIRouter()
session_service = SessionService()
duckdb_service = DuckDBService()


@router.post("/upload", response_model=UploadResponse)
async def upload_csv(file: UploadFile = File(...)):
    """
    Upload a CSV file and create a new session

    Args:
        file: CSV file to upload

    Returns:
        UploadResponse with session_id, filename, and row/column counts
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are allowed"
        )

    # Read file content
    content = await file.read()

    # Check file size
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit"
        )

    # Save file and create session
    try:
        session_id = await session_service.create_session(file.filename, content)

        # Get file info using DuckDB
        csv_path = session_service.get_csv_path(session_id)
        row_count, column_count = duckdb_service.get_file_info(csv_path)

        return UploadResponse(
            session_id=session_id,
            filename=file.filename,
            row_count=row_count,
            column_count=column_count
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process CSV file: {str(e)}"
        )


@router.delete("/sessions/{session_id}", response_model=DeleteSessionResponse)
async def delete_session(session_id: str):
    """
    Delete a session and its associated CSV file

    Args:
        session_id: Session ID to delete

    Returns:
        DeleteSessionResponse with success status
    """
    try:
        success = session_service.delete_session(session_id)

        if success:
            return DeleteSessionResponse(
                success=True,
                message=f"Session {session_id} deleted successfully"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete session: {str(e)}"
        )
