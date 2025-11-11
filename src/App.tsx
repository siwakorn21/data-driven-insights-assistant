import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Papa from "papaparse";
// Use the browser build of sql.js to avoid Node's `fs` in bundlers
import initSqlJs from "sql.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
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
import { SYSTEM_PROMPT, CHART_COLORS, WELCOME_MESSAGE } from "@/config/prompts";

// ---------- Types ----------
type RowData = Record<string, any>;
type ChartHint = { type: 'line' | 'bar'; x: string; y: string } | null;
type Message = { role: string; content: string };

// ---------- Utilities ----------
const normalizeCol = (name: string): string =>
  String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "col";

function guessType(value: any): string {
  if (value === null || value === undefined || value === "") return "TEXT";
  const num = Number(value);
  if (!Number.isNaN(num) && value !== true && value !== false) return "REAL";
  const d = new Date(value);
  if (!isNaN(d.getTime())) return "TEXT"; // keep TEXT; use SQLite date funcs
  return "TEXT";
}

const looksDateish = (colName: string, sample?: any): boolean => /date|time|day|month|year/i.test(colName) || (!!sample && !isNaN(new Date(sample).getTime()));
const isNumeric = (v: any): boolean => typeof v === "number" && !Number.isNaN(v);
const head = <T,>(arr: T[], n = 5): T[] => arr.slice(0, n);

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");

  const [dbInit, setDbInit] = useState(false);
  const dbRef = useRef<any>(null);

  const [rows, setRows] = useState<RowData[]>([]);
  const [, setCols] = useState<string[]>([]);
  const [schemaText, setSchemaText] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: WELCOME_MESSAGE }
  ]);
  const [userInput, setUserInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] = useState<{ columns: string[]; rows: RowData[] }>({ columns: [], rows: [] });
  const [lastSQL, setLastSQL] = useState("");
  const [chartHint, setChartHint] = useState<ChartHint>(null);

  const [clarContext] = useState<Record<string, any>>({}); // e.g., { date_column: 'booking_date' }

  // -------- Init sql.js (browser build) --------
  useEffect(() => {
    (async () => {
      try {
        const SQL = await initSqlJs({ locateFile: (f: string) => `https://sql.js.org/dist/${f}` });
        dbRef.current = new SQL.Database();
        setDbInit(true);
      } catch (e) {
        console.error(e);
        setError("Failed to init in-browser SQLite.");
      }
    })();
  }, []);

  // -------- CSV ingest --------
  const onCSV = (file: File) => {
    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data as any[] || [];
        if (!data.length) {
          setError("CSV is empty or has no header row.");
          return;
        }
        const rawCols = Object.keys(data[0]);
        const normCols = rawCols.map(normalizeCol);
        const types = normCols.map((_c, i) => guessType(data[0][rawCols[i]]));

        try {
          const create = `DROP TABLE IF EXISTS "data"; CREATE TABLE "data"(${normCols.map((c, i) => `"${c}" ${types[i]}`).join(", ")});`;
          dbRef.current!.run(create);
          const insert = dbRef.current!.prepare(`INSERT INTO "data" (${normCols.map((c) => `"${c}"`).join(", ")}) VALUES (${normCols.map(() => "?").join(", ")});`);
          const insertedRows: RowData[] = [];
          for (const r of data) {
            const vals = normCols.map((_c, idx) => {
              const v = r[rawCols[idx]];
              if (types[idx] === "REAL") {
                const n = Number(v);
                return Number.isNaN(n) ? null : n;
              }
              return v === "" ? null : v;
            });
            insert.run(vals);
            insertedRows.push(Object.fromEntries(normCols.map((c, i) => [c, vals[i]])));
          }
          insert.free();

          setRows(insertedRows);
          setCols(normCols);

          const samples = head(insertedRows, 5);
          const schemaLines = normCols.map((c, i) => {
            const sample = samples.map((s) => s[c]).find((v) => v !== undefined && v !== null);
            return `- ${c} (${types[i]}) e.g. ${sample}`;
          });
          setSchemaText(schemaLines.join("\n"));

          setMessages((m) => [...m, { role: "assistant", content: `Loaded ${insertedRows.length} rows, ${normCols.length} columns.` }]);
        } catch (e) {
          console.error(e);
          setError("Failed to load CSV into in-browser database.");
        }
      },
      error: (err) => {
        console.error(err);
        setError("Failed to parse CSV.");
      }
    });
  };

  // -------- LLM planner --------
  // Sends request to OpenAI to convert natural language to SQL
  // For details on what data is sent, see: docs/API_REQUEST.md
  async function callPlanner(nl: string, context: Record<string, any> = {}) {
    if (!apiKey) throw new Error("Please enter your OpenAI API key.");

    // Construct user message with question + schema
    // Only sends: question, column names, types, and sample values (first row)
    // Does NOT send: full CSV data, all rows, or sensitive information
    const user = `User question: ${nl}\n\nTable schema (SQLite):\n${schemaText}\n\nContext (answers to prior clarifications):\n${JSON.stringify(context)}`;

    const body = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user }
      ],
      temperature: 0.2
    };
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(await resp.text());
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || "";

    // Try to parse strict JSON
    const match = content.match(/\{[\s\S]*\}/);
    const raw = match ? match[0] : content;
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      throw new Error("Planner did not return valid JSON.\n" + content);
    }
    // Validate envelope
    if (!("ask_clarification" in parsed) || !("sql" in parsed)) {
      throw new Error("Planner JSON missing required keys.");
    }
    return parsed;
  }

  const runSQL = (sql: string): { columns: string[]; rows: RowData[] } => {
    if (!sql || sql.trim() === '') {
      throw new Error('SQL query is empty');
    }
    if (!dbRef.current) {
      throw new Error('Database not initialized. Please refresh the page.');
    }
    if (rows.length === 0) {
      throw new Error('No data loaded. Please upload a CSV file first.');
    }
    try {
      const stmt = dbRef.current.prepare(sql);
      const out: RowData[] = [];
      const names = stmt.getColumnNames();
      while (stmt.step()) out.push(stmt.getAsObject());
      stmt.free();
      return { columns: names, rows: out };
    } catch (e: any) {
      const msg = e.message || 'Invalid SQL query';
      if (msg.includes('no such table')) {
        throw new Error('Table not found. Please upload a CSV file first.');
      }
      throw new Error(`SQL Error: ${msg}`);
    }
  };

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

  async function onSend() {
    if (!userInput.trim()) return;
    setPending(true);
    setError("");
    setMessages((m) => [...m, { role: "user", content: userInput }]);
    try {
      const plan = await callPlanner(userInput, clarContext);
      if (plan.ask_clarification) {
        const q = plan.clarification;
        const opts = q?.options?.length ? `\nOptions: ${q.options.join(", ")}` : "";
        setMessages((m) => [...m, { role: "assistant", content: `${q?.question || "Could you clarify?"}${opts}` }]);
      } else {
        const { sql, explanation } = plan;
        if (!sql) {
          throw new Error("AI did not generate a SQL query. Please try rephrasing your question.");
        }
        const exec = runSQL(sql);
        setLastSQL(sql);
        setResult(exec);
        setChartHint(autoChart(exec.columns, exec.rows));
        setMessages((m) => [...m, { role: "assistant", content: explanation || "Here's what I found." }]);
      }
    } catch (e: any) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setPending(false);
      setUserInput("");
    }
  }

  // When user answers a clarification, call planner again with context
  // async function answerClarification(id: string, value: any) {
  //   const ctx = { ...clarContext, [id]: value };
  //   setClarContext(ctx);
  //   setPending(true);
  //   setError("");
  //   try {
  //     const plan = await callPlanner(messages.filter(m=>m.role==="user").slice(-1)[0]?.content || "", ctx);
  //     if (plan.ask_clarification) {
  //       const q = plan.clarification;
  //       const opts = q?.options?.length ? `\nOptions: ${q.options.join(", ")}` : "";
  //       setMessages((m) => [...m, { role: "assistant", content: `${q?.question || "Could you clarify?"}${opts}` }]);
  //     } else {
  //       const { sql, explanation } = plan;
  //       const exec = runSQL(sql);
  //       setLastSQL(sql);
  //       setResult(exec);
  //       setChartHint(autoChart(exec.columns, exec.rows));
  //       setMessages((m) => [...m, { role: "assistant", content: explanation || "Here's what I found." }]);
  //     }
  //   } catch (e: any) {
  //     console.error(e);
  //     setError(String(e.message || e));
  //   } finally {
  //     setPending(false);
  //   }
  // }

  const downloadCSV = () => {
    if (!result.columns.length) return;
    const header = result.columns.join(",");
    const lines = result.rows.map((r: RowData) => result.columns.map((c) => JSON.stringify(r[c] ?? "")).join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "query_result.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            <h1 className="text-xl font-semibold">Data-Driven Insights Assistant</h1>
            <Badge variant="secondary">Client-only</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="model" className="text-sm">Model</Label>
            <select id="model" className="border rounded-md px-2 py-1 text-sm" value={model} onChange={(e)=>setModel(e.target.value)}>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            </select>
            <Input type="password" placeholder="OpenAI API Key" value={apiKey} onChange={(e)=>setApiKey(e.target.value)} className="w-56" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Upload + Schema */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5"/> Upload CSV</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input type="file" accept=".csv,text/csv" onChange={(e)=> e.target.files && onCSV(e.target.files[0])} />
              {!dbInit && (
                <div className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="w-4 h-4 animate-spin"/> Initializing SQLite…</div>
              )}
              {rows.length>0 && (
                <Alert>
                  <AlertTitle>Table ready</AlertTitle>
                  <AlertDescription>
                    <div className="flex items-center gap-2 text-sm"><Database className="w-4 h-4"/> Loaded {rows.length} rows</div>
                  </AlertDescription>
                </Alert>
              )}
              <div className="text-xs text-slate-600">Tip: Include columns like <em>hotel</em>, <em>revenue</em>, <em>booking_date</em>, <em>country</em>, <em>nights</em>.</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schema & Hints</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-auto border rounded-md p-2 bg-slate-50">{schemaText || "(Upload a CSV to see inferred schema)"}</pre>
              <div className="text-xs text-slate-600 mt-2">
                I’ll ask clarifying questions <HelpCircle className="inline w-3 h-3"/> when needed. Examples:
                <ul className="list-disc ml-4 mt-1">
                  <li>Top 5 hotels by revenue last month</li>
                  <li>Average review score by country</li>
                  <li>Bookings per day in Q3 grouped by channel</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Chat + Results */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-[28rem] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5"/> Ask your data</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-auto space-y-3 p-1">
                {messages.filter(m=>m.role!=='system').map((m,i)=> (
                  <motion.div key={i} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} className={m.role==='user' ? 'text-right' : 'text-left'}>
                    <div className={`inline-block rounded-2xl px-3 py-2 text-sm shadow ${m.role==='user' ? 'bg-blue-50' : 'bg-slate-100'}`}>{m.content}</div>
                  </motion.div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                <Textarea
                  placeholder={
                    !dbInit ? "Initializing database..." :
                    !rows.length ? "Upload a CSV file first to start asking questions..." :
                    "e.g., Show me the top 5 hotels by revenue last month"
                  }
                  className="flex-1"
                  value={userInput}
                  onChange={(e)=>setUserInput(e.target.value)}
                  onKeyDown={(e)=>{ if(e.key==='Enter' && (e.metaKey||e.ctrlKey)) onSend(); }}
                  disabled={!dbInit || !rows.length}
                />
                <Button onClick={onSend} disabled={pending || !dbInit || !rows.length}>
                  {pending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                </Button>
              </div>
              {error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTitle>Something went wrong</AlertTitle>
                  <AlertDescription className="text-xs whitespace-pre-wrap">{error}</AlertDescription>
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
                    <div className="text-sm text-slate-600">Run a query to see results here.</div>
                  ) : (
                    <div className="overflow-auto max-h-[28rem]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr>
                            {result.columns.map((c) => (<th key={c} className="text-left p-2 border-b">{c}</th>))}
                          </tr>
                        </thead>
                        <tbody>
                          {head(result.rows, 500).map((r: RowData, i: number)=> (
                            <tr key={i} className="odd:bg-slate-50">
                              {result.columns.map((c)=> (<td key={c} className="p-2 border-b">{String(r[c] ?? "")}</td>))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs text-slate-600">Showing up to 500 rows.</div>
                        <Button size="sm" variant="secondary" onClick={downloadCSV}>Download CSV</Button>
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
                    <div className="text-sm text-slate-600">Run a query that returns an X and numeric Y (and optionally date-ish X) to auto-chart.</div>
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
                  <Textarea className="font-mono text-xs" rows={10} value={lastSQL} onChange={(e)=>setLastSQL(e.target.value)} />
                  <div className="flex gap-2 mt-2">
                    <Button onClick={()=>{
                      try {
                        setError("");
                        const exec = runSQL(lastSQL);
                        setResult(exec);
                        setChartHint(autoChart(exec.columns, exec.rows));
                        setMessages((m) => [...m, { role: "assistant", content: "Query executed successfully." }]);
                      } catch(e: any){
                        setError(String(e.message || e));
                      }
                    }}>Run SQL</Button>
                    <Button variant="secondary" onClick={()=>navigator.clipboard.writeText(lastSQL)}>Copy</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-6 text-xs text-slate-500">
        <div>Privacy: your CSV remains in the browser. The LLM sees only your question and the inferred schema/samples.</div>
      </footer>
    </div>
  );
}
