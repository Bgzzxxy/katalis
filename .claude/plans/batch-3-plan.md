# Batch 3 — Mesin Proxy OpenAI-Compatible & Router Upstream (rencana `architect`, terverifikasi)

> Eksekutor: `backend-developer`. Referensi: `CLAUDE.md` §1/§3/§4/§5, `Prd.md` §3/§6.3/§7, `Implementation Plan.md` §3 BATCH 3, `.claude/plans/batch-1-plan.md`, `.claude/plans/batch-2-plan.md`.

## 0. Ringkasan keputusan
1. 4 modul produksi baru (`model-catalog.ts`, `upstream-router.ts`, `token-meter.ts`, `v1-proxy.ts`) + edit sempit bertanda tangan pada file Batch 1/2 (`app.ts`, `env.ts`, `db/redis.ts`, `db/money.ts`, `middleware/api-key-auth.ts`).
2. `/v1/*` = passthrough berformat OpenAI; request validasi minimal, diteruskan apa adanya; SSE di-passthrough tanpa buffering; `usage` di-tee untuk metering.
3. Biaya pakai **micro-IDR integer** (anti-drift float, selaras `numeric(12,6)`); potong saldo atomik via **Lua Redis** (`wallet:<userId>` + HASH `apikey:<hash>`); sinkron PG dalam transaksi.
4. Failover **hanya sebelum byte pertama**; setelah streaming mulai tidak ada failover; klien putus → potong proporsional.
5. Tes offline: router menerima `fetchImpl` + `baseUrl` injectable → mock `Bun.serve` lokal; TIDAK ada panggilan upstream berbayar.

## 1. Fakta terverifikasi environment
- `tiktoken`/`gpt-tokenizer` TIDAK terpasang → TIDAK tambah tokenizer; sumber token = `usage` upstream (fallback `chars/4`).
- `ioredis` `EVAL` Lua jalan terhadap Redis 7.0.15.
- `Bun.serve` bisa SSE; pemutusan klien menjalar via `c.req.raw.signal` → dasar potong proporsional.
- `tests/helpers/db.ts` sudah `TRUNCATE ... usage_logs, api_keys, users`.

## 2. Dua celah integrasi yang HARUS ditutup
1. `c.get("apiKey")` belum memuat `keyHash` → tambahkan `keyHash` ke konteks di `api-key-auth.ts` (middleware sudah punya `raw` → `hashApiKey(raw)`; aditif, tak merusak tes 6-field Batch 2).
2. `users.wallet_balance_idr` belum di Redis → kenalkan key `wallet:<userId>` (string desimal IDR), isi lazy `SET ... NX` dari PG.

## 3. Kontrak API
Semua route `/v1/*` di-guard `apiKeyAuth`. Amplop error `{error:{message,type,param,code}}`.

| Method | Path | Sukses | Error |
|---|---|---|---|
| POST | `/v1/chat/completions` | 200 JSON passthrough / 200 SSE (stream) | lihat matriks |
| GET | `/v1/models` | 200 `{object:"list",data:[{id,object:"model",created,owned_by}]}` | 401 |

Request: `{model, messages[], stream?, max_tokens?, temperature?, tools?, stream_options?, ...}`. `model` tidak di katalog → 404 `model_not_found`. `stream:true` → inject `stream_options.include_usage=true`. Override pool via header `X-Katalis-Pool`.

