# Batch 2 — Rencana Implementasi (disusun `architect`, terverifikasi sebagian di environment ini)

> Status: **APPROVED — menunggu eksekusi** (orchestrator berhenti atas permintaan user). Eksekutor: `backend-developer`. Referensi: `CLAUDE.md` (Bagian 2 §3, §5), `Prd.md` §6.3, `Implementation Plan.md` §3 (BATCH 2).

## 0. Ringkasan keputusan

1. 3 file produksi baru (`services/key.service.ts`, `middleware/api-key-auth.ts`, `routes/keys.ts`), 2 file tes (`tests/keys.test.ts`, `tests/api-key-auth.test.ts`), 1 helper tes (`tests/helpers/redis.ts`), + SATU edit integrasi `app.ts` (mount `/api/keys`).
2. Tabel `api_keys` TIDAK diubah (sudah identik `Prd.md` §6.3 di migrasi 0000).
3. API key `sk-ktl-<32 base58>` via CSPRNG `node:crypto` (tanpa dependensi baru); `key_hash` = SHA-256 hex raw key (64 char); `key_prefix` = 16 char pertama.
4. Fast auth = Redis **HASH** `apikey:<hash>` (bukan JSON) untuk forward-compat atomik Batch 3; fallback Postgres saat miss.
5. Spend limit TIDAK di-enforce di Batch 2 (milik Batch 3); struktur disiapkan.
6. Rate limiting login/register **DEFER** (ke hardening pass terpisah).

## 1. Kontrak API

Semua route di-guard `sessionAuth` (cookie `katalis_session`), konteks `c.get("user")` = `{id, email}`. Error amplop OpenAI.

| Method | Path | Body | Sukses | Error |
|---|---|---|---|---|
| POST | `/api/keys` | `{ "name"?: string }` (opsional, 1–100, default "API Key") | `201 {id,name,key_prefix,key,created_at}` — `key` raw HANYA di sini | `400`, `401` |
| GET | `/api/keys` | — | `200 KeyView[]` | `401` |
| PATCH | `/api/keys/:id` | `{name}` | `200 KeyView` | `400/401/404 KEY_NOT_FOUND` |
| PUT | `/api/keys/:id/spend-limit` | `{spend_limit_idr: number\|null}` | `200 KeyView` | `400/401/404` |
| POST | `/api/keys/:id/pause` | — | `200 KeyView` (idempoten) | `401/404` |
| POST | `/api/keys/:id/resume` | — | `200 KeyView` (idempoten) | `401/404` |
| DELETE | `/api/keys/:id` | — | `200 {id,deleted:true}` | `401/404` |

`KeyView` (snake_case): `{id, name, key_prefix, spend_limit_idr, spent_idr, is_active, last_used_at, created_at}`. `key`/`key_hash` TIDAK PERNAH muncul.

Middleware `api-key-auth.ts` (untuk proxy `/v1/*` Batch 3): header `Authorization: Bearer sk-ktl-<32 base58>`; `c.set("apiKey", {id, userId, keyPrefix, isActive, spendLimitIdr, spentIdr})`; error 401 `invalid_api_key` identik untuk semua kasus (anti-enumeration).

Zod: name `.trim().min(1).max(100)`; spend limit `union([number.min(0).max(9999999999.9999), null])`; path `:id` validasi UUID → invalid = `404` (bukan 500).

## 2. Format & derivasi key

- Alphabet base58 Bitcoin (58 char, tanpa `0OIl`).
- Raw: `"sk-ktl-" + 32 char` (total 39); `key_prefix = raw.slice(0,16)` = `"sk-ktl-" + 9 char`.
- `key_hash = createHash("sha256").update(raw).digest("hex")` (64 char).
- Entropi ≈ 187 bit; `crypto.randomInt(58)` = CSPRNG (terverifikasi berjalan di Bun).
- Raw key hanya dari memori, tidak pernah DB/Redis/log.

## 3. Redis key design

