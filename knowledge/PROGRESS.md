# Progres Pembangunan Katalis AI Gateway (Kronologis)

Semua pekerjaan direncanakan dalam **5 Batch** mengikuti `Implementation Plan.md`. Setiap batch melewati siklus: *Discovery → Architecture → Implementation → Testing → Security Review → Code Review → Integration → Final Verification*, dengan **QA independen** dan verifikasi bukti nyata (`bun test` + `bun run typecheck`) — tidak ada klaim tanpa bukti eksekusi.

## Riwayat Commit (Branch `master`)

| Commit | Batch | Judul |
|---|---|---|
| `cde5fc7` | Batch 1 | scaffolding monorepo, skema DB & autentikasi member |
| `ebc859f` | Batch 1 | perbaikan bug hasil review QA/security/code |
| `841713b` | Batch 2 | manajemen multi-API key & fast auth middleware |
| `32fe1b8` | Batch 3 | proxy OpenAI-compatible, router upstream & token meter |
| `9abc557` | Batch 4 | integrasi payment gateway QRIS & webhook |
| `06dacb1` | Batch 5 | frontend Warm Editorial + telemetri gateway |
| `f116f13` | Redesign v2.1 | redesign UI/UX ke Design.md v2.1 — warm editorial premium |
| `1111e4d` | Fix v2.1 | navbar tidak lagi melipat 768–1280px + dedupe judul Docs |

---

## Batch 1 — Scaffolding, Skema Database & Autentikasi Member

**Status:** ✅ Selesai & ter-uji.

