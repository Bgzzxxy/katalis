# Batch 5 — Frontend UI Warm Editorial & Telemetri (rencana `architect`)

> Eksekutor: `frontend-developer` (+ `ui-ux-designer` untuk arah visual). Blocker: endpoint `/api/telemetry` (Batch 5.0) perlu dibuat `backend-developer`.
> Referensi: `Design.md` (utama), `Prd.md` §5, `Implementation Plan.md` §3 BATCH 5, `CLAUDE.md` §3/§5.5.

## 0. Fakta terverifikasi (working tree)
- `theme.css` **belum** punya `@import "tailwindcss";` → wajib ditambah.
- `index.html` belum memuat font Inter/JetBrains Mono.
- CORS backend hanya `/api/*`; **`/v1/*` tidak** → akses API harus **same-origin via Vite proxy** (`/api` + `/v1` → `:3000`).
- Dep web terpasang: react, react-dom, tailwind, vite, typescript. Belum ada: react-router, chart.js, qrcode, testing-library, happy-dom, playwright.
- `tsconfig.json` root `exclude: ["apps/web"]` → `bun run typecheck` root TIDAK memeriksa web; wajib `bun run --cwd apps/web typecheck` terpisah.
- `usage_logs` punya `latency_ms, prompt/completion_tokens, pool_tier, created_at, user_id`.
- **CELAH (jangan dikarang):** tidak ada endpoint telemetri; tidak ada field kuota bonus harian; tidak ada Google OAuth; `PublicUser` tak memuat `has_claimed_trial`.

## 1. Keputusan
- SPA React 19 + **react-router v7** (7 route: 5 tab + login/register + 404).
- Akses API **same-origin via Vite dev-proxy** `/api` & `/v1` (bukan CORS lintas-port).
- Satu komponen bersama **`DataState`** menegakkan 4 status data sekali untuk semua.
- Token warna via Tailwind 4 `@theme inline` merujuk variabel `--bg-canvas` dst (fallback arbitrary hex `bg-[#F0EEE8]`).
- Grafik Chart.js sesuai `Design.md` §5.2; **wajib `chart.destroy()` di cleanup** (StrictMode React 19).
- **Monitor**: endpoint telemetri tidak ada → **rekomendasi opsi (b) endpoint backend minimal `GET /api/telemetry`** (Batch 5.0, tanpa migrasi, agregat `usage_logs`, cache Redis 2s). Mock HANYA untuk unit test / dev-mode bertanda. Jika ditolak → Monitor hanya `/api/health` + angka member, tanpa grafik fabrikasi.

## 2. Endpoint usulan Batch 5.0 (backend-developer)
```
GET /api/telemetry  (publik; cache Redis TTL 2s)
200 { connection:{ok,latency_ms}, total_tokens, requests_per_second,
      avg_latency_ms, pools:[{tier,recent_requests,load_pct}],
      window:[{t,epochMs,tokens,requests}] }
```
Angka member (saldo, active_keys) dari `/api/auth/session` + `/api/keys` yang ada. Countdown reset kuota 00:00 WIB = client-side (UTC+7).

## 3. Batas modul
- **backend-developer**: `routes/telemetry.ts`, `services/telemetry.service.ts`, `tests/telemetry.test.ts`, edit `app.ts` (Batch 5.0).
- **frontend-developer**: seluruh `apps/web/src/**` (styles/theme.css, index.html, vite.config, lib/, hooks/, components/, pages/, App.tsx, main.tsx), `apps/web/tests/**` (selain qa/), `apps/web/tests/preload.ts` + edit root `bunfig.toml` (koordinasi).
- **qa-engineer**: `apps/web/tests/qa/**` + `apps/web/e2e/*.e2e.ts` + `playwright.config.ts` (ekstensi `.e2e.ts` agar `bun test` tak memungutnya).
- READ ONLY: `db/schema.ts`, `drizzle/**`; backend Batch 1–4.

