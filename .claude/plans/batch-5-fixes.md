# Batch 5 — Consolidated Fix Spec (orchestrator)

> Sources: `ui-ux-designer` compliance audit (Design.md), `qa-engineer` adversarial suite,
> `code-reviewer` (pending — backend section appended when it reports).
> Scope split: **A = `apps/web/**` (frontend-developer)**, **B = `apps/api/**` (backend-developer)**.
> No file is written by both agents.

## A. Frontend fixes (`apps/web`)

### A1 (HARD, Design §6) — Login/Register error panel
`pages/LoginPage.tsx:68-70`, `pages/RegisterPage.tsx:70-72` render the error as a bare
`<p>{error.errorCodeLabel}</p>`: the human message is discarded, no panel, no recovery action.
Design §6 state 3 requires: `rgba(196,94,82,0.10)` panel, `1px solid #C45E52` border,
mono technical code, cause explanation, and a recovery button.
Fix: render the existing `DataState` with `state="error"` (it already implements §6 exactly),
passing `errorCode={error.errorCodeLabel}`, `errorMessage={error.message}`, `onRetry` = resubmit.
Do not add a second error component.

### A2 (HARD, Design §6) — Models empty state
`pages/ModelsPage.tsx:45-47` + `components/models/ModelsTable.tsx` — a filter with 0 matches
renders an empty `<tbody>`, no dashed empty box, no reset action.
Fix: in `ModelsPage`, when `filtered.length === 0` render
`<DataState state="empty" emptyLabel="Tidak ada model cocok dengan filter" emptyAction={{label:"Reset filter", onClick: resetFilters}} />`
instead of `<ModelsTable models={[]} />`. Keep `ModelsTable` as-is.
Compatibility: `apps/web/tests/qa/models-filter-integration.qa.test.tsx:53-58` asserts the
Panel title still reads `Model (0)` and finds no `tbody button` — keep the Panel heading
(`Model ({filtered.length})`) untouched so that test keeps passing.

### A3 (HARD/§5.4) — Dashboard Key summary cards
`pages/KeysDashboardPage.tsx` jumps from H1 to the table; §5.4 mandates 3 summary cards.
Data reality: `/api/auth/session` (`PublicUser`) exposes `wallet_balance_idr` and
`unlimited_expires_at`. **There is NO daily-allowance field anywhere in the backend.**
Per `DESIGN.md` §1 ("Dilarang Menampilkan Angka atau Tombol Palsu") do **not** fabricate one.
Implement the 2 real cards (Sisa Saldo Dompet, Status Paket Unlimited + expiry date) using
`useAuth().user`; leave ONE code comment. **The comment must not contain the words
`kuota`, `quota`, or `bonus harian`** — `apps/web/tests/qa/design-compliance.qa.test.ts:83-89`
is a static guard that fails the whole suite on those strings. Suggested comment:
`// shortcut: the third §5.4 card needs a backend daily-allowance field that does not exist yet; a fabricated value would violate Design.md §1, so it is omitted.`
Cards reuse `MetricCard` (already exists) in a `grid grid-cols-1 gap-3 md:grid-cols-3`.
Also note `design-compliance.qa.test.ts` bans `<svg`/`<img` in components and any `shadow-*`
outside `CommandPalette.tsx` — keep new markup within those bounds.

### A4 (MEDIUM, §5.3) — Discount price colour, Input column
`components/models/ModelsTable.tsx:66` — Input column wraps the discounted price in
`text-secondary`; §5.3/§2 says the discounted price must be `#B77A45` (accent) with only the
struck-through nominal in secondary. Output column (`:73`) is already correct — match it.
Fix line 66 to `<span className="text-accent"><s className="text-secondary">{inPrice}</s> {…}</span>`.

### A5 (MEDIUM, §2.2) — Code block syntax colours
`pages/DocsPage.tsx:63` and `components/docs/PlaygroundPanel.tsx:107-110` render code
monochrome on `#282824`. §2.2 requires comments `#77746B`, strings/keys `#B77A45`,
successful values `#54836A`.
Fix: add one tiny tokenizer used by both call sites (one small shared component, e.g.
`components/docs/CodeBlock.tsx`) that wraps comments/strings/numbers in spans with the three
token colours. Keep it minimal — no syntax-highlight library.

### A6 (QA BUG) — Navbar connection badge contradicts Monitor
`components/layout/AppLayout.tsx:9-10` passes only `latencyMs`; `components/layout/Navbar.tsx:36-49`
treats ANY numeric latency as "Terhubung · Nms", even when telemetry `connection.ok === false`.
Fix: pass `connectionOk` through to `Navbar`; when `ok === false` show the error dot +
`"Terputus"` and no latency. (Monitor already renders "Terputus" correctly — the two must agree.)

