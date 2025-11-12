"""
Cleanup utilities for file management
"""
import os
import shutil
from datetime import datetime, timedelta


def cleanup_directory(directory: str, max_age_hours: int) -> int:
    """
    Clean up files in a directory older than max_age_hours

    Args:
        directory: Directory path to clean up
        max_age_hours: Maximum age in hours

    Returns:
        Number of files deleted
    """
    if not os.path.exists(directory):
        return 0

    current_time = datetime.now()
    max_age = timedelta(hours=max_age_hours)
    deleted_count = 0

    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)

        if not os.path.isfile(file_path):
            continue

        try:
            modified_time = datetime.fromtimestamp(os.path.getmtime(file_path))
            if (current_time - modified_time) > max_age:
                os.remove(file_path)
                deleted_count += 1
        except Exception as e:
            print(f"Error cleaning up {filename}: {e}")

    return deleted_count


def ensure_directory(directory: str) -> None:
    """
    Ensure directory exists, create if it doesn't

    Args:
        directory: Directory path to ensure
    """
    os.makedirs(directory, exist_ok=True)


def get_directory_size(directory: str) -> int:
    """
    Get total size of directory in bytes

    Args:
        directory: Directory path

    Returns:
        Total size in bytes
    """
    total_size = 0

    for dirpath, dirnames, filenames in os.walk(directory):
        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            if os.path.exists(file_path):
                total_size += os.path.getsize(file_path)

    return total_size
