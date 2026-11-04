# Batch 1 — Rencana Implementasi (disusun `architect`, terverifikasi di environment ini)

> Status: **APPROVED untuk eksekusi** oleh orchestrator. Setiap fakta di dokumen ini sudah diverifikasi langsung terhadap environment (Bun 1.4.4, PG 16.15, Redis 7.0.15) — jangan "memperbaiki" yang sudah terbukti; ikuti apa adanya.
> Eksekutor: `backend-developer`. Referensi: `CLAUDE.md` (Bagian 2), `Prd.md` §6.3, `Implementation Plan.md` §3.

## 0. Ringkasan keputusan

1. Monorepo `bun workspaces`: `apps/api` (Hono) + `apps/web` (React/Vite — sengaja hanya scaffold kosong).
2. Skema Drizzle untuk **KEEMPAT tabel** (`users`, `api_keys`, `payment_invoices`, `usage_logs`) dibuat sekaligus di migrasi `0000`. Alasan: `key_hash`/FK antar tabel saling terkait; Batch 2/3 berjalan paralel dan akan berebut nomor migrasi kalau ditunda. **Batas tegas:** Batch 1 hanya membuat definisi kolom/tabel — TIDAK membuat layanan (`qris.service.ts`, `token-meter.ts`), tidak menulis ke `payment_invoices`/`usage_logs`, tidak membuat `routes/billing.ts`.
3. Auth: sesi **cookie HttpOnly** berisi JWT HS256 (`hono/jwt`), password di-hash Argon2id (`@node-rs/argon2`).
4. `bun test` dapat menjalankan berkas tes bergaya Vitest (import dari `"vitest"`) — perintah `bun test` di `CLAUDE.md` dan "Vitest" di `Implementation Plan.md` terpenuhi sekaligus.

## 1. Struktur monorepo final

```
/home/bagus/PROJECT/Katalis/
├── package.json                 # root workspace + scripts
├── bunfig.toml                  # [test] preload → .env.test
├── tsconfig.json                # base; HANYA include apps/api/** + drizzle.config.ts
├── drizzle.config.ts            # WAJIB DI ROOT (bukan apps/api) — lihat Jebakan #5
├── .env                         # dev  (GITIGNORED)
├── .env.test                    # test (GITIGNORED)
├── .env.example                 # COMMITTED, nilai dummy
├── .gitignore
├── CLAUDE.md  Prd.md  Design.md  "Implementation Plan.md"
└── apps/
    ├── api/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── drizzle/             # keluaran drizzle-kit (COMMITTED)
    │   │   ├── 0000_*.sql
    │   │   └── meta/
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── app.ts           # factory createApp(deps) — dipakai tes
    │   │   ├── env.ts           # pembacaan + validasi env (fail-fast)
    │   │   ├── db/{schema.ts,index.ts,redis.ts,money.ts}
    │   │   ├── middleware/{session-auth.ts,error-handler.ts}
    │   │   ├── routes/auth.ts
    │   │   └── services/auth.service.ts
    │   └── tests/{preload.ts,helpers/{db.ts,http.ts},auth.test.ts,health.test.ts}
    └── web/
        ├── package.json
        ├── tsconfig.json        # types: ["vite/client"], lib: ["ESNext","DOM"]
        ├── vite.config.ts
        ├── index.html
        └── src/{main.tsx,App.tsx,styles/theme.css}
```

### 1.1 Root `package.json` (versi terverifikasi)

```json
{
  "name": "katalis",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev:api": "bun run --cwd apps/api dev",
    "dev:web": "bun run --cwd apps/web dev",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "bun run --cwd apps/web build",
    "db:generate": "drizzle-kit generate --config drizzle.config.ts",
    "db:migrate":  "drizzle-kit migrate  --config drizzle.config.ts",
    "db:push":     "drizzle-kit push     --config drizzle.config.ts"
  },
  "devDependencies": {
    "@types/bun": "^1.4.4",
    "drizzle-kit": "^0.31.11",
    "typescript": "^7.0.2",
    "vitest": "^5.1.0"
  }
}
```

