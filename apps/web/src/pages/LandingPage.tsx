import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Copy, Moon, Sun } from "lucide-react";
import { MODEL_CATALOG, POOL_LABELS } from "../lib/model-catalog";
import { copyText, formatIdr } from "../lib/format";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "../hooks/useToast";

const BASE_URL = "https://katalis.sh/v1";

const SNIPPETS = {
  python: `from openai import OpenAI

client = OpenAI(
    base_url="${BASE_URL}",
    api_key="sk-ktl-YOUR_KEY",
)

chat = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Halo!"}],
)`,
  typescript: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${BASE_URL}",
  apiKey: "sk-ktl-YOUR_KEY",
});

const chat = await client.chat.completions.create({
  model: "deepseek-v4.1-flash",
  messages: [{ role: "user", content: "Halo!" }],
});`,
  agents: `# Cursor / Cline / Roo Code (mode OpenAI-compatible)
Base URL: ${BASE_URL}
API Key : sk-ktl-YOUR_KEY`,
} as const;

const TABS = [
  { id: "python", label: "Python OpenAI SDK" },
  { id: "typescript", label: "TypeScript / Node" },
  { id: "agents", label: "Coding Agents" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Public marketing shell (v4.0 §5.2 Public Layout): top header, no left sidebar. */
export function LandingPage() {
  const { theme, toggle } = useTheme();
  const { push } = useToast();
  const [tab, setTab] = useState<TabId>("python");

  async function copyBase() {
    if (await copyText(BASE_URL)) push("Base URL disalin");
    else push("Gagal menyalin", "error");
  }

  async function copySnippet() {
    if (await copyText(SNIPPETS[tab])) push("Kode disalin");
    else push("Gagal menyalin", "error");
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-hairline bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-primary font-mono text-[11px] font-bold text-surface">
              KT
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-serif text-base font-semibold tracking-tight text-primary">katalis</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-secondary">Gateway</span>
            </span>
          </div>

          <nav className="ml-4 hidden items-center gap-5 md:flex">
            <Link className="text-[13px] font-medium text-primary" to="/models">
              Model
            </Link>
            <Link className="text-[13px] text-secondary hover:text-primary" to="/docs">
              Docs
            </Link>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className="inline-flex items-center justify-center rounded border border-hairline px-2 py-1 text-secondary hover:border-accent hover:text-primary"
              aria-label={theme === "dark" ? "Aktifkan tema terang" : "Aktifkan tema gelap"}
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <Link className="text-[13px] text-secondary hover:text-primary" to="/auth/login">
              Masuk
            </Link>
            <Link
              className="inline-flex items-center rounded bg-primary px-3 py-1.5 text-[13px] font-medium text-surface transition-colors hover:opacity-90"
              to="/auth/register"
            >
              Dapatkan API Key
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Hero */}
        <section className="grid grid-cols-1 gap-8 py-6 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.05em] text-secondary">
              AI API Gateway · OpenAI-Compatible
            </p>
            <h1 className="mt-3 font-serif text-[26px] leading-[32px] font-medium tracking-[-0.015em] text-primary text-balance md:text-[32px] md:leading-[38px]">
              Unified OpenAI-compatible API untuk model AI China &amp; global berbiaya rendah
            </h1>
            <p className="mt-3 max-w-[60ch] text-sm leading-[22px] text-pretty text-secondary">
              Satu API key untuk DeepSeek, Qwen, GLM, Kimi, Doubao dan lainnya — dengan pembayaran QRIS dan
              pemotongan saldo transparan per token.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-[13px] font-medium text-surface hover:opacity-90"
                to="/auth/register"
              >
                Dapatkan API Key <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                className="inline-flex items-center gap-1.5 rounded border border-hairline px-4 py-2 text-[13px] text-secondary hover:border-accent hover:text-primary"
                to="/models"
              >
                Jelajahi Model
              </Link>
            </div>

            <button
              type="button"
              onClick={() => void copyBase()}
              className="mt-5 inline-flex items-center gap-2 rounded border border-hairline bg-surface px-2.5 py-1.5 font-mono text-[12px] text-primary hover:border-accent"
              title="Salin Base URL"
            >
              <span className="tabular-nums">BASE: {BASE_URL}</span>
              <Copy className="h-3 w-3 text-secondary" />
            </button>
          </div>

          {/* Code switcher */}
          <div className="lg:col-span-6">
            <div className="rounded-md border border-hairline bg-terminal text-[var(--text-terminal)]">
              <div className="flex items-center justify-between border-b border-[var(--border-strong)] px-3 py-2">
                <div className="flex items-center gap-1">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`rounded px-2.5 py-1 text-[11px] font-medium ${
                        tab === t.id ? "bg-[var(--text-terminal)]/10 text-[var(--text-terminal)]" : "text-[var(--text-terminal)]/60 hover:text-[var(--text-terminal)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void copySnippet()}
                  className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-[var(--text-terminal)]/70 hover:text-[var(--text-terminal)]"
                >
                  <Copy className="h-3 w-3" /> Salin
                </button>
              </div>
              <pre className="overflow-x-auto p-3.5 font-mono text-[12px] leading-5">
                <code>{SNIPPETS[tab]}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Featured models */}
        <section className="py-8">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-primary">Model Populer &amp; Tarif</h2>
            <Link className="text-[13px] text-accent hover:underline" to="/models">
              Lihat katalog lengkap →
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto rounded-md border border-hairline bg-surface">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-canvas">
                  <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
                    Model
                  </th>
                  <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
                    Pool
                  </th>
                  <th className="border-b border-hairline px-3 py-2 text-right font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
                    Input / 1M
                  </th>
                  <th className="border-b border-hairline px-3 py-2 text-right font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
                    Output / 1M
                  </th>
                </tr>
              </thead>
              <tbody>
                {MODEL_CATALOG.slice(0, 6).map((model) => (
                  <tr key={model.id} className="border-b border-hairline last:border-b-0 hover:bg-canvas/60">
                    <td className="px-3 py-2 font-mono text-[12px] text-primary">{model.id}</td>
                    <td className="px-3 py-2 font-sans text-[13px] text-secondary">{POOL_LABELS[model.pool]}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-primary">
                      {formatIdr(model.priceInIdrPer1M)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-primary">
                      {formatIdr(model.priceOutIdrPer1M)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Onboarding */}
        <section className="py-8">
          <h2 className="font-serif text-lg font-medium text-primary">Mulai dalam 3 langkah</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { n: "1", t: "Buat akun", d: "Daftar dengan email dalam hitungan detik." },
              { n: "2", t: "Top up via QRIS", d: "Saldo masuk otomatis setelah pembayaran terverifikasi." },
              { n: "3", t: "Buat API key & kirim request", d: "Hubungkan Cursor, Cline, atau SDK OpenAI Anda." },
            ].map((s) => (
              <div key={s.n} className="rounded-md border border-hairline bg-surface p-4">
                <span className="font-mono text-[11px] font-semibold text-accent">0{s.n}</span>
                <p className="mt-2 font-sans text-[13px] font-medium text-primary">{s.t}</p>
                <p className="mt-1 text-[13px] leading-[18px] text-secondary">{s.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline bg-surface py-10">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded bg-primary font-mono text-[11px] font-bold text-surface">
                KT
              </span>
              <span className="font-serif text-base font-medium text-primary">Katalis AI</span>
            </div>
            <p className="font-mono text-[11px] text-secondary">
              OpenAI-compatible · SSE streaming · QRIS dinamis
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}