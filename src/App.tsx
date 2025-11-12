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
  Line
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

  const [clarContext] = useState<Record<string, any>>({});

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

  // -------- Auto Chart --------
  function autoChart(columns: string[], data: RowData[]): ChartHint {
    if (!columns.length || !data.length) return null;

    if (columns.length === 2) {
      const [x, y] = columns;
      const numericY = data.every((r) => isNumeric(r[y]) || r[y] == null);
      const dateX = looksDateish(x, data[0]?.[x]);
      if (numericY) return { type: dateX ? "line" as const : "bar" as const, x, y };
    }

    // Fallback: pick first string as x and first numeric as y
    const x = columns.find((c) => typeof data[0]?.[c] === "string");
    const y = columns.find((c) => data.every((r) => isNumeric(r[c]) || r[c] == null));
    if (x && y) return { type: "bar" as const, x, y };

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
      // Call backend query API
      const response = await apiClient.executeQuery({
        session_id: sessionId,
        question: userInput,
        context: clarContext,
      });

      // Handle clarification
      if (response.ask_clarification) {
        const q = response.clarification;
        const opts = q?.options?.length ? `\nOptions: ${q.options.join(", ")}` : "";
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
      }
      // Handle SQL result or conversational response
      else {
        const { sql, columns, rows, explanation } = response;

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
        setResult({ columns, rows });
        setChartHint(autoChart(columns, rows));
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
                    <LineChart width={800} height={360} data={result.rows as any}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey={chartHint.x} stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                        labelStyle={{ color: '#1e293b' }}
                      />
                      <Legend />
                      {result.columns.filter(c => c !== chartHint.x).map((col, idx) => (
                        <Line
                          key={col}
                          type="monotone"
                          dataKey={col}
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart width={800} height={360} data={result.rows as any}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey={chartHint.x} stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                        labelStyle={{ color: '#1e293b' }}
                      />
                      <Legend />
                      {result.columns.filter(c => c !== chartHint.x).map((col, idx) => (
                        <Bar
                          key={col}
                          dataKey={col}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                          radius={[8, 8, 0, 0]}
                        />
                      ))}
                    </BarChart>
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