- **Jebakan #5 (terbukti):** `bun install` TIDAK meng-hoist `drizzle-kit` ke `node_modules/.bin/` root bila hanya ada di `apps/api` → `bun run db:generate` gagal `Cannot find module 'drizzle-kit'`. Maka `drizzle-kit` WAJIB di root dan `drizzle.config.ts` WAJIB di root.
- **Jebakan #2 (terbukti):** `vitest` tetap harus terpasang meski runner-nya `bun test` — `tsc --noEmit` gagal `TS2307` tanpa paket itu. Impor dari `"vitest"` membuat berkas tes yang sama lolos di `bun test` maupun `vitest run`.
- Jalur mundur TypeScript: bila `typescript@7.0.2` bermasalah, pin ke `5.9.3` (terverifikasi ada), alih-alih debug compiler.

### 1.2 `apps/api/package.json`

```json
{
  "name": "@katalis/api",
  "scripts": { "dev": "bun run --watch src/index.ts" },
  "dependencies": {
    "@hono/zod-validator": "^0.9.1",
    "@node-rs/argon2": "^2.2.2",
    "drizzle-orm": "^0.45.4",
    "hono": "^4.13.16",
    "ioredis": "^6.0.0",
    "postgres": "^4.0.0",
    "zod": "^4.6.7"
  }
}
```

`apps/web/package.json`: `react@^19.3.1`, `react-dom@^19.3.1`, `vite@^8.3.5`, `@vitejs/plugin-react@^6.2.1`, `tailwindcss@^4.3.4`, `@tailwindcss/vite@^4.3.4`, `@types/react`, `@types/react-dom`. (Scaffold kosong tanpa logika.)

### 1.3 `drizzle.config.ts` (ROOT)

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./apps/api/src/db/schema.ts",
  out: "./apps/api/drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```
Terverifikasi: `drizzle-kit@0.31.11` butuh driver `pg`/`postgres`/`@neondatabase/serverless`/`@vercel/postgres` terpasang (kita pakai `postgres@4.0.0`).

### 1.4 `bunfig.toml`

```toml
[test]
preload = ["./apps/api/tests/preload.ts"]
```

### 1.5 Env

**Terbukti menguntungkan:** Bun 1.4.4 otomatis memuat `.env.test` saat `NODE_ENV=test`, dan `bun test` otomatis men-set `NODE_ENV=test` → tes tidak akan menyentuh DB dev.

- `.env` (dev, gitignored): `DATABASE_URL=postgres://katalis:katalis_dev@127.0.0.1:5432/katalis`, `REDIS_URL=redis://127.0.0.1:6379`, `JWT_SECRET=<32+ char acak>`, `NODE_ENV=development`
- `.env.test` (gitignored): sama, tapi `.../katalis_test`
- `.env.example` (committed): kunci sama, nilai dummy

`apps/api/src/env.ts` **fail-fast**: `JWT_SECRET` < 32 char atau `DATABASE_URL` kosong → lempar error saat boot.

## 2. Skema Drizzle — 4 tabel

File: `apps/api/src/db/schema.ts`. DDL hasil generate sudah dibandingkan baris-per-baris dengan `Prd.md` §6.3 dan **identik**.