Header streaming: `text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.

Matriks error: 401 `invalid_api_key`; 400 `VALIDATION_ERROR`; 404 `model_not_found`; 402 `insufficient_balance` (wallet<=0); 402 `spend_limit_reached`; 403 `pool_not_available` (LoRA tanpa Unlimited); 429 `flex_window_exceeded`; 502 `upstream_error` (semua gagal → saldo Rp 0).

## 4. Skema / model (TS, tanpa migrasi)
`usage_logs` TIDAK diubah. Data model di `model-catalog.ts`:
- `PoolTier = "LORA"|"STABLE"|"FLEX"`; `ProviderId = "SILICONFLOW"|"DEEPSEEK"|"ZHIPU"|"VOLCENGINE"`.
- `ModelSpec {id, defaultPool, priceInMicroPer1M, priceOutMicroPer1M, routes:[{provider,upstreamModel}], ownedBy}`.
- `ProviderSpec {id, baseUrl, apiKeyEnv}` (env kosong → provider dilewati).

Biaya (micro-IDR integer):
```
costMicro = round((promptTokens*rateIn + completionTokens*rateOut)/1_000_000)
LORA && unlimited → costMicro = round(costMicro*70/100)   // -30%
usage_logs.cost_charged_idr = (costMicro/1e6).toFixed(6) // 6 desimal
walletDelta/spentDelta = round4(costMicro/1e6)           // 4 desimal
```
`db/money.ts` diperluas ADITIF: `toMicroIdr`, `microToIdrString`, `round4Idr`. `toIdr` tidak disentuh.

Redis:
- `wallet:<userId>` (string desimal IDR, `SET NX` dari PG, tanpa TTL).
- `apikey:<hash>` HASH (`spent_idr` via `HINCRBYFLOAT`; `spend_limit_idr` dibaca).
- `flex:<userId>` ZSET (member `<tokens>:<uuid>`, score nowMs, jendela 5 jam).

3 skrip Lua: `precheck` (wallet>0 & spent<limit), `charge` (potong ter-klamp `min(cost,available)`, saldo tak <0), `flexWindow` (prune+sum+add atomik). Retur string (hindari truncation int Lua).

## 5. Batas modul & kepemilikan file
- BARU: `services/model-catalog.ts`, `services/upstream-router.ts`, `services/token-meter.ts`, `routes/v1-proxy.ts`; tests `proxy.test.ts`, `upstream-router.test.ts`, `token-meter.test.ts`, `helpers/upstream-mock.ts`.
- EDIT (aditif): `db/redis.ts` (Lua + wrapper), `db/money.ts` (micro helper), `env.ts` (UPSTREAM_*_, `PROXY_FIRST_BYTE_TIMEOUT_MS`=3000, `FLEX_WINDOW_*`), `app.ts` (`AppDeps.upstream?` + `app.route("/v1", ...)`), `middleware/api-key-auth.ts` (`keyHash`), `tests/helpers/redis.ts` (cleanup `wallet:*`,`flex:*`).
- READ ONLY: `db/schema.ts`, `drizzle/**` ("No schema changes").
- JANGAN dibuat: Batch 4 (`billing.ts`, `webhooks-qris.ts`, `qris*.ts`), Batch 5 (`apps/web`).

## 6. Urutan implementasi TDD
1. Edit `env.ts` + `app.ts` (seam `AppDeps.upstream?`). Gerbang: typecheck + test hijau.
2. RED `tests/helpers/upstream-mock.ts` (Bun.serve: json/sse/503/timeout).
3. RED `tests/upstream-router.test.ts` → implement `model-catalog.ts`+`upstream-router.ts` (sukses primer; 503 → failover; hang>timeout → failover; semua gagal → 502; latency terukur).
4. RED `tests/token-meter.test.ts` → Lua + money helper + `token-meter.ts` (charge eksak; klamp saldo; spend-limit reject; LoRA -30%; paralel 20× ≤ saldo; usage_logs + api_keys.spent_idr/last_used_at sync).
5. RED `tests/proxy.test.ts` → `v1-proxy.ts` + edit `api-key-auth.ts` (keyHash) + mount (401; 404 model; 200 passthrough; SSE byte-identik + usage tee; abort → charge proporsional; semua gagal → 502 & saldo tak berubah).
6. Gerbang akhir: `bun test` 0 fail; `bun run typecheck` exit 0; `bun run db:generate` "No schema changes"; psql/redis bukti; dev smoke `UPSTREAM_SILICONFLOW_BASE_URL=http://127.0.0.1:<mockPort>`.

Strategi tes: `upstream-router` terima `{providers, fetchImpl=globalThis.fetch, firstByteTimeoutMs}`; tes injeksi mock. Tanpa panggilan berbayar.

## 7. Trade-off / risiko
- **Charge-after** (bukan reservasi): pra-cek + klamp jamin saldo tak <0; `shortcut:` burst paralel bisa over-deliver sebelum klamp. Upgrade: reservasi max_tokens.
- **Token dari `usage` upstream**: akurasi bergantung upstream; `include_usage` di-inject utk stream; fallback `chars/4`.
- **Redis gerbang konkurensi, PG durable**: PG gagal pasca-charge → drift kecil; best-effort + log. `shortcut:` jurnal belum ada.
- **2 granularitas desimal** (6 vs 4) → selisih <Rp0.0001, diabaikan.
- **Failover pra-byte** saja. **`cost_charged_idr`** max ~Rp999.999/request.
- **Harga = asumsi bisnis** (butuh sign-off produk).
- Edit lintas-batch murni aditif, mitigasi regresi dengan `bun test` penuh tiap langkah.

## 8. Checklist invariant
- [x] §5.1 raw key tak pernah masuk storage; konteks hanya id/keyHash/userId.
- [x] §5.2 pemotongan atomik Lua, cek spend_limit per key, sinkron PG transaksi.
- [x] §5.4 format OpenAI; failover 5xx/timeout>3000ms pra-byte; semua gagal → 502 & Rp0.
- [x] §5.3 di luar Batch 3 (Batch 4).
- [x] §6.3 skema utuh ("No schema changes").
- [x] struktur file §3.