- Nama: `apikey:<sha256_hex>`; tipe: **HASH** (field-level atomic untuk Batch 3).
- Field (semua string): `id`, `user_id`, `key_prefix`, `is_active` ("1"/"0"), `spend_limit_idr` ("" bila null | "50000"), `spent_idr` ("0.0000").
- TTL 300 detik; explicit invalidation primer (`DEL`); write-through atomic `multi().hset().expire().exec()`.
- Alur: parse→fast reject format → `HGETALL` → miss → PG `WHERE key_hash` → encode+cache (inactive tetap di-cache) → tidak-dikenal 401 TANPA cache → `is_active!=="1"` 401.
- Resiliensi: Redis down → fallback PG; PG down saat miss → 500 (bukan 401 palsu).
- Risiko stale dibatasi TTL 300s; `last_used_at` TIDAK ditulis di hot path (handoff ke token-meter Batch 3).
- Handoff Batch 3: HASH jadi tempat `HINCRBYFLOAT`/Lua cek saldo + limit.

## 4. Batas modul & kepemilikan file

| File | Pemilik | Catatan |
|---|---|---|
| `services/key.service.ts` | backend-developer B2 | generate/hash/parse; CRUD; cache |
| `middleware/api-key-auth.ts` | backend-developer B2 | Bearer parse; HASH→PG fallback; context |
| `routes/keys.ts` | backend-developer B2 | route `/api/keys` + zod + sessionAuth |
| `tests/keys.test.ts`, `tests/api-key-auth.test.ts`, `tests/helpers/redis.ts` | backend-developer B2 | tes |
| `apps/api/src/app.ts` | Batch 1 — SATU edit B2 (mount keys) | import + `app.route("/api/keys", ...)` |
| `db/schema.ts`, `drizzle/**` | Batch 1 — READ ONLY | `db:generate` harus "No schema changes" |
| `db/{index,redis,money}.ts`, `middleware/{error-handler,session-auth}.ts`, `services/auth.service.ts`, `routes/auth.ts` | Batch 1 — READ ONLY (import) | dipakai ulang |
| `routes/v1-proxy.ts`, `upstream-router.ts`, `token-meter.ts` | Batch 3 | JANGAN dibuat |
| `routes/billing.ts`, `webhooks-qris.ts`, `qris*.ts` | Batch 4 | JANGAN dibuat |
| `middleware/rate-limit.ts` | Hardening pass | JANGAN dibuat B2 |

## 5. Urutan implementasi (TDD)

1. `tests/helpers/redis.ts` — `clearApiKeyCache(redis)` target `apikey:*` (bukan FLUSHDB — dev/test share Redis).
2. RED `api-key-auth.test.ts` (mini Hono app `use(apiKeyAuth(db,redis))` karena `/v1-proxy.ts` milik B3); gagal = module-not-found.
3. Implement `key.service.ts`.
4. Implement `middleware/api-key-auth.ts` → GREEN.
5. RED `keys.test.ts` via `createApp` (gagal karena route belum di-mount = 404).
6. Implement `routes/keys.ts`; edit `app.ts`. GREEN.
7. Gerbang akhir: `bun test` (root) 0 fail; `bun run typecheck` exit 0; `bun run db:generate` "No schema changes"; `redis-cli HGETALL apikey:<hash>` 6 field; `psql SELECT key_prefix,length(key_hash) ...` membuktikan hash 64 char & raw tidak ada.

Daftar tes inti `keys.test.ts` (8) & `api-key-auth.test.ts` (7): lihat rancangan arsitektur lengkap (create 201 format key, hash 64≠raw, list isolasi antar-user, rename 404 uniform, spend-limit, pause/resume idempoten+DEL, revoke hapus row+DEL+401, guard 401; cache hit/miss/repopulat, 401 identik, inactive, unknown tidak cache, Redis-down fallback).

## 6. Trade-off & risiko

- HASH vs JSON: HASH untuk forward-compat atomik Batch 3.
- TTL 300s: satu fallback PG per 5 menit per hot key, dapat diabaikan.
- Cache inactive: 401 berulang O(1), aman karena pause/resume DEL.
- Revoke DEL best-effort: stale max 300s, diterima.
- Redis shared dev/test: helper WAJIB cleanup `apikey:*` bukan FLUSHALL.
- UUID invalid → 404 (bukan 500 22P02).
- Kolisi hash ~2^-256: 23505 → 500 (sangat langka, jangan return raw).
- `node:crypto` cukup (tanpa dependensi baru).

## 7. Checklist invariant

- [x] §5.1 hash-only (raw hanya sekali).
- [x] §5.2 saldo atomik (Batch 2 hanya menyiapkan struktur).
- [x] §5.4 format OpenAI (AppError → amplop).
- [x] Skema `Prd.md` §6.3 tidak berubah.
- [x] Struktur file sesuai `CLAUDE.md` §3.