- Monorepo `bun workspaces` (`apps/api` + `apps/web`).
- Skema Drizzle 4 tabel: `users`, `api_keys`, `payment_invoices`, `usage_logs` (`apps/api/src/db/schema.ts`).
- Autentikasi: register/login email (Argon2) + cookie sesi JWT httpOnly (`kalis_session`).
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`.
- `GET /api/health` (status DB + Redis).

**Bug yang ditemukan reviewer & diperbaiki di `ebc859f`:**
- JSON malformed → dulu HTTP 500, seharusnya 400 (`HTTPException` handling di `error-handler.ts`).
- Timing attack pada login (dummy hash Argon2 ditambahkan).
- Email case-sensitivity → `.toLowerCase()`; email >255 char → harus 400.
- `sub` JWT non-UUID → dulu 500, diperbaiki jadi 401 (regex UUID).
- Route tak dikenal → dulu HTML 404 bawaan Hono, diperbaiki jadi amplop OpenAI.
- Health check bisa menggantung 73 detik saat Redis mati → `pingRedis` dengan timeout 2 detik.

---

## Batch 2 — Manajemen Multi-API Key & Fast Auth Middleware

**Status:** ✅ Selesai & ter-uji.

- Format API key: `sk-ktl-<32 karakter acak base58>` (CSPRNG), disimpan HANYA sebagai hash SHA-256 + `key_prefix` untuk tampilan.
- **Raw key ditampilkan sekali** saat dibuat, tidak pernah bisa diambil lagi.
- Middleware `apiKeyAuth`: cache Redis HASH `apikey:<hash>` (O(1), jalur cepat `< 1ms`) dengan fallback PostgreSQL.
- `apps/api/src/routes/keys.ts`: `POST /` (buat), `GET /` (daftar), `PATCH /:id` (ganti nama), `PUT /:id/spend-limit`, `POST /:id/pause`, `POST /:id/resume`, `DELETE /:id` (revoke).
- Semua rute `/api/keys/*` dijaga `sessionAuth` + anti-IDOR (user lain → 404 seragam).

**Bug yang diperbaiki:** Redis mati → pembuatan key dulu 500 (kini dibungkus `try/catch` dan fallback ke PostgreSQL); parsing `Authorization` yang dulu memakai `split(" ")` (rusak pada spasi ganda) diganti regex `/^Bearer\s+(\S+)$/i`.

---

## Batch 3 — Mesin Proxy OpenAI-Compatible & Router Upstream

**Status:** ✅ Selesai & ter-uji. Batch paling sensitif (uang).

- `POST /v1/chat/completions` (streaming SSE + non-stream) & `GET /v1/models`, amplop error OpenAI penuh.
- `apps/api/src/services/upstream-router.ts`: pemilihan rute per model, **auto-failover** hanya sebelum byte pertama (5xx/timeout → upstream cadangan), `remapModel()` untuk mengganti ID model publik → ID model penyedia.
- `apps/api/src/services/token-meter.ts`: `meterTokens()` menghitung biaya micro-IDR integer, diskon −30% untuk model LoRA + paket Unlimited aktif.
- **Saldo atomik via skrip Lua** (`apps/api/src/db/redis.ts`): `precheck`, `charge` (gabungan cek + debit, klamp `min(cost, available)`), `flexWindow` (sliding 5 jam), `initWallet` (seed NX dari PostgreSQL).

**12 temuan reviewer di Batch 3 (semua diperbaiki):** saldo PostgreSQL tidak pernah terdebit, buku besar melebih-lebihkan biaya, `flexWindow` Lua menjumlahkan timestamp (bukan token), `upstreamModel` tidak dipakai, diskon LORA bisa di-bypass, race antara `precheck` dan `charge`, request 4xx tetap ditagih, `spentDelta` kumulatif salah.

**Prinsip yang dikunci di batch ini:**
- Tagihan ditulis = **jumlah yang benar-benar didebit** (`debitMicro`), bukan biaya nominal.
- `users.wallet_balance_idr` di PostgreSQL **wajib ikut terdebit** di dalam transaksi yang sama (durabilitas saldo).
- Bila seluruh upstream gagal → HTTP 502, saldo user **terpotong Rp 0** (dibuktikan test).

---

## Batch 4 — Integrasi Payment Gateway QRIS & Webhook

**Status:** ✅ Selesai & ter-uji.

- `apps/api/src/services/qris-provider.ts`: antarmuka `QrisProvider` agnostik; implementasi TriPay default; verifikasi HMAC-SHA256 dengan `crypto.timingSafeEqual`.
- `POST /api/billing/invoices` (buat tagihan), `GET /api/billing/invoices/:id/status`.
- `POST /api/webhooks/qris`: verifikasi signature (tolak 403 jika tidak cocok), **idempoten** via `SELECT ... FOR UPDATE` — webhook duplikat tidak menambah saldo dua kali. `bodyLimit` 64 KB.
- Kredit saldo diambil dari **baris DB** (bukan payload webhook) — anti-manipulasi.
- Paket: `PREPAID` (Rp 5.000–1.000.000), `UNLIMITED_10D` (Rp 20.000), `TRIAL_1D` (Rp 100, sekali per akun).

**Bug yang diperbaiki (QR-01, QR-02):** race saldo Redis (DEL + SET NX basi → diperbaiki dengan *seed snapshot* di `wallet:seed:<userId>`); provider TriPay tanpa kredensial dulu mengembalikan QRIS palsu → kini `null` (502).

---

## Batch 5 — Frontend Warm Editorial & Telemetri

**Status:** ✅ Selesai & ter-uji.

- Endpoint baru `GET /api/telemetry`: agregasi `usage_logs` (total token, req/detik, latensi rata-rata, beban 3 pool, jendela 60 detik) + cache Redis TTL 2 detik dengan batas tunggu 200 ms.
- SPA React 19 + React Router 7: Monitor, Model, Dashboard Key, Beli/Top Up, Docs/Playground, Login, Register + `RequireAuth`.
- `components/ui/DataState.tsx` menegakkan **4 status data wajib** (Loading/Empty/Error/Populated) sekali untuk semua komponen data.
- 51 berkas web + 19 berkas tes web.

**3 reviewer paralel menemukan; semua diperbaiki di batch yang sama:**
- **ui-ux-designer**: panel error Login/Register belum sesuai §6, empty state filter model hilang, kartu ringkasan §5.4 belum ada, warna harga diskon kolom Input salah, blok kode tanpa warna sintaks §2.2, modal tanpa `aria-modal`/Escape/focus-trap.
- **qa-engineer**: navbar mengklaim "Terhubung" saat gateway `ok:false`; invoice QRIS `EXPIRED` terus polling tanpa henti; ⌘K `?q=` tidak diterapkan di `/models`.
- **code-reviewer**: panggilan Redis telemetri bisa menggantung > 60 detik saat Redis mati; `InvoiceView` tidak mengekspos `base_amount_idr`/`bonus_amount_idr`.

**Keputusan penting:** kartu "Kuota Bonus Harian" (§5.4) **sengaja tidak dirender** — backend belum punya kolomnya, dan Design.md §1 melarang angka palsu. Ada komentar `shortcut:` di `KeysDashboardPage.tsx`.

---

## Redesign v2.1 — Warm Editorial Premium

**Status:** ✅ Selesai, ter-verifikasi visual di browser, ter-push.

- Tri-font: **Newsreader** (serif untuk H1/judul editorial/nama paket) + **Inter** (`cv02–cv11`) + **JetBrains Mono** (`tabular-nums slashed-zero`, tanpa ligatur).
- `components/ui/Currency.tsx`: format Rupiah *split-weight* (§3.4.1) — simbol `Rp` kecil abu-abu, angka besar tebal.
- Navbar: `sticky bg-surface/95 backdrop-blur-sm`, monogram `KT`, brand serif, ikon Lucide fungsional (`Copy`, `Plus`, `Search`).
- `shadow-lg` sekarang diizinkan pada overlay melayang (CommandPalette, 3 modal, Toast) sesuai §4.1 v2.1.
- H1 `font-serif text-[22px]` di seluruh halaman; KPI `font-mono text-[22px]`.
- Fix lanjutan (`1111e4d`): tab navbar tidak lagi melipat di lebar 768–1280px (pindah ke baris kedua scrollable di bawah `xl`); judul Docs yang duplikat dihapus.

**Verifikasi visual nyata (Playwright headless):** 1440px, 1024px, 768px, 390px → semua rapi tanpa teks terpotong. Halaman `/monitor`, `/models`, `/keys`, `/billing` (termasuk panel error QRIS 502), `/docs` diperiksa satu per satu dengan login nyata.
