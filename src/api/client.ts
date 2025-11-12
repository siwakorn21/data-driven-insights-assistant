/**
 * API client for backend communication
 */
import type {
  UploadResponse,
  SchemaResponse,
  QueryRequest,
  QueryResponse,
  ExecuteSQLRequest,
  ExecuteSQLResponse,
  HealthResponse,
  DeleteSessionResponse,
} from '@/types/api';

// Get API URL from environment variable or default to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * API client class with methods for all backend endpoints
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Handle fetch errors and parse response
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    return this.handleResponse<HealthResponse>(response);
  }

  /**
   * Upload CSV file and create session
   */
  async uploadCSV(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    return this.handleResponse<UploadResponse>(response);
  }

  /**
   * Get schema for a session
   */
  async getSchema(sessionId: string): Promise<SchemaResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/sessions/${sessionId}/schema`
    );
    return this.handleResponse<SchemaResponse>(response);
  }

  /**
   * Execute natural language query
   */
  async executeQuery(request: QueryRequest): Promise<QueryResponse> {
    const response = await fetch(`${this.baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return this.handleResponse<QueryResponse>(response);
  }

  /**
   * Execute raw SQL query
   */
  async executeSQL(request: ExecuteSQLRequest): Promise<ExecuteSQLResponse> {
    const response = await fetch(`${this.baseUrl}/api/execute-sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return this.handleResponse<ExecuteSQLResponse>(response);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<DeleteSessionResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/sessions/${sessionId}`,
      {
        method: 'DELETE',
      }
    );

    return this.handleResponse<DeleteSessionResponse>(response);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };
