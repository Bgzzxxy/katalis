# Arsitektur Sistem: Katalis AI Gateway

Dokumen ini menjelaskan batas modul, alur request, skema database, dan struktur state di memori.

---

## 1. Peta Modul Monorepo

```
Katalis AI Gateway
├── apps/api/                 # Backend proxy + dashboard server (Bun + Hono)
│   ├── src/
│   │   ├── index.ts          # Entrypoint server (Bun.serve, port default 3000)
│   │   ├── app.ts            # Registrasi router, CORS, logger, errorHandler
│   │   ├── env.ts            # Validasi variabel lingkungan (AppEnv)
│   │   ├── db/
│   │   │   ├── index.ts      # Klien PostgreSQL Drizzle
│   │   │   ├── schema.ts     # 4 tabel Drizzle (users, api_keys, payment_invoices, usage_logs)
│   │   │   ├── redis.ts      # Klien ioredis + 4 skrip Lua atomik
│   │   │   └── money.ts      # Aritmetika micro-IDR & konversi string desimal
│   │   ├── middleware/
│   │   │   ├── api-key-auth.ts   # Bearer sk-ktl-... auth untuk /v1/* (Redis cache)
│   │   │   ├── session-auth.ts   # Cookie JWT httpOnly untuk /api/* dasbor
│   │   │   └── error-handler.ts  # Normalisasi semua error ke format JSON OpenAI
│   │   ├── routes/
│   │   │   ├── auth.ts           # /api/auth (register, login, logout, session)
│   │   │   ├── keys.ts           # /api/keys (CRUD key, spend limit, pause/resume)
│   │   │   ├── billing.ts        # /api/billing (buat tagihan QRIS & cek status)
│   │   │   ├── webhooks-qris.ts  # /api/webhooks/qris (callback TriPay HMAC-SHA256)
│   │   │   ├── telemetry.ts      # /api/telemetry (agregasi traffic real-time)
│   │   │   └── v1-proxy.ts       # /v1/chat/completions & /v1/models (OpenAI SDK)
│   │   └── services/
│   │       ├── auth.service.ts
│   │       ├── key.service.ts
│   │       ├── model-catalog.ts  # 8 model AI Tiongkok + harga micro-IDR
│   │       ├── upstream-router.ts# Failover pra-byte pertama, remap model
│   │       ├── token-meter.ts    # Hitung token, diskon LoRA -30%, pemotongan saldo
│   │       ├── qris.service.ts   # Transaksi FOR UPDATE saldo & tagihan
│   │       ├── qris-provider.ts  # Antarmuka TriPay / Midtrans
│   │       └── telemetry.service.ts
│   └── tests/                # 211 unit, integrasi & adversarial test
│
└── apps/web/                 # Single Page Application (React 19 + Vite 8 + Tailwind 4)
    ├── src/
    │   ├── main.tsx          # Entrypoint React
    │   ├── App.tsx           # Router (7 route: 5 tab + login/register + 404)
    │   ├── styles/theme.css  # 8 token warna + font Newsreader/Inter/Mono
    │   ├── lib/              # api.ts, types.ts, format.ts, model-catalog.ts, pricing.ts
    │   ├── hooks/            # useAuth, useKeys, useTelemetry, useToast, useModal
    │   ├── components/
    │   │   ├── ui/           # Button, Badge, Panel, MetricCard, Currency, DataState
    │   │   ├── layout/       # AppLayout, Navbar (responsive, split 768-1280px)
    │   │   ├── monitor/      # ThroughputChart (Chart.js), PoolStatusCard
    │   │   ├── models/       # ModelsTable, ModelFilters
    │   │   ├── keys/         # CreateKeyModal, SpendLimitModal
    │   │   ├── billing/      # PlanSelector, QrisModal (QR SVG + countdown + polling)
    │   │   ├── docs/         # CodeSnippet, PlaygroundPanel, CodeBlock (tint syntax)
    │   │   └── command/      # CommandPalette (⌘K / Ctrl+K)
    │   └── pages/            # MonitorPage, ModelsPage, KeysDashboardPage,
    │                         # BillingPage, DocsPage, LoginPage, RegisterPage
    └── tests/                # 61 test RTL + Happy DOM + compliance audit
```

---

## 2. Dua Jalur Request yang Terpisah Secara Ketat

Ada **dua jenis request HTTP** dengan kebutuhan performa dan keamanan yang sangat berbeda:

### Jalur A — Proxy OpenAI-Compatible (`/v1/*`)
- **Tujuan:** Dipanggil oleh SDK OpenAI resmi (Python, JS, Cursor, Cline, Roo Code).
- **Autentikasi:** Header `Authorization: Bearer sk-ktl-...`.
- **Latency budget:** `< 1ms` untuk auth di layer gateway.
- **Mekanisme auth:** Kunci mentah di-hash SHA-256 → diperiksa ke **Redis** (`HGETALL apikey:<hash>`). Jika cache kosong, fallback ke PostgreSQL lalu cache disimpan kembali.
- **Pemotongan saldo:** Atomic via skrip Lua di Redis (`charge`), lalu disinkronkan ke PostgreSQL `users.wallet_balance_idr` dan dicatat di `usage_logs` secara transaksional.
- **Failover:** Jika upstream mengembalikan `5xx` atau koneksi timeout (`PROXY_FIRST_BYTE_TIMEOUT_MS`, default 3000 ms), rute otomatis mencoba upstream cadangan. Jika **seluruh upstream gagal**, kembalikan HTTP 502 dan saldo **Rp 0 terpotong**.

