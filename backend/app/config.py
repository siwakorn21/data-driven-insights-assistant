"""
Configuration management using pydantic-settings
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""

    # OpenAI Configuration
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"

    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:8080"

    # Session Configuration
    SESSION_TTL_HOURS: int = 2
    MAX_FILE_SIZE_MB: int = 100
    UPLOADS_DIR: str = "uploads"

    # Server Configuration
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def max_file_size_bytes(self) -> int:
        """Convert MB to bytes"""
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
