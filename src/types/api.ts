/**
 * TypeScript types for API requests and responses
 * These match the Pydantic models in the backend
 */

// Upload Types
export interface UploadResponse {
  session_id: string;
  filename: string;
  row_count: number;
  column_count: number;
}

// Schema Types
export interface ColumnSchema {
  name: string;
  type: string;
  sample?: any;
}

export interface SchemaResponse {
  session_id: string;
  columns: ColumnSchema[];
  row_count: number;
}

// Query Types
export interface QueryRequest {
  session_id: string;
  question: string;
  context?: Record<string, any>;
}

export interface ClarificationQuestion {
  question: string;
  id: string;
  kind: string;
  options?: string[];
}

export interface QueryResponse {
  sql?: string;
  columns?: string[];
  rows?: Record<string, any>[];
  ask_clarification: boolean;
  clarification?: ClarificationQuestion;
  explanation?: string;
  error?: string;
}

// SQL Execution Types
export interface ExecuteSQLRequest {
  session_id: string;
  sql: string;
}

export interface ExecuteSQLResponse {
  columns: string[];
  rows: Record<string, any>[];
  row_count: number;
}

// Health Check
export interface HealthResponse {
  status: string;
  duckdb_version: string;
  version: string;
}

// Session Management
export interface DeleteSessionResponse {
  success: boolean;
  message: string;
}