### Jalur B — API Dasbor Member (`/api/*`)
- **Tujuan:** Dipanggil oleh frontend web Katalis.
- **Autentikasi:** Cookie `katalis_session` (JWT httpOnly, algoritma HS256).
- **Mekanisme:** Middleware `sessionAuth` memverifikasi JWT dan mengekstrak `user.id`.
- **Operasi sensitif:** Membuat API Key, menyetel spend limit, memvalidasi webhook QRIS, membuat invoice tagihan.

> **PENTING TENTANG CORS:** Backend Hono HANYA memberikan header CORS untuk `/api/*`. Jalur `/v1/*` **tidak** memiliki CORS header. Oleh karena itu, frontend web saat dev menggunakan **proxy bawaan Vite** (`/api` dan `/v1` di-forward ke `localhost:3000`), dan di lingkungan produksi **wajib** menggunakan reverse-proxy (Nginx/Caddy) dengan origin yang sama!

---

## 3. Skema Database PostgreSQL (Drizzle ORM)

File: `apps/api/src/db/schema.ts`. Ada 4 tabel:

```
┌────────────────────────────────┐       ┌────────────────────────────────┐
│             users              │       │            api_keys            │
├────────────────────────────────┤       ├────────────────────────────────┤
│ id (UUID, PK)                  │◄──┐   │ id (UUID, PK)                  │
│ email (varchar 255, UNIQUE)    │   └───│ user_id (UUID, FK -> users)    │
│ password_hash (text)           │       │ name (varchar 100)             │
│ google_id (varchar 128)        │       │ key_prefix (varchar 16)        │
│ wallet_balance_idr (num 14,4)  │       │ key_hash (varchar 64, UNIQUE)  │
│ unlimited_expires_at (tstz)    │       │ spend_limit_idr (num 14,4)     │
│ has_claimed_trial (boolean)    │       │ spent_idr (num 14,4)           │
│ created_at (tstz)              │       │ is_active (boolean)            │
└────────────────────────────────┘       │ last_used_at (tstz)            │
         ▲                      ▲        │ created_at (tstz)              │
         │                      │        └────────────────────────────────┘
         │                      │
┌────────┴───────────────────────┴─┐     ┌────────────────────────────────┐
│           usage_logs             │     │        payment_invoices        │
├──────────────────────────────────┤     ├────────────────────────────────┤
│ id (bigserial, PK)               │     │ id (varchar 64, PK, INV-KTL-*) │
│ user_id (UUID, FK -> users)      │     │ user_id (UUID, FK -> users)    │
│ api_key_id (UUID, FK -> api_keys)│     │ plan_type (varchar 32)         │
│ model_id (varchar 100)           │     │ base_amount_idr (integer)      │
│ pool_tier (varchar 24)           │     │ bonus_amount_idr (integer)     │
│ upstream_provider (varchar 32)   │     │ total_pay_idr (integer)        │
│ prompt_tokens (integer)          │     │ qris_string (text)             │
│ completion_tokens (integer)      │     │ provider_ref (varchar 128, UQ) │
│ cost_charged_idr (num 12,6)      │     │ status (PENDING/PAID/EXPIRED)  │
│ latency_ms (integer)             │     │ paid_at (tstz)                 │
│ http_status (integer)            │     │ expires_at (tstz)              │
│ created_at (tstz)                │     │ created_at (tstz)              │
└──────────────────────────────────┘     └────────────────────────────────┘
```

### Satuan Uang
- Database PostgreSQL menyimpan uang dengan tipe `numeric(14, 4)` untuk saldo dan `numeric(12, 6)` untuk `cost_charged_idr` di `usage_logs`.
- Di Redis dan komputasi runtime, uang dihitung dalam **micro-IDR integer** (`1 IDR = 1_000_000 micro-IDR`) untuk menghindari drift floating point.
- Helper konversi: `apps/api/src/db/money.ts` (`toIdr`, `toMicroIdr`, `microToIdrString`, `round4Idr`).

---

## 4. Struktur Kunci Redis & Skrip Lua Atomik

File: `apps/api/src/db/redis.ts`.

| Pola Kunci | Tipe | TTL | Kegunaan |
|---|---|---|---|
| `apikey:<hash>` | HASH | none (invalidasi manual) | Cache data API key (`id`, `user_id`, `is_active`, `spend_limit_idr`, `spent_idr`). |
| `wallet:<userId>` | STRING (float) | none | Saldo runtime member. Di-seed dari PG via Lua `initWallet` (SET NX). |
| `wallet:seed:<userId>` | STRING | 60s | Snapshot saldo PG pasca-kredit webhook (mencegah stale-NX race). |
| `flex:<userId>` | ZSET | 5 jam | Sliding window token untuk Flex Pool (member: `<tokens>:<uuid>`, score: timestamp). |
| `telemetry:latest` | STRING (JSON) | 2s | Cache agregasi trafik telemetri. Panggilan dibatasi timeout 200ms. |

### Skrip Lua Atomik
1. **`PRECHECK_LUA`**: Memeriksa apakah `wallet > 0` dan (jika ada spend limit) `spent + cost <= limit`. Mengembalikan `"1"` atau `"0"`.
2. **`CHARGE_LUA`**: Menggabungkan pengecekan kecukupan saldo + spend limit + debit sekaligus. Jika saldo kurang dari biaya tapi masih positif, meng-klamp debit ke sisa saldo (`min(cost, available)`). Mengembalikan JSON `{decision, debit}`.
3. **`FLEX_WINDOW_LUA`**: Membuang entri lebih tua dari window, menambahkan request baru, dan menjumlahkan token dari member yang tersisa.
4. **`INIT_WALLET_LUA`**: Menginisialisasi `wallet:<userId>` secara `SET NX` hanya jika belum ada, dengan menghormati snapshot `wallet:seed:<userId>` jika ada.
