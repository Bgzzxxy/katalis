import { useState } from "react";
import { Check, Copy, RotateCcw, Settings2, Sparkles, Terminal } from "lucide-react";
import { Button } from "../ui/Button";
import { DataState } from "../ui/DataState";
import { CodeBlock } from "./CodeBlock";
import { MODEL_CATALOG } from "../../lib/model-catalog";
import { copyText, formatIdr, formatLatency } from "../../lib/format";
import type { DataStatus } from "../../lib/types";

type PlaygroundResult = { status: number; latencyMs: number; json: unknown };

const STARTER_PROMPTS = [
  "Jelaskan Katalis AI Gateway dalam satu kalimat ringkas.",
  "Bagaimana cara mengonfigurasi OpenAI SDK dengan endpoint Katalis?",
  "Tulis fungsi TypeScript untuk retry panggilan LLM dengan exponential backoff.",
];

/**
 * U8 Interactive API Playground Developer Workspace (3-pane v4.0).
 * Left: Parameter rail
 * Center: Prompt & output canvas
 * Right: Telemetry & code export
 */
export function PlaygroundPanel() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(MODEL_CATALOG[0].id);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [prompt, setPrompt] = useState("Jelaskan Katalis dalam satu kalimat.");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [topP, setTopP] = useState(1.0);
  const [state, setState] = useState<DataStatus>("empty");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [activeTab, setActiveTab] = useState<"receipt" | "curl" | "json">("receipt");
  const [sdkLang, setSdkLang] = useState<"curl" | "python" | "node">("curl");
  const [copiedResponse, setCopiedResponse] = useState(false);

  const selectedModel = MODEL_CATALOG.find((m) => m.id === model) ?? MODEL_CATALOG[0];

  const resetParams = () => {
    setTemperature(0.7);
    setMaxTokens(2048);
    setTopP(1.0);
  };

  const resetAll = () => {
    resetParams();
    setSystemPrompt("");
    setPrompt("Jelaskan Katalis dalam satu kalimat.");
    setState("empty");
    setResult(null);
    setErrorCode(undefined);
    setErrorMessage(undefined);
  };

  async function run() {
    setState("loading");
    setErrorCode(undefined);
    setErrorMessage(undefined);
    const startedAt = performance.now();
    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (systemPrompt.trim()) {
        messages.push({ role: "system", content: systemPrompt.trim() });
      }
      messages.push({ role: "user", content: prompt });

      const requestPayload: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        max_tokens?: number;
        top_p?: number;
      } = {
        model,
        messages,
      };

      if (temperature !== 0.7) requestPayload.temperature = temperature;
      if (maxTokens !== 2048) requestPayload.max_tokens = maxTokens;
      if (topP !== 1.0) requestPayload.top_p = topP;

      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestPayload),
      });
      const latencyMs = performance.now() - startedAt;
      const json = (await res.json()) as unknown;
      setResult({ status: res.status, latencyMs, json });
      // An OpenAI-shaped error body is a successful round-trip with a failed
      // request: surface it through the error pane instead of the assistant
      // bubble, which would render an undefined message.
      if (!res.ok) {
        const envelope = (
          json as { error?: { code?: string; message?: string } } | null
        )?.error;
        setErrorCode(envelope?.code ?? `HTTP_${res.status}`);
        setErrorMessage(envelope?.message ?? "Permintaan ditolak gateway");
        setState("error");
      } else {
        setState("populated");
      }
    } catch {
      setErrorCode("NETWORK_ERROR");
      setErrorMessage("Tidak dapat menghubungi gateway");
      setState("error");
    }
  }

  // Telemetry extracts
  const usage = (
    result?.json as {
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    } | null
  )?.usage;
  const promptTokens = usage?.prompt_tokens ?? null;
  const completionTokens = usage?.completion_tokens ?? null;
  const totalTokens = usage?.total_tokens ?? null;
  const estimatedCostIdr =
    promptTokens !== null && completionTokens !== null
      ? (promptTokens * selectedModel.priceInIdrPer1M +
          completionTokens * selectedModel.priceOutIdrPer1M) /
        1_000_000
      : null;

  const assistantMessage = (
    result?.json as {
      choices?: Array<{
        message?: { content?: string; reasoning_content?: string };
      }>;
    } | null
  )?.choices?.[0]?.message;
  const responseText = assistantMessage?.content;
  const reasoningText = assistantMessage?.reasoning_content;

  const handleCopyResponse = async () => {
    if (!responseText) return;
    const ok = await copyText(responseText);
    if (ok) {
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    }
  };

  // Code snippets for Tab 2
  const activeKeyDisplay = apiKey || "sk-ktl-YOUR_KEY";
  const messagesSnippet = systemPrompt.trim()
    ? [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: prompt },
      ]
    : [{ role: "user", content: prompt }];

  const curlPayload = JSON.stringify(
    { model, messages: messagesSnippet, temperature },
    null,
    2,
  ).replace(/'/g, "'\\''");
  const curlCode = `curl https://katalis.sh/v1/chat/completions \\
  -H "Authorization: Bearer ${activeKeyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '${curlPayload}'`;

  const pythonCode = `from openai import OpenAI

client = OpenAI(
    base_url="https://katalis.sh/v1",
    api_key="${activeKeyDisplay}",
)

response = client.chat.completions.create(
    model="${model}",
    messages=${JSON.stringify(messagesSnippet, null, 4)},
    temperature=${temperature},
)
print(response.choices[0].message.content)`;

  const nodeCode = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://katalis.sh/v1",
  apiKey: "${activeKeyDisplay}",
});

