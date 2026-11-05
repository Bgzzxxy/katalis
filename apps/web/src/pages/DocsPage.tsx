import { useSearchParams } from "react-router-dom";
import { CodeBlock } from "../components/docs/CodeBlock";
import { PlaygroundPanel } from "../components/docs/PlaygroundPanel";
import { Panel } from "../components/ui/Panel";

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

const STREAMING = `from openai import OpenAI

client = OpenAI(
    base_url="https://katalis.sh/v1",
    api_key="sk-ktl-YOUR_KEY",
)

stream = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Jelaskan Katalis dalam 3 butir ringkas."}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
print()`;

const ERROR_CODES = [
  {
    code: "401",
    name: "Unauthorized (INVALID_API_KEY)",
    desc: "API key salah, tidak terdaftar, atau belum berstatus aktif. Pastikan menggunakan format sk-ktl-...",
  },
  {
    code: "402",
    name: "Payment Required (INSUFFICIENT_BALANCE)",
    desc: "Saldo deposit tidak mencukupi untuk token output minimal. Lakukan top-up via QRIS di menu Saldo.",
  },
  {
    code: "429",
    name: "Too Many Requests (SPEND_LIMIT_EXCEEDED)",
    desc: "Batas pengeluaran per API key telah terlampaui, atau kapasitas konkurensi Flex pool sedang penuh.",
  },
  {
    code: "502",
    name: "Bad Gateway (UPSTREAM_FAILOVER_FAILED)",
    desc: "Seluruh upstream cadangan gagal merespons. Pemotongan saldo otomatis Rp 0 (zero-charge guarantee).",
  },
];

export function CodeSnippet({ title, code }: { title: string; code: string }) {
  return (
    <div className="space-y-1">
      <CodeBlock code={code} language={title.toLowerCase()} />
    </div>
  );
}

