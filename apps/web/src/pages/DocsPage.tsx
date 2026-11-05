import { useState } from "react";
import { Copy } from "lucide-react";
import { useToast } from "../hooks/useToast";
import { copyText } from "../lib/format";
import { Panel } from "../components/ui/Panel";
import { PlaygroundPanel } from "../components/docs/PlaygroundPanel";
import { CodeBlock } from "../components/docs/CodeBlock";

const PYTHON = `from openai import OpenAI

client = OpenAI(
    base_url="https://katalis.sh/v1",
    api_key="sk-ktl-YOUR_KEY",
)

chat = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Halo!"}],
)
print(chat.choices[0].message.content)`;

const JAVASCRIPT = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://katalis.sh/v1",
  apiKey: "sk-ktl-YOUR_KEY",
});

const chat = await client.chat.completions.create({
  model: "deepseek-v4.1-flash",
  messages: [{ role: "user", content: "Halo!" }],
});
console.log(chat.choices[0].message.content);`;

const CURL = `curl https://katalis.sh/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-ktl-YOUR_KEY" \\
  -d '{
    "model": "deepseek-v4.1-flash",
    "messages": [{"role": "user", "content": "Halo!"}]
  }'`;

const CURSOR = `# Cursor Settings → Models → OpenAI API Key
# Base URL:
https://katalis.sh/v1
# API Key:
sk-ktl-YOUR_KEY
# Model:
deepseek-v4.1-flash`;

export function CodeSnippet({ title, code }: { title: string; code: string }) {
  const { push } = useToast();
  return (
    <div className="rounded-md border border-hairline bg-surface">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-secondary">{title}</span>
        <button
          type="button"
          onClick={() => void copyText(code).then((ok) => push(ok ? "Snippet disalin" : "Gagal menyalin", ok ? "neutral" : "error"))}
          className="inline-flex items-center gap-1.5 rounded border border-hairline px-2 py-0.5 font-sans text-xs text-secondary hover:border-accent"
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
          Salin
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-5" style={{ background: "var(--text-primary)", color: "var(--bg-surface)" }}>
        <CodeBlock code={code} />
      </pre>
    </div>
  );
}

export function DocsPage() {
  const [active, setActive] = useState("mulai");

  const sections: { id: string; label: string; body: string }[] = [
    {
      id: "mulai",
      label: "Mulai Cepat",
      body: "Gunakan Base URL https://katalis.sh/v1 dengan API key member Anda. SDK OpenAI (Python/JS) langsung kompatibel.",
    },
    {
      id: "playground",
      label: "Live API Playground",
      body: "Simulasikan permintaan di panel bawah dengan model dan API key pilihan Anda.",
    },
    {
      id: "cursor",
      label: "Konfigurasi Cursor/Cline",
      body: "Setel base URL dan API key pada pengaturan model editor Anda. Gunakan ID model dari katalog.",
    },
    {
      id: "kendala",
      label: "Kode Kendala",
      body: "Semua error mengikuti format OpenAI: { error: { message, type, param, code } }.",
    },
  ];

  const activeSection = sections.find((s) => s.id === active)!;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[22px] leading-7 font-medium tracking-[-0.015em] text-primary">
        Docs &amp; Playground
      </h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        <nav className="flex flex-col gap-1">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`rounded px-3 py-2 text-left font-sans text-[13px] ${
                active === s.id ? "bg-primary font-medium text-surface" : "text-secondary hover:bg-canvas hover:text-primary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          <Panel title={activeSection.label}>
            <h2 className="font-serif text-lg font-medium tracking-tight text-primary">
              {activeSection.label}
            </h2>
            <p className="mt-1 max-w-[65ch] text-sm leading-[22px] text-pretty text-primary">
              {activeSection.body}
            </p>
          </Panel>

          {active === "playground" ? (
            <Panel title="Live API Playground">
              <PlaygroundPanel />
            </Panel>
          ) : null}

          <Panel title="Integrasi">
            <div className="space-y-3">
              <CodeSnippet title="Python" code={PYTHON} />
              <CodeSnippet title="JavaScript / TypeScript" code={JAVASCRIPT} />
              <CodeSnippet title="cURL" code={CURL} />
              <CodeSnippet title="Cursor / Cline" code={CURSOR} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}