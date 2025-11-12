"""
Session management service
"""
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional
from app.config import settings


class SessionService:
    """Service for managing user sessions and CSV files"""

    def __init__(self):
        self.uploads_dir = settings.UPLOADS_DIR
        self.session_ttl = timedelta(hours=settings.SESSION_TTL_HOURS)

        # Ensure uploads directory exists
        os.makedirs(self.uploads_dir, exist_ok=True)

    async def create_session(self, filename: str, content: bytes) -> str:
        """
        Create a new session and save CSV file

        Args:
            filename: Original filename
            content: File content as bytes

        Returns:
            Generated session_id
        """
        # Generate unique session ID
        session_id = str(uuid.uuid4())

        # Save file
        csv_path = self.get_csv_path(session_id)
        with open(csv_path, 'wb') as f:
            f.write(content)

        return session_id

    def get_csv_path(self, session_id: str) -> str:
        """
        Get the file path for a session's CSV

        Args:
            session_id: Session ID

        Returns:
            Full path to CSV file
        """
        return os.path.join(self.uploads_dir, f"{session_id}.csv")

    def session_exists(self, session_id: str) -> bool:
        """
        Check if a session exists

        Args:
            session_id: Session ID to check

        Returns:
            True if session exists, False otherwise
        """
        csv_path = self.get_csv_path(session_id)
        return os.path.exists(csv_path)

    def delete_session(self, session_id: str) -> bool:
        """
        Delete a session and its CSV file

        Args:
            session_id: Session ID to delete

        Returns:
            True if deleted successfully, False if not found
        """
        csv_path = self.get_csv_path(session_id)

        if os.path.exists(csv_path):
            os.remove(csv_path)
            return True

        return False

    def cleanup_expired_sessions(self):
        """
        Clean up expired session files
        Called by background scheduler
        """
        if not os.path.exists(self.uploads_dir):
            return

        current_time = datetime.now()
        deleted_count = 0

        for filename in os.listdir(self.uploads_dir):
            file_path = os.path.join(self.uploads_dir, filename)

            # Skip if not a file
            if not os.path.isfile(file_path):
                continue

            # Check if file is expired
            if self._is_file_expired(file_path, current_time):
                try:
                    os.remove(file_path)
                    deleted_count += 1
                    print(f"🗑️  Deleted expired session file: {filename}")
                except Exception as e:
                    print(f"❌ Failed to delete {filename}: {e}")

        if deleted_count > 0:
            print(f"✅ Cleanup completed: {deleted_count} expired session(s) deleted")

    def _is_file_expired(self, file_path: str, current_time: datetime) -> bool:
        """
        Check if a file is expired based on modification time

        Args:
            file_path: Path to file
            current_time: Current datetime

        Returns:
            True if file is expired, False otherwise
        """
        try:
            modified_time = datetime.fromtimestamp(os.path.getmtime(file_path))
            return (current_time - modified_time) > self.session_ttl
        except Exception:
            return False