export function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");

  const sections: { id: string; label: string; body: string }[] = [
    {
      id: "playground",
      label: "Live API Playground",
      body: "Simulasikan permintaan langsung di browser dengan model dan API key pilihan Anda. Uji parameter sampling seperti temperature dan periksa rincian biaya token serta latensi gateway secara real-time.",
    },
    {
      id: "mulai",
      label: "Mulai Cepat",
      body: "Gunakan Base URL https://katalis.sh/v1 dengan API key member Anda. SDK resmi OpenAI (Python, TypeScript, Node.js) langsung kompatibel 100% tanpa library pihak ketiga.",
    },
    {
      id: "cursor",
      label: "Konfigurasi Cursor / Cline",
      body: "Setel base URL dan API key pada pengaturan model editor Anda. Gunakan ID model dari katalog Katalis untuk integrasi langsung di coding assistant.",
    },
    {
      id: "caching",
      label: "Streaming & Caching",
      body: "Katalis mendukung streaming respons Server-Sent Events (SSE) dengan latensi ultra-rendah serta automatic prompt caching hingga 75% pengurangan biaya token untuk konteks berulang.",
    },
    {
      id: "kendala",
      label: "Kode Kendala",
      body: "Semua error mengikuti format standar OpenAI: { error: { message, type, param, code } }. Saldo pengguna dijamin terpotong Rp 0 bila gateway mengalami kendala teknis.",
    },
  ];

  const active =
    sectionParam && sections.some((s) => s.id === sectionParam)
      ? sectionParam
      : "playground";

  const handleSelect = (id: string) => {
    setSearchParams({ section: id });
  };

  const activeSection = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-[22px] leading-7 font-medium tracking-[-0.015em] text-primary">
          Docs &amp; Playground
        </h1>
        <p className="max-w-[65ch] text-sm leading-[22px] text-pretty text-secondary">
          Dokumentasi teknis integrasi OpenAI-compatible endpoint dan workspace pengujian interaktif Katalis AI Gateway.
        </p>
      </div>

      {/* Split-pane layout: Nav kiri 220px, kanan konten prose max-w-[65ch] + Live Playground */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr] items-start">
        {/* Navigasi Kiri (220px, 5 Section) */}
        <nav className="flex flex-col gap-1 w-full md:w-[220px] shrink-0 border border-hairline rounded-lg bg-surface p-2">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s.id)}
              className={`rounded px-3 py-2 text-left font-sans text-[13px] transition-colors cursor-pointer ${
                active === s.id
                  ? "bg-primary font-medium text-surface"
                  : "text-secondary hover:bg-canvas hover:text-primary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Kolom Kanan: Paragraf (max-w-[65ch]) + Live Playground / Dokumen */}
        <div className="space-y-5">
          <Panel>
            <h2 className="font-serif text-lg font-medium tracking-tight text-primary">
              {activeSection.label}
            </h2>
            <p className="mt-1.5 max-w-[65ch] text-sm leading-[22px] text-pretty text-secondary-aa">
              {activeSection.body}
            </p>
          </Panel>

          {active === "playground" ? (
            <Panel title="Live API Playground">
              <PlaygroundPanel />
            </Panel>
          ) : null}

          {active === "mulai" ? (
            <div className="space-y-4">
              <Panel title="SDK &amp; cURL Invocations">
                <div className="space-y-3">
                  <CodeSnippet title="Python" code={PYTHON} />
                  <CodeSnippet title="JavaScript / TypeScript" code={JAVASCRIPT} />
                  <CodeSnippet title="cURL" code={CURL} />
                </div>
              </Panel>
              <div className="rounded-lg border border-hairline bg-surface p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-sans text-xs font-medium text-primary">
                    Ingin menguji request langsung di browser?
                  </p>
                  <p className="max-w-[65ch] font-sans text-xs text-secondary">
                    Gunakan Live API Playground untuk mengirim prompt dengan model dan parameter kustom.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelect("playground")}
                  className="rounded bg-primary px-3 py-1.5 font-sans text-xs font-medium text-surface hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
                >
                  Buka Playground →
                </button>
              </div>
            </div>
          ) : null}

          {active === "cursor" ? (
            <div className="space-y-4">
              <Panel title="Konfigurasi Cursor, Cline, dan Roo Code">
                <div className="space-y-3">
                  <p className="max-w-[65ch] text-xs text-secondary leading-relaxed">
                    Katalis dapat digunakan sebagai backend OpenAI API kustom di berbagai ekstensi dan editor AI. Masukkan Base URL dan API Key Anda seperti contoh berikut:
                  </p>
                  <CodeBlock code={CURSOR} language="yaml" filename="editor-settings.txt" />
                </div>
              </Panel>
            </div>
          ) : null}

          {active === "caching" ? (
            <div className="space-y-4">
              <Panel title="Streaming Completions (SSE)">
                <div className="space-y-3">
                  <p className="max-w-[65ch] text-xs text-secondary leading-relaxed">
                    Setel parameter <code className="font-mono text-[11px] bg-canvas px-1 py-0.5 rounded">stream: true</code> untuk mengaktifkan respons Server-Sent Events secara inkremental tanpa memblokir antarmuka pengguna.
                  </p>
                  <CodeBlock code={STREAMING} language="python" filename="streaming_example.py" />
                </div>
              </Panel>
            </div>
          ) : null}

          {active === "kendala" ? (
            <div className="space-y-4">
              <Panel title="Daftar Kode Status &amp; Penanganan">
                <div className="grid grid-cols-1 gap-2.5">
                  {ERROR_CODES.map((err) => (
                    <div
                      key={err.code}
                      className="rounded border border-hairline bg-surface p-3 flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold tabular-nums text-error">
                          HTTP {err.code}
                        </span>
                        <span className="font-mono text-[11px] font-medium text-primary">
                          {err.name}
                        </span>
                      </div>
                      <p className="max-w-[65ch] font-sans text-xs text-secondary leading-relaxed">
                        {err.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