## 4. Urutan implementasi TDD
0. Prasyarat: Batch 5.0 `/api/telemetry` hijau (keputusan orchestrator).
1. Fondasi: theme.css (`@import "tailwindcss"` + `@theme inline` + font), deps baru, vite proxy; `lib/{types,api,format}.ts`; tes format+api.
2. **Spike**: buktikan 1 tes RTL+happy-dom render komponen di bawah `bun test`. Jangan lanjut sebelum hijau (fallback jsdom / `vitest run`).
3. Shell: main.tsx router, AppLayout, Navbar, DataState, Toast, primitif ui/.
4. Monitor (deps 0,3): useTelemetry, ThroughputChart, PoolStatusCard, MetricCard.
5. Model (deps 3): model-catalog, ModelTable/Filters, TokenCalculator, toggle -30%.
6. Auth (deps 1,3): useAuth, RequireAuth, AuthForm, Login/Register.
7. Keys (deps 3,6): useKeys, KeysTable, CreateKeyModal, SpendLimitModal.
8. Billing (deps 3,6): useBillingPoll, PlanSelector, InvoiceSummary, QrisModal (QR + countdown 15m + poll 3s).
9. Docs & Playground (deps 3): CodeSnippet, PlaygroundPanel (non-stream), JsonOutput+latency.
10. CommandPalette ⌘K (deps 3,5).
11. Polish + QA + E2E: audit 4-status, tabular-nums, responsif; QA `tests/qa/` + 2–3 E2E; gerbang akhir.

## 5. Gaya per komponen (patuh Design.md §5)
- Navbar `h-14 sticky top-0 z-30 bg-surface border-b border-hairline`; monogram KT `bg-primary text-surface font-mono`; badge GATEWAY; titik hijau `bg-success` + `Terhubung · {latency}ms`; 5 tab; kanan: `Cari model... ⌘K`, salin Base URL, saldo `text-success tabular-nums`.
- ThroughputChart: `relative h-64 w-full` + `maintainAspectRatio:false`; token `#54836A` area `rgba(84,131,106,0.10)`; req `#B77A45` area `rgba(183,122,69,0.10)`; grid `#DCD8CE`; tick mono `#77746B`.
- PoolStatusCard ×3 (LORA accent, STABLE success, FLEX secondary→accent dekat batas).
- Tabel: header `bg-canvas` + `border-b border-hairline`; TH `font-mono uppercase text-secondary [11px]`; baris `bg-surface hover:bg-[#F0EEE8]/60`; angka `text-right tabular-nums`; ID model kapsul klik→copy+toast.
- QrisModal: `bg-surface border-hairline`; QR di tengah; countdown `tabular-nums text-accent`; polling `Menunggu Pembayaran...`→kotak hijau.
- CommandPalette: satu-satunya elemen boleh shadow mengambang; `⌘K`/`Ctrl+K`.
- DataState props `{state, skeletonRows, emptyLabel, emptyAction, errorCode, onRetry, children}`.

## 6. Celah yang TIDAK boleh dikarang
- Tidak ada Google OAuth → **jangan render tombol mati**.
- Tidak ada field kuota harian → jangan tampilkan angka fabrikasi.
- `has_claimed_trial` tak ada di `PublicUser` → Trial ke-2 ditangani dari error 400 `TRIAL_ALREADY_CLAIMED`.

## 7. Testing
- Unit/behavior: RTL + happy-dom via `bun test` (~10 tes dev + ~8 tes QA). Skip `@testing-library/jest-dom` (pakai `expect` polos).
- E2E Playwright `e2e/*.e2e.ts` (2–3): Monitor+Model publik; register→login→buat key; billing→modal QRIS.
- Gerbang: `bun test` (root, 0 fail); `bun run --cwd apps/web build`; `bun run --cwd apps/web typecheck`.

## 8. Deps baru
`react-router-dom`, `chart.js`, `react-chartjs-2`, `qrcode` (+`@types/qrcode`), `@fontsource/inter`, `@fontsource/jetbrains-mono`, `@testing-library/react`, `@testing-library/user-event`, `@happy-dom/global-registrator`, `@playwright/test`.

## 9. Risiko
- Telemetry blocker (Batch 5.0) — risiko tertinggi.
- Ekosistem tes bun+RTL+happy-dom = ASUMSI (spike langkah 2 wajib).
- Tailwind 4 `@import` wajib; potensi tabrakan nama `@theme inline` → fallback arbitrary hex.
- Chart.js destroy pada cleanup.
- Drift katalog harga frontend vs backend (asumsi bisnis).
- CORS `/v1/*` tak tercakup → wajib proxy same-origin.

## 10. Checklist invariant
- [x] §5.5 8 token saja, tanpa gradasi/glassmorphism/ikon dekoratif.
- [x] 4 status data via DataState; `tabular-nums` angka dinamis.
- [x] Tanpa perubahan skema; akses API via cookie httpOnly; raw key tampil sekali.