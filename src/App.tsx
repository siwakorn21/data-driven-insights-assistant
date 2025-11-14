import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Send, Database, Sparkles, Bot, HelpCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
  Cell
} from "recharts";
import { CHART_COLORS, WELCOME_MESSAGE } from "@/config/constants";
import { apiClient } from "@/api";
import type { ColumnSchema } from "@/types/api";

// ---------- Types ----------
type RowData = Record<string, any>;
type ChartHint = { type: 'line' | 'bar'; x: string; y: string } | null;
type Message = { role: string; content: string };

// ---------- Utilities ----------
const looksDateish = (colName: string, sample?: any): boolean =>
  /date|time|day|month|year/i.test(colName) || (!!sample && !isNaN(new Date(sample).getTime()));

const isNumeric = (v: any): boolean => typeof v === "number" && !Number.isNaN(v);

const head = <T,>(arr: T[], n = 5): T[] => arr.slice(0, n);

// Format numbers with commas and decimals
const formatNumber = (value: any): string => {
  if (value === null || value === undefined) return "N/A";
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// Format dates for chart display
const formatDate = (value: any): string => {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function App() {
  // Session state
  const [sessionId, setSessionId] = useState<string>("");
  const [, setFileName] = useState<string>("");

  // Data state
  const [rowCount, setRowCount] = useState<number>(0);
  const [columnCount, setColumnCount] = useState<number>(0);
  const [schemaText, setSchemaText] = useState<string>("");

  // UI state
  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: WELCOME_MESSAGE }
  ]);
  const [userInput, setUserInput] = useState<string>("");
  const [pending, setPending] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Result state
  const [result, setResult] = useState<{ columns: string[]; rows: RowData[] }>({
    columns: [],
    rows: []
  });
  const [lastSQL, setLastSQL] = useState<string>("");
  const [chartHint, setChartHint] = useState<ChartHint>(null);

  // Data preview state
  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: RowData[] }>({
    columns: [],
    rows: []
  });

  const [clarContext, setClarContext] = useState<Record<string, any>>({});
  const [pendingClarification, setPendingClarification] = useState<{ originalQuestion: string; clarificationId: string } | null>(null);

  // -------- CSV Upload --------
  const onCSV = async (file: File) => {
    setError("");
    setUploading(true);

    try {
      // Call backend upload API
      const response = await apiClient.uploadCSV(file);

      // Update state with response
      setSessionId(response.session_id);
      setFileName(response.filename);
      setRowCount(response.row_count);
      setColumnCount(response.column_count);

      // Get schema from backend
      const schemaResponse = await apiClient.getSchema(response.session_id);

      // Format schema for display
      const schemaLines = schemaResponse.columns.map((col: ColumnSchema) => {
        const sample = col.sample !== null && col.sample !== undefined ? col.sample : "";
        return `- ${col.name} (${col.type}) e.g. ${sample}`;
      });
      setSchemaText(schemaLines.join("\n"));

      // Fetch preview data (first 50 rows)
      const previewResponse = await apiClient.executeSQL({
        session_id: response.session_id,
        sql: 'SELECT * FROM "data" LIMIT 50'
      });
      setPreviewData({ columns: previewResponse.columns, rows: previewResponse.rows });

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Loaded ${response.row_count} rows, ${response.column_count} columns.`
        }
      ]);
    } catch (e: any) {
      console.error(e);
      setError(`Failed to upload CSV: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  // -------- Pivot Data for Multi-Series Charts --------

  function pivotData(data: RowData[], xCol: string, groupCol: string, yCol: string): RowData[] {
    const pivoted: Record<string, any> = {};

    data.forEach(row => {
      const xVal = row[xCol];
      const groupVal = row[groupCol];
      let yVal = row[yCol];

      // Convert string numbers to actual numbers
      if (typeof yVal === 'string' && !isNaN(Number(yVal))) {
        yVal = Number(yVal);
      }

      if (!pivoted[xVal]) {
        pivoted[xVal] = { [xCol]: xVal };
      }
      pivoted[xVal][groupVal] = yVal;
    });

    return Object.values(pivoted);
  }

  // -------- Auto Chart --------
  function autoChart(columns: string[], data: RowData[]): ChartHint {
    console.log("autoChart called:", { columns, dataLength: data.length, firstRow: data[0] });

    if (!columns.length || !data.length) {
      console.log("No columns or data");
      return null;
    }

    // Validate we have enough data
    if (data.length < 1) {
      console.log("Not enough data");
      return null;
    }

    // Case 1: Exactly 2 columns (simple x-y)
    if (columns.length === 2) {
      const [x, y] = columns;
      const numericY = data.every((r) => isNumeric(r[y]) || r[y] == null);
      const dateX = looksDateish(x, data[0]?.[x]);
      console.log("Case 1 (2 columns):", { x, y, numericY, dateX });
      if (numericY) return { type: dateX ? "line" as const : "bar" as const, x, y };
    }

    // Case 2: Multiple columns - already pivoted or other multi-column data
    // Find x (first string/date column) and y columns (remaining numeric columns)
    const xCol = columns.find((c) => {
      const firstVal = data[0]?.[c];
      const isString = typeof firstVal === "string";
      const isDate = looksDateish(c, firstVal);
      console.log(`Checking column ${c}:`, { firstVal, isString, isDate });
      return isString || isDate;
    });

    console.log("Found xCol:", xCol);

    if (xCol) {
      const numericCols = columns.filter((c) => {
        if (c === xCol) return false;
        // Check if at least 50% of values are numeric (allow some nulls/missing data)
        const numericCount = data.filter((r) => isNumeric(r[c])).length;
        const ratio = numericCount / data.length;
        console.log(`Column ${c} numeric ratio:`, ratio);
        return ratio >= 0.5; // Lowered from 0.7 to 0.5
      });

      console.log("Numeric columns:", numericCols);

      if (numericCols.length > 0) {
        const isDateX = looksDateish(xCol, data[0]?.[xCol]);
        const hint = {
          type: isDateX ? "line" as const : "bar" as const,
          x: xCol,
          y: numericCols[0] // Just use first for the hint
        };
        console.log("Returning hint (Case 2):", hint);
        return hint;
      }
    }

    // Fallback: pick first string as x and first numeric as y
    const x = columns.find((c) => typeof data[0]?.[c] === "string");
    const y = columns.find((c) => {
      const numericCount = data.filter((r) => isNumeric(r[c])).length;
      return numericCount / data.length >= 0.5; // Lowered from 0.7 to 0.5
    });

    console.log("Fallback:", { x, y });

    if (x && y) return { type: "bar" as const, x, y };

    // Super fallback: just use first column as x and second as y if we have at least 2 columns
    if (columns.length >= 2) {
      console.log("Using super fallback - first 2 columns");
      return { type: "bar" as const, x: columns[0], y: columns[1] };
    }

    console.log("No valid chart configuration found");
    return null;
  }

  // -------- Send Query --------
  async function onSend() {
    if (!userInput.trim()) return;
    if (!sessionId) {
      setError("Please upload a CSV file first.");
      return;
    }

    setPending(true);
    setError("");
    setMessages((m) => [...m, { role: "user", content: userInput }]);

    try {
      // Build context: if answering a clarification, include original question
      let queryContext = { ...clarContext };
      if (pendingClarification) {
        queryContext = {
          ...queryContext,
          original_question: pendingClarification.originalQuestion,
          clarification_answer: userInput,
          clarification_id: pendingClarification.clarificationId,
        };
      }

      // Call backend query API
      const response = await apiClient.executeQuery({
        session_id: sessionId,
        question: pendingClarification ? pendingClarification.originalQuestion : userInput,
        context: queryContext,
      });

      // Handle clarification
      if (response.ask_clarification) {
        const q = response.clarification;
        const opts = q?.options?.length ? `\nOptions: ${q.options.join(", ")}` : "";

        // Store pending clarification
        setPendingClarification({
          originalQuestion: userInput,
          clarificationId: q?.id || 'clarification',
        });

        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `${q?.question || "Could you clarify?"}${opts}`
          }
        ]);
      }
      // Handle error
      else if (response.error) {
        setError(response.error);
        setPendingClarification(null); // Clear clarification on error
      }
      // Handle SQL result or conversational response
      else {
        const { sql, columns, rows, explanation } = response;

        // Clear pending clarification when we get a successful response
        setPendingClarification(null);

        // Conversational response (no SQL generated, just explanation)
        if (!sql) {
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: explanation || "I'm here to help! Ask me about your data."
            }
          ]);
          return;
        }

        // SQL result
        if (!columns || !rows) {
          throw new Error("Invalid response from backend");
        }

        setLastSQL(sql);

        // Check if we need to pivot for multi-series charting
        // Only pivot if: 3 columns, 1 numeric (value), 2 categorical (x-axis + series)
        const shouldPivot = columns.length === 3 && rows.length > 0;

        if (shouldPivot) {
          const numericCols = columns.filter((c) => {
            const numericCount = rows.filter((r: any) => isNumeric(r[c])).length;
            return numericCount / rows.length >= 0.5; // At least 50% numeric
          });
          const stringCols = columns.filter((c) => !numericCols.includes(c));

          if (numericCols.length === 1 && stringCols.length === 2) {
            const yCol = numericCols[0];
            const [col1, col2] = stringCols;
            const col1LooksDate = looksDateish(col1, rows[0]?.[col1]);
            const col2LooksDate = looksDateish(col2, rows[0]?.[col2]);

            // Prefer date column as x-axis, otherwise use first column
            const xCol = (col1LooksDate && !col2LooksDate) ? col1 : (col2LooksDate && !col1LooksDate) ? col2 : col1;
            const groupCol = xCol === col1 ? col2 : col1;

            try {
              const pivotedData = pivotData(rows as RowData[], xCol, groupCol, yCol);
              console.log("Pivot result:", { xCol, groupCol, yCol, pivotedData });

              if (pivotedData.length > 0 && Object.keys(pivotedData[0]).length > 1) {
                const pivotedColumns = Object.keys(pivotedData[0]);
                console.log("Using pivoted data:", { columns: pivotedColumns, rowCount: pivotedData.length });
                setResult({ columns: pivotedColumns, rows: pivotedData });
                const hint = autoChart(pivotedColumns, pivotedData);
                console.log("Chart hint:", hint);
                setChartHint(hint);
              } else {
                // Pivot failed, use original data
                console.log("Pivot failed, using original data");
                setResult({ columns, rows });
                setChartHint(autoChart(columns, rows));
              }
            } catch (e) {
              console.error("Pivot error:", e);
              setResult({ columns, rows });
              setChartHint(autoChart(columns, rows));
            }
          } else {
            setResult({ columns, rows });
            setChartHint(autoChart(columns, rows));
          }
        } else {
          setResult({ columns, rows });
          setChartHint(autoChart(columns, rows));
        }

        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: explanation || "Here's what I found."
          }
        ]);
      }
    } catch (e: any) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setPending(false);
      setUserInput("");
    }
  }

  // -------- Execute SQL --------
  const runSQL = async (sql: string) => {
    if (!sql.trim()) {
      setError("SQL query is empty");
      return;
    }
    if (!sessionId) {
      setError("No session found. Please upload a CSV file.");
      return;
    }

    try {
      setError("");
      const response = await apiClient.executeSQL({
        session_id: sessionId,
        sql: sql,
      });

      setResult({ columns: response.columns, rows: response.rows });
      setChartHint(autoChart(response.columns, response.rows));
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Query executed successfully." }
      ]);
    } catch (e: any) {
      setError(String(e.message || e));
    }
  };

  // -------- Download CSV --------
  const downloadCSV = () => {
    if (!result.columns.length) return;

    const header = result.columns.join(",");
    const lines = result.rows.map((r: RowData) =>
      result.columns.map((c) => JSON.stringify(r[c] ?? "")).join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query_result.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            <h1 className="text-xl font-semibold">Data-Driven Insights Assistant</h1>
            <Badge variant="secondary">Backend-Powered</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Upload + Schema */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5"/> Upload CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files && onCSV(e.target.files[0])}
                disabled={uploading}
              />
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin"/> Uploading...
                </div>
              )}
              {sessionId && (
                <Alert>
                  <AlertTitle>Table ready</AlertTitle>
                  <AlertDescription>
                    <div className="flex items-center gap-2 text-sm">
                      <Database className="w-4 h-4"/>
                      Loaded {rowCount} rows, {columnCount} columns
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Session: {sessionId.substring(0, 8)}...
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              <div className="text-xs text-slate-600">
                Tip: Include columns like <em>hotel</em>, <em>revenue</em>, <em>booking_date</em>, <em>country</em>, <em>nights</em>.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schema & Hints</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-auto border rounded-md p-2 bg-slate-50">
                {schemaText || "(Upload a CSV to see inferred schema)"}
              </pre>
              <div className="text-xs text-slate-600 mt-2">
                I'll ask clarifying questions <HelpCircle className="inline w-3 h-3"/> when needed. Examples:
                <ul className="list-disc ml-4 mt-1">
                  <li>Top 5 hotels by revenue last month</li>
                  <li>Average review score by country</li>
                  <li>Bookings per day in Q3 grouped by channel</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {previewData.columns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5"/> Data Preview (First 50 rows)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-96 border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-100 border-b">
                      <tr>
                        {previewData.columns.map((col) => (
                          <th key={col} className="text-left p-2 font-semibold">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.map((row: RowData, i: number) => (
                        <tr key={i} className="odd:bg-white even:bg-slate-50 border-b">
                          {previewData.columns.map((col) => (
                            <td key={col} className="p-2">
                              {String(row[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Showing up to 50 rows. Ask questions to analyze specific data.
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Chat + Results */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-[28rem] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5"/> Ask your data
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-auto space-y-3 p-1">
                {messages.filter(m => m.role !== 'system').map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={m.role === 'user' ? 'text-right' : 'text-left'}
                  >
                    <div className={`inline-block rounded-2xl px-3 py-2 text-sm shadow ${
                      m.role === 'user' ? 'bg-blue-50' : 'bg-slate-100'
                    }`}>
                      {m.content}
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                <Textarea
                  placeholder={
                    !sessionId
                      ? "Upload a CSV file first to start asking questions..."
                      : "e.g., Show me the top 5 hotels by revenue last month"
                  }
                  className="flex-1"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSend();
                  }}
                  disabled={!sessionId || uploading}
                />
                <Button onClick={onSend} disabled={pending || !sessionId || uploading}>
                  {pending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                </Button>
              </div>
              {error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTitle>Something went wrong</AlertTitle>
                  <AlertDescription className="text-xs whitespace-pre-wrap">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="table">
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="chart">Chart</TabsTrigger>
              <TabsTrigger value="sql">SQL</TabsTrigger>
            </TabsList>

            <TabsContent value="table">
              <Card>
                <CardHeader>
                  <CardTitle>Query Result ({result.rows.length} rows)</CardTitle>
                </CardHeader>
                <CardContent>
                  {!result.columns.length ? (
                    <div className="text-sm text-slate-600">
                      Run a query to see results here.
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[28rem]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr>
                            {result.columns.map((c) => (
                              <th key={c} className="text-left p-2 border-b">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {head(result.rows, 500).map((r: RowData, i: number) => (
                            <tr key={i} className="odd:bg-slate-50">
                              {result.columns.map((c) => (
                                <td key={c} className="p-2 border-b">
                                  {String(r[c] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs text-slate-600">
                          Showing up to 500 rows.
                        </div>
                        <Button size="sm" variant="secondary" onClick={downloadCSV}>
                          Download CSV
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chart">
              <Card>
                <CardHeader>
                  <CardTitle>Visualization</CardTitle>
                </CardHeader>
                <CardContent>
                  {!chartHint || !result.rows.length ? (
                    <div className="text-sm text-slate-600">
                      Run a query that returns an X and numeric Y (and optionally date-ish X) to auto-chart.
                    </div>
                  ) : chartHint.type === 'line' ? (
                    <ResponsiveContainer width="100%" height={360}>
                      <LineChart data={result.rows as any} margin={{ top: 40, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey={chartHint.x}
                          stroke="#64748b"
                          tickFormatter={looksDateish(chartHint.x, result.rows[0]?.[chartHint.x]) ? formatDate : undefined}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          stroke="#64748b"
                          tickFormatter={formatNumber}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                          labelStyle={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '8px' }}
                          formatter={(value: any, name: string) => [formatNumber(value), name]}
                          labelFormatter={looksDateish(chartHint.x, result.rows[0]?.[chartHint.x]) ? formatDate : undefined}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          wrapperStyle={{ paddingTop: '10px', paddingRight: '10px' }}
                          iconType="line"
                        />
                        {result.columns.filter(c => c !== chartHint.x).map((col, idx) => (
                          <Line
                            key={col}
                            type="monotone"
                            dataKey={col}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={{ fill: CHART_COLORS[idx % CHART_COLORS.length], r: 4 }}
                            activeDot={{ r: 6 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={result.rows as any} margin={{ top: 40, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey={chartHint.x}
                          stroke="#64748b"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          stroke="#64748b"
                          tickFormatter={formatNumber}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                          labelStyle={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '8px' }}
                          formatter={(value: any, name: string) => [formatNumber(value), name]}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          wrapperStyle={{ paddingTop: '10px', paddingRight: '10px' }}
                        />
                        {result.columns.filter(c => c !== chartHint.x).map((col, idx) => {
                          const yColumns = result.columns.filter(c => c !== chartHint.x);
                          const isSingleColumn = yColumns.length === 1;

                          return (
                            <Bar
                              key={col}
                              dataKey={col}
                              fill={isSingleColumn ? undefined : CHART_COLORS[idx % CHART_COLORS.length]}
                              radius={[8, 8, 0, 0]}
                            >
                              {isSingleColumn && result.rows.map((row, rowIdx) => (
                                <Cell key={`cell-${rowIdx}`} fill={CHART_COLORS[rowIdx % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sql">
              <Card>
                <CardHeader>
                  <CardTitle>Generated SQL</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    className="font-mono text-xs"
                    rows={10}
                    value={lastSQL}
                    onChange={(e) => setLastSQL(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button onClick={() => runSQL(lastSQL)}>Run SQL</Button>
                    <Button variant="secondary" onClick={() => navigator.clipboard.writeText(lastSQL)}>
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-6 text-xs text-slate-500">
        <div>
          Privacy: your CSV is processed on the backend. The LLM sees only your question and the inferred schema/samples.
        </div>
      </footer>
    </div>
  );
}