| Tabel | Kolom | Tipe Drizzle | Catatan |
|---|---|---|---|
| `users` | id | `uuid("id").defaultRandom().primaryKey()` | → `gen_random_uuid()`; built-in PG 13+ (terverifikasi) |
| | email | `varchar("email",{length:255}).notNull().unique()` | |
| | passwordHash | `text("password_hash")` | **nullable** — member OAuth tidak punya password |
| | googleId | `varchar("google_id",{length:128}).unique()` | nullable |
| | walletBalanceIdr | `numeric("wallet_balance_idr",{precision:14,scale:4}).notNull().default("0")` | default **string** `"0"` — Drizzle menolak number untuk numeric presisi |
| | unlimitedExpiresAt | `timestamp("unlimited_expires_at",{withTimezone:true})` | TIMESTAMPTZ |
| | hasClaimedTrial | `boolean("has_claimed_trial").notNull().default(false)` | |
| | createdAt | `timestamp("created_at",{withTimezone:true}).notNull().defaultNow()` | |
| `api_keys` | id | uuid defaultRandom PK | |
| | userId | `uuid("user_id").notNull().references(()=>users.id,{onDelete:"cascade"})` | **satu-satunya FK ber-CASCADE** |
| | name | `varchar("name",{length:100}).notNull()` | |
| | keyPrefix | `varchar("key_prefix",{length:16}).notNull()` | |
| | keyHash | `varchar("key_hash",{length:64}).notNull().unique()` | SHA-256 hex = 64 char |
| | spendLimitIdr | `numeric(...,{precision:14,scale:4})` | nullable |
| | spentIdr | `numeric(14,4).notNull().default("0")` | |
| | isActive | `boolean().notNull().default(true)` | |
| | lastUsedAt | `timestamp({withTimezone:true})` | nullable |
| | createdAt | `timestamp({withTimezone:true}).notNull().defaultNow()` | |
| `payment_invoices` | id | `varchar("id",{length:64}).primaryKey()` | **bukan uuid** — `"INV-KTL-20261104-001"` |
| | userId | `uuid().notNull().references(()=>users.id)` | tanpa onDelete (NO ACTION) |
| | planType | `varchar({length:32}).notNull()` | |
| | baseAmountIdr / bonusAmountIdr / totalPayIdr | `integer` (bonus `.default(0)`) | `totalPayIdr` notNull **tanpa default** — Batch 4 wajib mengisi |
| | qrisString | `text().notNull()` | |
| | providerRef | `varchar({length:128}).notNull().unique()` | |
| | status | `varchar({length:24}).notNull().default("PENDING")` | |
| | paidAt | `timestamp({withTimezone:true})` | nullable |
| | expiresAt | `timestamp({withTimezone:true}).notNull()` | |
| | createdAt | `timestamp({withTimezone:true}).notNull().defaultNow()` | |
| `usage_logs` | id | `bigserial("id",{mode:"number"}).primaryKey()` | `bigserial` didukung langsung (terverifikasi); jangan pakai `generatedAlwaysAsIdentity()` |
| | userId | `uuid().notNull().references(()=>users.id)` | |
| | apiKeyId | `uuid().notNull().references(()=>apiKeys.id)` | |
| | modelId | `varchar({length:100}).notNull()` | |
| | poolTier | `varchar({length:24}).notNull()` | |
| | upstreamProvider | `varchar({length:32}).notNull()` | |
| | promptTokens / completionTokens | `integer().notNull()` | |
| | costChargedIdr | `numeric("cost_charged_idr",{precision:12,scale:6}).notNull()` | **presisi 12,6 — BUKAN 14,4** |
| | latencyMs / httpStatus | `integer().notNull()` | |
| | createdAt | `timestamp({withTimezone:true}).notNull().defaultNow()` | |

### Keputusan pemetaan (JANGAN "diperbaiki")
1. **Jangan tambahkan index di luar DDL.** Index `usage_logs(user_id, created_at)` dll. adalah pekerjaan Batch 2/3.
2. **Jangan override nama constraint.** Biarkan `users_email_unique`, `api_keys_key_hash_unique` — nama ini *load-bearing*: `auth.service.ts` memeriksa `constraint_name === "users_email_unique"` untuk memetakan error 23505 → HTTP 400.
3. **`numeric` → `string` saat runtime** (terverifikasi: `"0.0000"`). Jebakan integrasi #1: semua konversi WAJIB lewat `apps/api/src/db/money.ts` (`toIdr(value: string | number): number`). Batch 3/4 akan menabrak ini.

Runtime terverifikasi: `created_at` → objek `Date`; `id` → string UUID.

Migrasi: `bun run db:generate` → commit `apps/api/drizzle/0000_*.sql` + `meta/`; `bun run db:migrate` (jalur wajib, transaksional, terverifikasi end-to-end). `db:push` ada untuk dev cepat, bukan jalur utama.

## 3. Kontrak autentikasi

### 3.1 Password
- `@node-rs/argon2@2.2.2`, `Algorithm.Argon2id`, params OWASP: `{ memoryCost: 19456, timeCost: 2, parallelism: 1 }`. Hash berawalan `$argon2id$v=19$m=19456,t=2,p=1$` (terverifikasi).
- Validasi `min(8).max(72)` — batas 72 wajib (anti-DoS hashing).
- **JANGAN** pakai `Bun.password.hash()` — dua dokumen secara eksplisit menyebut Argon2id via library; API runtime menyimpang dari spec dan menyulitkan audit.

