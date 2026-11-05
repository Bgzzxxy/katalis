import { useState } from "react";
import { Button } from "../ui/Button";
import { DataState } from "../ui/DataState";
import { CodeBlock } from "../docs/CodeBlock";
import { MODEL_CATALOG } from "../../lib/model-catalog";
import { formatLatency } from "../../lib/format";
import type { DataStatus } from "../../lib/types";

type PlaygroundResult = { status: number; latencyMs: number; json: unknown };

/** Non-streaming prompt tester. Uses the member's own API key (never stored). */
export function PlaygroundPanel() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(MODEL_CATALOG[0].id);
  const [prompt, setPrompt] = useState("Jelaskan Katalis dalam satu kalimat.");
  const [state, setState] = useState<DataStatus>("empty");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [result, setResult] = useState<PlaygroundResult | null>(null);

  async function run() {
    setState("loading");
    const startedAt = performance.now();
    try {
      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const latencyMs = performance.now() - startedAt;
      const json = (await res.json()) as unknown;
      setResult({ status: res.status, latencyMs, json });
      setState("populated");
    } catch {
      setErrorCode("NETWORK_ERROR");
      setErrorMessage("Tidak dapat menghubungi gateway");
      setState("error");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
          API Key
          <input
            aria-label="API key playground"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ktl-..."
            className="rounded border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-primary outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
          Model
          <select
            aria-label="Model playground"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-primary outline-none focus:border-accent"
          >
            {MODEL_CATALOG.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
          Prompt
          <textarea
            aria-label="Prompt playground"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="rounded border border-hairline bg-surface px-2 py-1.5 font-sans text-[13px] text-primary outline-none focus:border-accent"
          />
        </label>
        <Button variant="primary" onClick={() => void run()} disabled={state === "loading" || !apiKey}>
          {state === "loading" ? "Mengirim..." : "Kirim Request"}
        </Button>
      </div>

      <div>
        {result ? (
          <p className="mb-2 font-mono text-[11px] tabular-nums text-secondary">
            <span className={result.status >= 400 ? "text-error" : "text-success"}>
              HTTP {result.status}
            </span>
            {" · "}
            {formatLatency(result.latencyMs)}
          </p>
        ) : null}
        <DataState
          state={state}
          skeletonRows={6}
          emptyLabel="Kirim request untuk melihat respons JSON dan latensi."
          errorCode={errorCode}
          errorMessage={errorMessage}
        >
          <pre
            className="max-h-80 overflow-auto rounded-md border border-hairline p-3 font-mono text-[12px]"
            style={{ background: "var(--text-primary)", color: "var(--bg-surface)" }}
          >
            <CodeBlock code={JSON.stringify(result?.json, null, 2)} />
          </pre>
        </DataState>
      </div>
    </div>
  );
}