const response = await client.chat.completions.create({
  model: "${model}",
  messages: ${JSON.stringify(messagesSnippet, null, 2)},
  temperature: ${temperature},
});
console.log(response.choices[0].message.content);`;

  return (
    <div className="space-y-4">
      {/* Studio Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-secondary">
            <Terminal className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            <span>Developer Workspace</span>
          </div>
          <span
            data-testid="playground-status"
            className={`inline-flex items-center gap-1.5 rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[11px] ${
              state === "error" ? "text-error" : "text-success"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                state === "error" ? "bg-error" : "bg-success animate-pulse"
              }`}
            />
            {state === "error" ? "GATEWAY ERROR" : "GATEWAY ONLINE"}
          </span>
          <span className="font-mono text-[11px] text-secondary">https://katalis.sh/v1</span>
        </div>

        <div className="flex items-center gap-3">
          {result ? (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-secondary">
              <span className="font-semibold text-primary">Status: {result.status}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 rounded border border-hairline bg-surface px-2.5 py-1 font-sans text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      {/* 3-Column Studio Workspace */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        {/* ========================================================
            COLUMN 1: PARAMETER RAIL (lg:col-span-3)
            ======================================================== */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="rounded-lg border border-hairline bg-surface p-3.5 flex flex-col gap-3.5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-hairline pb-2">
              <div className="flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                <span className="font-mono text-[11px] uppercase tracking-wider text-secondary font-medium">
                  Model &amp; Ingress
                </span>
              </div>
              <span className="rounded bg-canvas border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-secondary">
                v1/chat
              </span>
            </div>

            {/* Model Select */}
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
              Model
              <select
                aria-label="Model playground"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded border border-hairline bg-surface px-2.5 py-1.5 font-mono text-[12px] text-primary outline-none focus:border-accent"
              >
                {MODEL_CATALOG.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} ({m.name})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-secondary">
              <span className="text-accent">
                Rp {selectedModel.priceInIdrPer1M.toLocaleString("id-ID")} / 1M in
              </span>
              <span>
                Rp {selectedModel.priceOutIdrPer1M.toLocaleString("id-ID")} / 1M out
              </span>
            </div>

            {/* API Key Input */}
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
              API Key
              <input
                aria-label="API key playground"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ktl-..."
                className="w-full rounded border border-hairline bg-surface px-2.5 py-1.5 font-mono text-[12px] text-primary outline-none focus:border-accent"
              />
            </label>
            <p className="font-sans text-[11px] text-secondary leading-tight">
              Kunci API disimpan hanya di memori browser dan tidak dicatat ke log server.
            </p>

            <div className="h-px bg-hairline w-full" />

            {/* System Instructions */}
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
              System Instructions
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Instruksi sistem opsional..."
                rows={2}
                className="w-full rounded border border-hairline bg-surface p-2 font-mono text-[11px] text-primary outline-none focus:border-accent resize-none"
              />
            </label>

            <div className="h-px bg-hairline w-full" />

            {/* Sampling Hyperparameters */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-secondary font-medium">
                  Parameter Sampling
                </span>
                <button
                  type="button"
                  onClick={resetParams}
                  className="font-mono text-[10px] text-secondary hover:text-primary transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>

              {/* Temperature */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary font-sans">Temperature</span>
                  <span className="font-mono tabular-nums text-primary font-semibold">
                    {temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Max Tokens */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary font-sans">Max Tokens</span>
                  <span className="font-mono tabular-nums text-primary font-semibold">
                    {maxTokens.toLocaleString("id-ID")}
                  </span>
                </div>
                <input
                  type="range"
                  min={256}
                  max={8192}
                  step={256}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Top P */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary font-sans">Top P</span>
                  <span className="font-mono tabular-nums text-primary font-semibold">
                    {topP.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={topP}
                  onChange={(e) => setTopP(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Routing Tip */}
            <div className="rounded border border-hairline bg-canvas p-2.5 flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-accent font-medium">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>Zero-Charge Failover</span>
              </div>
              <p className="font-sans text-[11px] text-secondary leading-snug">
                Bila upstream utama mengalami kendala HTTP 5xx, gateway otomatis mengalihkan ke cadangan tanpa potongan saldo.
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================
            COLUMN 2: PROMPT & OUTPUT CANVAS (lg:col-span-5)
            ======================================================== */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="rounded-lg border border-hairline bg-surface flex flex-col min-h-[580px] justify-between overflow-hidden">
            {/* Canvas Header */}
            <div className="flex items-center justify-between border-b border-hairline px-3.5 py-2.5 bg-canvas/40">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="font-sans text-xs font-medium text-primary">Session Context</span>
              </div>
              {result ? (
                <p className="font-mono text-[11px] tabular-nums text-secondary">
                  <span
                    className={result.status >= 400 ? "text-error font-semibold" : "text-success font-semibold"}
                  >
                    HTTP {result.status}
                  </span>
                  {" · "}
                  {formatLatency(result.latencyMs)}
                </p>
              ) : (
                <span className="font-mono text-[11px] text-secondary">Ready</span>
              )}
            </div>

            {/* Conversation Messages / Output Area */}
            <div className="flex-1 p-3.5 flex flex-col gap-3 overflow-y-auto max-h-[460px]">
              <DataState
                state={state}
                skeletonRows={5}
                emptyLabel="Kirim request untuk melihat respons JSON dan latensi."
                errorCode={errorCode}
                errorMessage={errorMessage}
              >
                {state === "empty" ? (
                  <div className="flex flex-col gap-2 my-auto p-2">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-secondary">
                      Saran prompt cepat:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {STARTER_PROMPTS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPrompt(p)}
                          className="text-left rounded border border-hairline bg-canvas p-2 font-sans text-xs text-primary hover:border-accent transition-colors cursor-pointer"
                        >
                          &ldquo;{p}&rdquo;
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {result ? (
                  <div className="space-y-3.5">
                    {/* User Prompt Bubble */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono text-[10px] uppercase text-secondary tracking-wider">
                        Prompt Anda
                      </span>
                      <div className="rounded-lg border border-hairline bg-canvas p-3 font-sans text-xs text-primary leading-relaxed max-w-[95%]">
                        {prompt}
                      </div>
                    </div>

                    {/* Assistant Response Bubble */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between border-b border-hairline pb-1">
                        <span className="font-mono text-[11px] font-semibold text-primary">
                          {model}
                        </span>
                        <span
                          className={`font-mono text-[11px] font-semibold tabular-nums ${
                            result.status >= 400 ? "text-error" : "text-success"
                          }`}
                        >
                          Status {result.status}
                        </span>
                      </div>

                      {result.status >= 400 ? (
                        <div
                          className="rounded-md border p-3 flex flex-col gap-2"
                          style={{
                            background: "var(--error-bg-subtle)",
                            borderColor: "var(--state-error)",
                          }}
                        >
                          <p className="font-mono text-[11px] text-error font-medium">
                            Respons Error dari Gateway:
                          </p>
                          <CodeBlock
                            code={JSON.stringify(result.json, null, 2)}
                            language="json"
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-hairline bg-surface p-3 flex flex-col gap-2">
                          {reasoningText ? (
                            <details className="rounded border border-hairline bg-canvas p-2">
                              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-secondary hover:text-primary font-medium">
                                Reasoning trace
                              </summary>
                              <div className="mt-1.5 font-mono text-[11px] leading-relaxed text-secondary whitespace-pre-wrap">
                                {reasoningText}
                              </div>
                            </details>
                          ) : null}

                          {responseText ? (
                            <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-primary">
                              {responseText}
                            </div>
                          ) : (
                            <CodeBlock
                              code={JSON.stringify(result.json, null, 2)}
                              language="json"
                            />
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-hairline">
                            <button
                              type="button"
                              onClick={() => void handleCopyResponse()}
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-secondary hover:text-primary transition-colors cursor-pointer"
                            >
                              {copiedResponse ? (
                                <>
                                  <Check className="h-3 w-3 text-success" aria-hidden="true" />
                                  <span className="text-success">Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" aria-hidden="true" />
                                  <span>Salin respons</span>
                                </>
                              )}
                            </button>
                            <span className="font-mono text-[11px] text-secondary">
                              Selesai
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </DataState>
            </div>

            {/* Bottom Prompt Composer */}
            <div className="border-t border-hairline p-3 bg-canvas/40 flex flex-col gap-2">
              <textarea
                aria-label="Prompt playground"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && state !== "loading" && apiKey) {
                    e.preventDefault();
                    void run();
                  }
                }}
                placeholder="Ketik prompt baru... (⌘ + Enter untuk mengirim)"
                className="w-full rounded border border-hairline bg-surface p-2.5 font-sans text-xs text-primary outline-none focus:border-accent resize-none leading-relaxed"
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-secondary">
                  Tekan ⌘+Enter untuk mengirim
                </span>
                <Button
                  variant="primary"
                  onClick={() => void run()}
                  disabled={state === "loading" || !apiKey}
                >
                  {state === "loading" ? "Mengirim..." : "Kirim Request"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            COLUMN 3: TELEMETRY & CODE EXPORT (lg:col-span-4)
            ======================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="rounded-lg border border-hairline bg-surface flex flex-col overflow-hidden">
            {/* Segmented Tab Header */}
            <div className="flex border-b border-hairline bg-canvas">
              <button
                type="button"
                onClick={() => setActiveTab("receipt")}
                className={`flex-1 py-2 text-center font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === "receipt"
                    ? "bg-surface text-primary font-semibold border-b-2 border-accent"
                    : "text-secondary hover:text-primary"
                }`}
              >
                Usage Receipt
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("curl")}
                className={`flex-1 py-2 text-center font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === "curl"
                    ? "bg-surface text-primary font-semibold border-b-2 border-accent"
                    : "text-secondary hover:text-primary"
                }`}
              >
                cURL / SDK
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("json")}
                className={`flex-1 py-2 text-center font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === "json"
                    ? "bg-surface text-primary font-semibold border-b-2 border-accent"
                    : "text-secondary hover:text-primary"
                }`}
              >
                Raw JSON
              </button>
            </div>

            {/* TAB 1: USAGE RECEIPT */}
            {activeTab === "receipt" && (
              <div className="p-3.5 flex flex-col gap-3.5">
                {/* Ingress Route Card */}
                <div className="rounded border border-hairline bg-canvas p-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-secondary">
                      Ingress Route
                    </span>
                    <span className="font-mono text-[10px] text-success">Active</span>
                  </div>
                  <p className="font-mono text-[11px] font-medium text-primary">
                    Edge JKT-AZ1 → {selectedModel.provider}
                  </p>
                  <p className="font-mono text-[10px] text-secondary">TLS 1.3 / HTTP 2.0</p>
                </div>

                {/* Performance Telemetry Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded border border-hairline bg-canvas p-2 flex flex-col">
                    <span className="font-mono text-[9px] uppercase text-secondary">Status Code</span>
                    <span
                      className={`font-mono text-[13px] font-semibold tabular-nums mt-0.5 ${
                        result && result.status >= 400 ? "text-error" : "text-primary"
                      }`}
                    >
                      {result ? result.status : "—"}
                    </span>
                  </div>
                  <div className="rounded border border-hairline bg-canvas p-2 flex flex-col">
                    <span className="font-mono text-[9px] uppercase text-secondary">Latency</span>
                    <span className="font-mono text-[13px] font-semibold tabular-nums text-primary mt-0.5">
                      {result ? `${Math.round(result.latencyMs)} milidetik` : "—"}
                    </span>
                  </div>
                  <div className="rounded border border-hairline bg-canvas p-2 flex flex-col">
                    <span className="font-mono text-[9px] uppercase text-secondary">Tokens</span>
                    <span className="font-mono text-[13px] font-semibold tabular-nums text-primary mt-0.5">
                      {totalTokens !== null ? `${totalTokens.toLocaleString("id-ID")}` : "—"}
                    </span>
                  </div>
                </div>

                {/* Itemized Token Ledger */}
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-secondary font-medium">
                    Itemized Token Ledger
                  </span>
                  <div className="rounded border border-hairline bg-canvas p-3 flex flex-col gap-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-secondary">Input Tokens:</span>
                      <span className="font-semibold tabular-nums text-primary">
                        {promptTokens !== null ? `${promptTokens.toLocaleString("id-ID")} tok` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary">Output Tokens:</span>
                      <span className="font-semibold tabular-nums text-primary">
                        {completionTokens !== null
                          ? `${completionTokens.toLocaleString("id-ID")} tok`
                          : "—"}
                      </span>
                    </div>
                    <div className="h-px bg-hairline my-0.5" />
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-primary">Total Processed:</span>
                      <span className="tabular-nums text-primary">
                        {totalTokens !== null ? `${totalTokens.toLocaleString("id-ID")} tok` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Settlement Module */}
                <div className="rounded border border-hairline bg-canvas p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-secondary">
                      Billed to Balance
                    </span>
                    <span className="font-mono text-[10px] text-secondary">IDR Settled</span>
                  </div>
                  <p className="font-mono text-[18px] font-semibold tabular-nums text-primary">
                    {estimatedCostIdr !== null ? formatIdr(estimatedCostIdr) : "—"}
                  </p>
                  <p className="font-sans text-[10px] text-secondary">
                    Perhitungan estimasi otomatis berdasarkan tarif resmi per 1M token Katalis.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: cURL / SDK */}
            {activeTab === "curl" && (
              <div className="p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-secondary font-medium">
                    Invocation Snippet
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setSdkLang("curl")}
                      className={`px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer ${
                        sdkLang === "curl"
                          ? "bg-primary text-surface font-semibold"
                          : "text-secondary hover:text-primary"
                      }`}
                    >
                      cURL
                    </button>
                    <button
                      type="button"
                      onClick={() => setSdkLang("python")}
                      className={`px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer ${
                        sdkLang === "python"
                          ? "bg-primary text-surface font-semibold"
                          : "text-secondary hover:text-primary"
                      }`}
                    >
                      Python
                    </button>
                    <button
                      type="button"
                      onClick={() => setSdkLang("node")}
                      className={`px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer ${
                        sdkLang === "node"
                          ? "bg-primary text-surface font-semibold"
                          : "text-secondary hover:text-primary"
                      }`}
                    >
                      Node.js
                    </button>
                  </div>
                </div>

                {sdkLang === "curl" && (
                  <CodeBlock code={curlCode} language="bash" filename="request.sh" />
                )}
                {sdkLang === "python" && (
                  <CodeBlock code={pythonCode} language="python" filename="client.py" />
                )}
                {sdkLang === "node" && (
                  <CodeBlock code={nodeCode} language="javascript" filename="client.mjs" />
                )}
              </div>
            )}

            {/* TAB 3: RAW JSON */}
            {activeTab === "json" && (
              <div className="p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-hairline pb-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-secondary font-medium">
                    Payload Inspector
                  </span>
                  {result ? (
                    <span className="font-mono text-[11px] tabular-nums text-secondary">
                      Status: {result.status}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-secondary">No payload</span>
                  )}
                </div>
                <CodeBlock
                  code={JSON.stringify(
                    result?.json ?? { message: "Kirim request untuk melihat respons JSON" },
                    null,
                    2,
                  )}
                  language="json"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