### 3.2 Sesi: JWT di cookie HttpOnly
- `hono/jwt` HS256, cookie bernama `katalis_session`.
- **Jebakan #4 (terbukti):** `verify()` dari `hono/jwt` MELEMPAR `JwtAlgorithmRequired` bila opsi `alg` tidak diberikan → panggil `await verify(token, secret, "HS256")`. Ini runtime throw, `tsc` tetap exit 0 — karena itu masuk kasus tes (8 & 10).
- Cookie: `httpOnly: true`, `sameSite: "Lax"`, `path: "/"`, `maxAge: 604800` (7 hari). `secure` **false di dev/test**, di-toggle via env `COOKIE_SECURE` (kalau hardcode `true`, cookie tak terkirim di `http://localhost` → tes login hijau-palsu).
- `createApp` harus **sudah** membaca `CORS_ORIGINS` dari env sejak Batch 1 (dipakai Batch 5; Vite dev server beda port).
- CSRF: `SameSite=Lax` cukup untuk Batch 1. **Jangan** tambahkan `hono/csrf` sekarang.

### 3.3 Endpoint (amplop error OpenAI `{error:{message,type,param,code}}` — bahkan untuk `/api/*`)

| Method | Path | Body | Sukses | Error |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{email,password}` | `201 {id,email}` | `400 EMAIL_TAKEN` (23505 pada `users_email_unique`); `400 VALIDATION_ERROR` |
| POST | `/api/auth/login` | `{email,password}` | `200 {id,email,wallet_balance_idr,unlimited_expires_at}` + `Set-Cookie` | `401 INVALID_CREDENTIALS` |
| POST | `/api/auth/logout` | — | `200 {ok:true}` + cookie `Max-Age=0` | — |
| GET | `/api/auth/session` | cookie | `200 {id,email,wallet_balance_idr,unlimited_expires_at}` | `401 UNAUTHENTICATED` |
| GET | `/api/health` | — | `200 {status:"ok",db:"up",redis:"up"}` | `503` bila DB/Redis mati |

Aturan wajib:
- **Anti-enumeration:** email tak dikenal dan password salah → respons **identik** (`401 INVALID_CREDENTIALS`). Jangan `404 USER_NOT_FOUND`.
- **`password_hash` tidak boleh keluar** dari `auth.service.ts`; route hanya mengembalikan field whitelist eksplisit. Jangan return baris Drizzle mentah.
- **Google OAuth di luar cakupan Batch 1** — kolom ada, rute tidak.
- **Registrasi race-safe:** INSERT langsung, tangkap `23505` + cek `constraint_name === "users_email_unique"` (TOCTOU `SELECT`-lalu-`INSERT` = tes lolos palsu).
- `zValidator` + `zod@4.6.7` terverifikasi kompatibel; amplop error kustom via hook argumen ketiga.

### 3.4 Redis di Batch 1
`db/redis.ts` HANYA membuat klien + `pingRedis()`. Tanpa cache API key / Lua / DECRBYFLOAT (Batch 2/3). `/api/health` menguji Redis **sungguhan**. Pilihan klien: **`ioredis`** (terverifikasi GET + INCRBYFLOAT terhadap Redis 7.0.15); `Bun.redis` ada tapi eksperimental — catat sebagai jalur mundur.

## 4. Urutan implementasi TDD (untuk `backend-developer`)

Setiap langkah: **RED → verifikasi gagal → GREEN → `bun test` hijau → REFACTOR.**

**Langkah 0 — Scaffolding (tanpa tes)**
Tulis `package.json` root, `bunfig.toml`, `tsconfig.json`, `.gitignore`, `.env`, `.env.test`, `.env.example`, `drizzle.config.ts`, `apps/api/package.json`, `apps/web/package.json` → **`bun install` dari ROOT** (jangan di dalam `apps/api`).
Gerbang: exit 0; `node_modules/.bin/drizzle-kit` & `node_modules/.bin/tsc` ada di root.

**Langkah 1 — Skema + migrasi**
`schema.ts` → `bun run db:generate` → commit file migrasi → `bun run db:migrate` (DATABASE_URL → `katalis_test`).
Gerbang (lampirkan bukti): `psql -h 127.0.0.1 -U katalis -d katalis_test -c "\dt"` menunjukkan 4 tabel; `\d users` persis §6.3.

**Langkah 2 — DB client + env**
`env.ts`, `db/index.ts` (`createDb(url,{max})` → `{client, db}`; **wajib** return `client` agar tes bisa TRUNCATE + end), `db/redis.ts`, `db/money.ts`, `tests/helpers/db.ts` (`resetDb()` + `closeDb()`).

**Langkah 3 — Kerangka app**
`middleware/error-handler.ts`, `app.ts` (`createApp(deps)` factory — BUKAN `const app = new Hono()` tingkat modul), `index.ts` (server Bun `export default { port, fetch }`).
RED: `tests/health.test.ts` → `GET /api/health` = 200.

**Langkah 4 — Auth service (inti TDD)**
RED: `tests/auth.test.ts` kasus:
1. register email baru → `201`, baris `users` ada, hash `$argon2id$`, verify(password) = true
2. `password_hash` TIDAK muncul di body respons
3. register email duplikat → `400`, `error.code === "EMAIL_TAKEN"`
4. email tidak valid / password < 8 → `400 VALIDATION_ERROR`
5. register **dua kali paralel** email sama (`Promise.all`) → tepat satu `201`, satu `400`
6. login benar → `200`, `Set-Cookie` mengandung `HttpOnly` dan `katalis_session`
7. login password salah → `401 INVALID_CREDENTIALS`; email tak dikenal → `401` **body identik**
8. `GET /api/auth/session` tanpa cookie → `401`; dengan cookie hasil login → `200` + email cocok
9. `POST /api/auth/logout` → `200`, cookie `Max-Age=0`
10. cookie di-tamper → `401` (membuktikan `verify(..., "HS256")` dipanggil)
Verifikasi RED: gagal karena `../src/routes/auth` belum ada — **bukan** syntax error.
GREEN: `services/auth.service.ts` → `routes/auth.ts` (kode terkecil yang lulus).

**Langkah 5 — Middleware sesi**
`middleware/session-auth.ts`: `getCookie` → `verify(token, secret, "HS256")` → `c.set("user", {id,email})`. Tes via `auth.test.ts` (jangan duplikasi logika di route).

**Langkah 6 — Frontend scaffold (kosong)**
`apps/web/`: `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/theme.css` (8 variabel CSS `:root` dari `Design.md` §2.1 + `--font-sans`/`--font-mono`). **DILARANG** membuat `pages/`, `components/`, `hooks/`, Chart.js (Batch 5).
Gerbang: `bun run --cwd apps/web build` exit 0.

**Langkah 7 — Gerbang akhir (bukti wajib)**
```bash
bun install
bun run db:generate     # harus "No schema changes" (idempoten)
bun run db:migrate      # terhadap katalis_test
bun test                # root: 0 fail
bun run typecheck       # exit 0
bun run --cwd apps/web build
```

## 5. Batas modul & kepemilikan file

| File | Pemilik | Tanggung jawab |
|---|---|---|
| `package.json` root, `bunfig.toml`, `tsconfig.json`, `drizzle.config.ts`, `.env*`, `.gitignore` | backend-developer (Batch 1) | Konfigurasi workspace & tooling |
| `apps/api/drizzle/**` | backend-developer (Batch 1) | Migrasi `0000`. Batch 2–4 DILARANG menyunting; tambahan skema = migrasi baru `0001`+ |
| `apps/api/src/db/schema.ts` | backend-developer (Batch 1) | Definisi 4 tabel; batch lain hanya MEMBACA |
| `apps/api/src/db/{index,redis,money}.ts` | backend-developer (Batch 1) | Klien DB/Redis + `toIdr` |
| `apps/api/src/{env,app,index}.ts` | backend-developer (Batch 1) | Factory app + entrypoint |
| `apps/api/src/middleware/{error-handler,session-auth}.ts` | backend-developer (Batch 1) | Amplop error + guard JWT |
| `apps/api/src/services/auth.service.ts`, `routes/auth.ts` | backend-developer (Batch 1) | Register/login/verify/mint |
| `apps/api/tests/{preload.ts,helpers/**,auth.test.ts,health.test.ts}` | backend-developer (Batch 1) | Tes Batch 1 |
| `routes/keys.ts`, `middleware/api-key-auth.ts`, `services/key.service.ts`, `tests/keys.test.ts` | Batch 2 | **JANGAN dibuat** |
| `routes/billing.ts`, `webhooks-qris.ts`, `services/qris*.ts`, `tests/qris-webhook.test.ts` | Batch 4 | **JANGAN dibuat** |
| `routes/v1-proxy.ts`, `services/{upstream-router,token-meter}.ts`, `tests/proxy.test.ts` | Batch 3 | **JANGAN dibuat** |
| `apps/web/src/styles/theme.css` | Batch 1 hanya 8 token mentah; kepemilikan penuh → frontend-developer (Batch 5) | Variabel palet |
| `apps/web/src/{pages,components,hooks}/**` | frontend-developer (Batch 5) | **JANGAN disentuh** di Batch 1 |
| `CLAUDE.md`, `Prd.md`, `Design.md`, `Implementation Plan.md` | — | Read-only, dilarang diubah |

**Aturan anti-konflik:** `apps/api/**` = backend-developer; `apps/web/**` = frontend-developer; tes QA di `apps/api/tests/qa/**`. Berkas bersama (package.json root, drizzle.config.ts, .env*) hanya boleh diubah pemilik Batch 1; batch lain yang butuh dependensi **meminta orchestrator**.

## 6. Trade-off & risiko (jebakan)

1. **`bun test` vs Vitest** → impor dari `"vitest"` lolos di keduanya (terbukti). `bun test` meng-shim API Vitest; fitur lanjutan (`vi.mock` kompleks, `test.extend`, snapshot) belum terverifikasi → tes Batch 1 pakai API inti saja.
2. **4 tabel sekaligus** → menghindari rebutan nomor migrasi; mitigasi "definisi kolom saja".
3. **`numeric` → string** → `money.ts#toIdr` sebagai satu-satunya jalur konversi; wajib dipakai `auth.ts` saat mengembalikan `wallet_balance_idr`.
4. **`hono/jwt` verify wajib `alg`** → runtime throw yang lolos `tsc`; ditangkap kasus tes 8 & 10.
5. **drizzle-kit di root** → sudah dijelaskan §1.1.
6. **Cookie lintas-origin (Batch 5)** → `createApp` baca `CORS_ORIGINS` sejak sekarang; kalau tidak, login hijau di tes tapi rusak di browser.
7. **Redis client** → `ioredis` dipilih demi stabilitas skrip Lua Batch 3/4.
8. **typecheck root vs web** → root tsconfig HANYA include `apps/api/**` + `drizzle.config.ts`; `apps/web` punya tsconfig sendiri (`types:["vite/client"]`, `lib:["ESNext","DOM"]`). Root `typecheck` = `tsc --noEmit` + `bun run --cwd apps/web typecheck`.
9. **`bun test` menjalankan tes dari seluruh workspace** (api + web) → tes API tidak boleh paralel antar-berkas (saling TRUNCATE). Mitigasi: `createDb(url,{max:1})` + `TRUNCATE ... CASCADE` di `beforeAll`; jangan aktifkan `--parallel`.

## 7. Checklist invariant (konteks Batch 1)

- [x] §5.1 API key hash-only — belum ada key dibuat; kolom NOT NULL UNIQUE memaksa Batch 2 benar.
- [x] §5.2 saldo atomik — belum ada mutasi; `numeric(14,4)` + `toIdr` disiapkan.
- [x] §5.3 webhook HMAC — tabel + `provider_ref UNIQUE` disiapkan untuk idempotensi Batch 4.
- [x] §5.4 format OpenAI — error handler Batch 1 sudah beramplop `{error:{message,type,param,code}}`.
- [x] §5.5 desain — Batch 1 hanya menanam 8 token CSS, tanpa warna tambahan.
- [x] Skema = `Prd.md` §6.3 (perbandingan baris-per-baris, identik).
- [x] Struktur direktori = `CLAUDE.md` §3; `api-key-auth.ts` & `keys.ts` sengaja belum dibuat (Batch 2).
- [x] Berkas target Batch 1 (`Implementation Plan.md` §3) semua ada dengan jalur persis; tambahan (`env.ts`, `app.ts`, `db/redis.ts`, `db/money.ts`, `middleware/*`, `tests/health.test.ts`, `tests/helpers/*`, scaffold web) adalah prasyarat yang dinyatakan eksplisit.
- [x] Tidak ada asumsi tak terverifikasi — semua versi & perilaku diuji di environment ini.
