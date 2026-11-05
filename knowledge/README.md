# Peta Pengetahuan & Status Proyek: Katalis AI Gateway

Dokumen ini adalah **titik masuk utama** bagi setiap AI agent (Claude Code, Cursor, Cline, Roo Code, Aider, dll.) atau developer manusia yang baru pertama kali membuka repositori ini. Bacalah ringkasan di bawah sebelum mulai membaca atau mengedit berkas apa pun.

---

## 1. Apa Itu Katalis AI Gateway?

**Katalis AI Gateway** adalah layanan *AI API Gateway* dan *Token Proxy* berformat standar **OpenAI-compatible** (`/v1/chat/completions`, `/v1/models`) yang berfokus pada model-model AI asal Tiongkok berbiaya rendah ([SiliconFlow](https://www.siliconflow.com/pricing), [DeepSeek API](https://api-docs.deepseek.com/quick_start/pricing/), [Zhipu BigModel](https://bigmodel.cn/pricing), dan [Volcengine Ark](https://docs.volcengine.com/docs/ark/model-pricing?lang=zh)) dengan sistem **Akun Member Multi-API Key** dan pembayaran otomatis via **QRIS Dinamis** ([TriPay](https://tripay.co.id/developer) / [Midtrans](https://docs.midtrans.com/reference/qris)).

UI-nya mengusung gaya **Warm Editorial Precision** (Design.md v2.1): tipografi Newsreader (serif editorial) + Inter (UI) + JetBrains Mono (data teknis), palet 8 token kertas hangat `#F0EEE8` / `#FAF9F5`, tanpa gradasi/blob/ikon dekoratif.

---

## 2. Status Saat Ini (Fakta Terverifikasi)

- **Semua 5 Batch selesai, teruji, dan ter-push** ke `origin/master` (repo privat `Bgzzxxy/katalis`).
- Commit HEAD terakhir: `1111e4d` (redesign v2.1 + perbaikan wrapping navbar).
- **Semua gate pengujian hijau (exit 0):**
  - `bun test apps/api` → **211 pass / 0 fail** (18 berkas tes).
  - `bun test apps/web/tests` → **61 pass / 0 fail** (19 berkas tes).
  - `bun test` (uncontended root) → **272 pass / 0 fail** (37 berkas tes).
  - `bun run typecheck` (API) → **exit 0**.
  - `bun run --cwd apps/web typecheck` → **exit 0**.
  - `bun run --cwd apps/web build` → **exit 0** (546 kB JS, font Newsreader self-host).
  - `bun run db:generate` → "No schema changes, nothing to migrate".

---

## 3. Peta Berkas Pengetahuan (`knowledge/`)

| Berkas | Isi / Kegunaan |
|---|---|
| [`PROGRESS.md`](./PROGRESS.md) | Catatan progres kronologis tiap Batch 1–5 + Redesign v2.1, nomor commit, bukti gate nyata. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Arsitektur monorepo, 2 jalur request (`/v1/*` vs `/api/*`), skema 4 tabel PostgreSQL, struktur kunci Redis + Lua. |
| [`INVARIANTS.md`](./INVARIANTS.md) | **6 aturan mutlak yang tidak boleh dilanggar** (API key hash, saldo atomik Lua, HMAC webhook, error envelope OpenAI, 8 token desain). |
| [`KNOWN_ISSUES_AND_DEBT.md`](./KNOWN_ISSUES_AND_DEBT.md) | Jebakan nyata di repo ini (kontensi test DB paralel, unref timer telemetri, kredensial produksi yang belum diisi). |
| [`AGENTS_GUIDE.md`](./AGENTS_GUIDE.md) | Panduan bagi 7 subagents (`architect`, `frontend-developer`, `backend-developer`, `qa-engineer`, `security-reviewer`, `code-reviewer`, `ui-ux-designer`). |

---

## 4. Tech Stack & Perintah Penting

### Stack
- **Runtime:** Bun 1.4.4
- **Backend:** Hono v4 + Drizzle ORM + PostgreSQL 16 + Redis 7 (`ioredis`)
- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4 (`@tailwindcss/vite`) + Lucide Icons + Chart.js
- **Testing:** Bun test + Happy DOM (web) + Playwright (E2E)

### Perintah Esensial
```bash
# Menjalankan tes
bun test apps/api              # Tes backend (211 pass)
bun test apps/web/tests        # Tes frontend (61 pass)
bun test                       # Seluruh monorepo (hanya saat TIDAK ada test lain berjalan!)

# Pemeriksaan tipe
bun run typecheck              # Backend typecheck
bun run --cwd apps/web typecheck # Frontend typecheck

# Build produksi
bun run build                  # Build frontend (Vite)

# Database Drizzle
bun run db:generate            # Buat migrasi SQL baru dari schema.ts
bun run db:migrate             # Jalankan migrasi ke DB (target: DATABASE_URL di .env)
bun run db:push                # Push skema langsung ke DB lokal dev

# Menjalankan dev server lokal
# Terminal 1 (API):
set -a && . ./.env && set +a && PORT=3000 bun run apps/api/src/index.ts
# Terminal 2 (Web, bind all interfaces untuk LAN):
bun run --cwd apps/web dev --host 0.0.0.0
```

---

## 5. Yang Masih Menghalangi Rilis Publik (Blocker Nyata)

1. **Kredensial produksi belum diisi di `.env`:**
   - Kunci upstream asli: `UPSTREAM_SILICONFLOW_API_KEY`, `UPSTREAM_DEEPSEEK_API_KEY`, dll. (tanpa ini, chat completion mengembalikan HTTP 502 `upstream_error`).
   - Kredensial TriPay asli: `TRIPAY_API_KEY`, `TRIPAY_MERCHANT_CODE`, `QRIS_WEBHOOK_SECRET` (tanpa ini, pembuatan tagihan QRIS mengembalikan HTTP 502 `PAYMENT_GATEWAY_ERROR`).
2. **Infrastruktur deploy belum ada:** Belum ada `Dockerfile`, `docker-compose.yml`, atau konfigurasi reverse-proxy (Nginx / Caddy). **Ingat:** `/v1/*` tidak punya CORS header di backend — frontend di produksi wajib di-reverse-proxy satu origin dengan backend!
3. **Dokumentasi publik:** Belum ada `README.md` di root repo untuk pengguna publik.
