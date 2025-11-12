"""
DuckDB service for CSV querying
"""
import duckdb
from typing import List, Tuple, Dict, Any
from app.models import ColumnSchema


class DuckDBService:
    """Service for DuckDB operations on CSV files"""

    def get_file_info(self, csv_path: str) -> Tuple[int, int]:
        """
        Get basic file information (row count and column count)

        Args:
            csv_path: Path to CSV file

        Returns:
            Tuple of (row_count, column_count)
        """
        conn = duckdb.connect(':memory:')
        try:
            # Get row count - convert to Python int
            row_count = int(conn.execute(
                f"SELECT COUNT(*) FROM read_csv_auto('{csv_path}')"
            ).fetchone()[0])

            # Get column count - DESCRIBE returns a row for each column
            describe_result = conn.execute(
                f"DESCRIBE SELECT * FROM read_csv_auto('{csv_path}')"
            ).fetchall()
            column_count = len(describe_result)

            return row_count, column_count
        finally:
            conn.close()

    def get_schema(self, csv_path: str) -> Tuple[List[ColumnSchema], int]:
        """
        Get schema information for the CSV file

        Args:
            csv_path: Path to CSV file

        Returns:
            Tuple of (list of ColumnSchema objects, row_count)
        """
        conn = duckdb.connect(':memory:')
        try:
            # Get column information
            schema_df = conn.execute(
                f"DESCRIBE SELECT * FROM read_csv_auto('{csv_path}')"
            ).df()

            # Get sample values (first row)
            sample_df = conn.execute(
                f"SELECT * FROM read_csv_auto('{csv_path}') LIMIT 1"
            ).df()

            # Get row count - convert to Python int
            row_count = int(conn.execute(
                f"SELECT COUNT(*) FROM read_csv_auto('{csv_path}')"
            ).fetchone()[0])

            # Build column schema list
            columns = []
            for _, row in schema_df.iterrows():
                col_name = row['column_name']
                col_type = row['column_type']

                # Get sample value and convert numpy types to Python native types
                if not sample_df.empty:
                    sample_value = sample_df[col_name].iloc[0]
                    # Convert numpy types to Python native types for JSON serialization
                    if hasattr(sample_value, 'item'):
                        sample_value = sample_value.item()
                else:
                    sample_value = None

                columns.append(ColumnSchema(
                    name=col_name,
                    type=col_type,
                    sample=sample_value
                ))

            return columns, row_count
        finally:
            conn.close()

    def format_schema_for_llm(self, columns: List[ColumnSchema]) -> str:
        """
        Format schema for LLM prompt

        Args:
            columns: List of ColumnSchema objects

        Returns:
            Formatted schema string
        """
        schema_lines = []
        for col in columns:
            sample_str = f"e.g. {col.sample}" if col.sample is not None else ""
            schema_lines.append(f"- {col.name} ({col.type}) {sample_str}")

        return "\n".join(schema_lines)

    def execute_query(self, csv_path: str, sql: str) -> Tuple[List[str], List[Dict[str, Any]]]:
        """
        Execute SQL query on CSV file

        Args:
            csv_path: Path to CSV file
            sql: SQL query to execute

        Returns:
            Tuple of (column_names, rows as list of dicts)
        """
        conn = duckdb.connect(':memory:')
        try:
            # Register CSV as a view named "data"
            conn.execute(f"CREATE VIEW data AS SELECT * FROM read_csv_auto('{csv_path}')")

            # Execute user query
            result = conn.execute(sql).df()

            # Convert to list of dicts and handle numpy types
            columns = list(result.columns)
            rows = result.to_dict('records')

            # Convert numpy types to Python native types for JSON serialization
            for row in rows:
                for key, value in row.items():
                    if hasattr(value, 'item'):
                        row[key] = value.item()

            return columns, rows
        finally:
            conn.close()
