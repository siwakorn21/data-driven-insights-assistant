"""
Pydantic models for request/response validation
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


# Upload Models
class UploadResponse(BaseModel):
    """Response after CSV upload"""
    session_id: str
    filename: str
    row_count: int
    column_count: int


# Schema Models
class ColumnSchema(BaseModel):
    """Schema information for a single column"""
    name: str
    type: str
    sample: Optional[Any] = None


class SchemaResponse(BaseModel):
    """Response containing table schema"""
    session_id: str
    columns: List[ColumnSchema]
    row_count: int


# Query Models
class QueryRequest(BaseModel):
    """Request to execute natural language query"""
    session_id: str
    question: str
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ClarificationQuestion(BaseModel):
    """Clarification question from LLM"""
    question: str
    id: str
    kind: str
    options: Optional[List[str]] = None


class QueryResponse(BaseModel):
    """Response from query execution"""
    sql: Optional[str] = None
    columns: Optional[List[str]] = None
    rows: Optional[List[Dict[str, Any]]] = None
    ask_clarification: bool = False
    clarification: Optional[ClarificationQuestion] = None
    explanation: Optional[str] = None
    error: Optional[str] = None


# SQL Execution Models
class ExecuteSQLRequest(BaseModel):
    """Request to execute raw SQL"""
    session_id: str
    sql: str


class ExecuteSQLResponse(BaseModel):
    """Response from SQL execution"""
    columns: List[str]
    rows: List[Dict[str, Any]]
    row_count: int


# Health Check
class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    duckdb_version: str
    version: str


# Session Management
class DeleteSessionResponse(BaseModel):
    """Response after session deletion"""
    success: bool
    message: str