### A7 (QA BUG) — Expired QRIS invoice keeps polling
`components/billing/QrisModal.tsx:52-68,135-137` — polling only stops on `PAID`; an `EXPIRED`
(or `FAILED`) invoice keeps the "Menunggu Pembayaran..." indicator and keeps polling forever.
Fix: treat any terminal status (`PAID`, `EXPIRED`, `FAILED`) as stop-polling; render an
expired/failed panel (reuse the §6 error/success panel styling already in the file) and hide
the "Menunggu Pembayaran..." line. Keep the countdown's own terminal behaviour consistent.

### A8 (QA BUG) — Command palette model search drops `?q=`
`components/command/CommandPalette.tsx:65` navigates to `/models?q=<id>`, but
`pages/ModelsPage.tsx` never reads `useSearchParams()`, so the query is ignored.
Fix: seed `filters.query` from the `q` search param on mount (and when it changes).

### A9 (MEDIUM, a11y) — Modal keyboard/focus contract
`QrisModal.tsx:74-79`, `keys/CreateKeyModal.tsx:51-56`, `keys/SpendLimitModal.tsx` declare
`role="dialog"` but lack `aria-modal`, `aria-labelledby`, Escape-to-close and focus trapping.
Fix: one small shared hook (`hooks/useModal.ts`) applying Escape close + initial focus + focus
restore, and add `aria-modal="true"` + `aria-labelledby` pointing at each modal's H2. Keep it
one implementation used by all three modals.

### A10 (chore) — Drop the dead dependency
`apps/web/package.json:16` lists `react-chartjs-2` but `ThroughputChart.tsx` uses `chart.js`
directly. Remove it (`bun remove react-chartjs-2` from `apps/web`); confirm nothing imports it.

### A11 (MEDIUM) — No mobile navigation
`components/layout/Navbar.tsx:53` — the 5 primary tabs are `hidden ... md:flex` with no
fallback, so below `md` (768px) a user can only reach "Masuk". `Design.md §4.1` specifies
mobile padding, i.e. mobile is a supported viewport.
Fix: add one compact mobile nav (a horizontally scrollable row of the same `TABS`, or a
`<select>`), below `md` only. Reuse the existing tab styling; do not add new colours.

### A12 (LOW) — Fabricated fallback price in the cost calculator
`pages/ModelsPage.tsx:29` falls back to a hardcoded `{9, 22}` price when the filter matches
nothing, silently showing a fabricated estimate. `Design.md §1` bans fake numbers.
Fix: when `filtered.length === 0`, render the estimate as `—` (no number) instead of a
fabricated base price.

### A13 (chore) — Refresh the wallet after a paid invoice
`pages/BillingPage.tsx:49-55` shows "Saldo telah ditambahkan" but never refreshes `useAuth()`,
so the navbar balance stays stale until a manual reload.
Fix: when the QRIS modal reports `PAID`, call `useAuth().refresh()` once (pass an
`onPaid` callback into `QrisModal`; fire it on the PENDING→PAID transition only).

## B. Backend fixes (`apps/api`)

### B4 (MEDIUM) — Telemetry cache calls can hang on a dead Redis
`services/telemetry.service.ts:115,131` call `redis.get`/`redis.set` "best-effort" but with no
timeout; the default ioredis retry strategy makes them hang for ~20 retries (measured: a
command against a dead Redis did not return within 60s). `redis.ts:3-5` builds the client with
`new Redis(url, { lazyConnect: false })` and no `maxRetriesPerRequest`/`commandTimeout`.
Fix (smallest): give the telemetry cache calls a bounded wait — wrap each in
`Promise.race([op, timeout(200ms)])` inside the existing try/catch (mirrors `pingRedis` at
`db/redis.ts:7-21`). Do NOT change the shared client options — other callers depend on them.

### B5 — (resolved, no action) `apps/web/tests/qa/**` TS errors
The 14 errors the reviewer measured were transient: `qa-engineer` was mid-edit and fixed them
at 07:08. Verified: `bun run --cwd apps/web typecheck` and `bun run typecheck` now both exit 0.
Re-confirm at the end; no code change planned here.

### B1 (MEDIUM, §5.5) — Invoice itemisation is unavailable to the client
`QrisModal` can only show "Total Bayar" because `InvoiceView` (both
`apps/api/src/services/qris.service.ts:13-20` and `apps/web/src/lib/types.ts:25-32`) omits
`base_amount_idr` and `bonus_amount_idr`, even though `payment_invoices` stores both
(`db/schema.ts:56-57`).
Fix (backend half): add `base_amount_idr` and `bonus_amount_idr` (IDR, decoded) to the
`InvoiceView` returned by `createInvoice`, populated from the row. Frontend half: extend the
web `InvoiceView` type and render the itemised block (Nominal Paket / Bonus / Total Bayar).
Note: there is no service-fee or unique-code charge in the current pricing model — show the
rows that exist, do not invent a fee line.

<!-- B2+ appended after the code-reviewer reports -->

## Verification gate (both agents)
- `bun run --cwd apps/web typecheck` and `bun run typecheck` → exit 0.
- `bun test` at the repo root → 0 fail **with no other `bun test` running concurrently**
  (the earlier 82 failures were measured cross-process DB/Redis contamination).
- `bun run --cwd apps/web build` → clean.
