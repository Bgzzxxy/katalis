# Batch 4 — Integrasi Payment Gateway QRIS & Webhook (rencana `architect`)

> Eksekutor: `backend-developer`. Referensi: `CLAUDE.md` §5.3, `Prd.md` §4 & §6.3, `Implementation Plan.md` §3 BATCH 4. Batasan: detail API gateway pihak-3 = ASUMSI (belum diverifikasi) — terisolasi di adapter.

## 0. Ringkasan
- Pola **adapter provider agnostik** (`qris-provider.ts`); TriPay default (HMAC-SHA256), Midtrans opsional.
- **Webhook tidak memercayai nominal payload** — nominal selalu dibaca dari baris `payment_invoices` kita.
- Idempotensi via `SELECT ... FOR UPDATE` (PG otoritatif); cache `wallet:<userId>` Batch 3 di-DEL setelah commit.
- Tidak ada migrasi baru.

## 1. Kontrak API
| Method | Path | Guard | Sukses | Error |
|---|---|---|---|---|
| POST | `/api/billing/invoices` | sessionAuth | 201 InvoiceView | 400 VALIDATION/TRIAL_ALREADY_CLAIMED/INVALID_PLAN; 502 PAYMENT_GATEWAY_ERROR |
| GET | `/api/billing/invoices/:id/status` | sessionAuth+pemilik | 200 InvoiceStatusView | 401; 404 INVOICE_NOT_FOUND |
| POST | `/api/webhooks/qris` | — (no session) | 200 {ok:true,duplicate?} | 403 INVALID_SIGNATURE; 404; 400 INVALID_PAYLOAD |

Body create: `{plan_type, custom_amount_idr?, coupon_code?}`. PREPAID→custom 5000..1_000_000; UNLIMITED_10D→20000; TRIAL_1D→100. coupon_code DEFER (ditolak 400 bila tak dikenal; tidak ada tabel kupon).

InvoiceView: `{id, plan_type, total_pay_idr, qris_string, status, expires_at}`. StatusView: `{id, plan_type, status, total_pay_idr, paid_at}`.

## 2. Interface provider
```ts
interface QrisProvider {
  providerId: "TRIPAY"|"MIDTRANS";
  createInvoice({merchantRef, amountIdr, planType}): Promise<{qrisString, providerRef, expiresAt?}>;
  verifySignature(headers: Headers, rawBody: string): boolean;
  parseWebhook(rawBody): {providerRef, status:"PAID"|"EXPIRED"|"FAILED"}|null;
}
createQrisProvider(env, fetchImpl?) -> QrisProvider|null;  // null bila env tak dikonfigurasi
```
HMAC: `createHmac("sha256", secret).update(rawBody).digest()` + `crypto.timingSafeEqual` (cek panjang 32 dulu). Secret dari `QRIS_WEBHOOK_SECRET`.

## 3. Data & kredit
- Invoice id: `INV-KTL-<YYYYMMDD>-<5 BASE58>` (varchar 64). `provider_ref` = unique; `expires_at` = gateway atau now+15m.
- Kredit (dari row invoice, BUKAN payload):
  - PREPAID: `wallet_balance_idr += base + bonus`
  - UNLIMITED_10D: `unlimited_expires_at = GREATEST(now(), current) + interval '10 days'`
  - TRIAL_1D: `+ interval '1 day'`
- Klaim TRIAL atomik: `UPDATE users SET has_claimed_trial=true WHERE id=$1 AND has_claimed_trial=false RETURNING id` → gagal = 400 TRIAL_ALREADY_CLAIMED. Gateway gagal → revert.

## 4. Webhook flow (transaksi PG)
```
rawBody = await c.req.text()  // baca sekali
verifySignature gagal → 403
parse gagal → 400
BEGIN
  SELECT * FROM payment_invoices WHERE provider_ref=$1 FOR UPDATE
  tak ada → 404 | PAID → 200 duplicate | EXPIRED/FAILED → 200 tanpa kredit
  PENDING → UPDATE status='PAID', paid_at=NOW() + kredit users (UPDATE aritmetis)
COMMIT
setelah commit: DEL wallet:<userId> (best-effort)
```
Gunakan `db.transaction(async tx => ...)` + `tx.execute(sql`...`)`.

## 5. Interaksi wallet Redis (Batch 3)
- Koordinasi WAJIB: Batch 3 sinkronisasi PG **delta aritmetis** (`wallet_balance_idr = wallet_balance_idr - chargeDelta`), BUKAN overwrite snapshot Redis, agar interleaving kredit+charge komutatif. PG otoritatif; Redis `wallet:<userId>` di-DEL setelah kredit.

## 6. Edit aditif (koordinasi orchestrator)
- `env.ts`: `QRIS_PROVIDER?`, `QRIS_WEBHOOK_SECRET?`, `TRIPAY_API_KEY?`, `TRIPAY_MERCHANT_CODE?`, `MIDTRANS_SERVER_KEY?` (opsional, tak merusak litera AppEnv 6-field).
- `app.ts`: `AppDeps.qris?`; `createQrisProvider` default; mount `/api/billing` + `/api/webhooks`.

## 7. Batas modul
- BARU: `services/qris-provider.ts`, `services/qris.service.ts`, `routes/billing.ts`, `routes/webhooks-qris.ts`, `tests/billing.test.ts`, `tests/qris-webhook.test.ts`, `tests/helpers/qris.ts`.
- EDIT aditif: `env.ts`, `app.ts`; `tests/helpers/redis.ts` (koordinasi, jangan tulis ulang).
- READ ONLY: `db/schema.ts`, `drizzle/**`, `db/{index,money,redis}.ts`, `middleware/*`, `services/{auth,key}.service.ts`, `routes/{auth,keys}.ts`.
- JANGAN disentuh: Batch 3 (`v1-proxy.ts`, `upstream-router.ts`, `token-meter.ts`, `model-catalog.ts`).
- TIDAK dibuat: UI/CSV/telemetri/polling (Batch 5).

## 8. Urutan TDD
1. Koordinasi kontrak wallet (bukan kode B4).
2. RED `tests/helpers/qris.ts` (fake provider + HMAC sign).
3. RED `tests/qris-webhook.test.ts` (module-not-found).
4. Implement `qris-provider.ts` (interface + HMAC; impl TriPay/Midtrans detail tunggu verifikasi dokumen).
5. Implement `qris.service.ts` (transaksi + FOR UPDATE).
6. Implement `routes/webhooks-qris.ts`; edit app/env; GREEN webhook test.
7. RED `tests/billing.test.ts` (404 unmounted).
8. Implement `routes/billing.ts`; edit app; GREEN.
9. Gerbang: `bun test` 0 fail; typecheck; `db:generate` "No schema changes"; psqlbukti PAID+saldo; redis bukti DEL.

Tes inti: webhook 7 kasus (valid PENDING→PAID; duplikat idempoten; invalid sig 403 tak kredit; unknown 404; PREPAID +saldo; UNLIMITED +10d; TRIAL +1d; Promise.all → sekali). billing 8 kasus (PREPAID 201; trial pertama ok kedua 400; plan invalid 400; nominal out-of-range 400; GET status pemilik; isolasi 404; gateway gagal 502+revert trial; format id).

## 9. Risiko
- Detail gateway = ASUMSI (terisolasi adapter; verifikasi dokumen sebelum produksi).
- Replay: HMAC tak cegah replay, tapi state machine DB (PENDING→PAID sekali) menjamin satu kredit.
- Jangan percaya nominal payload.
- Kupon/referral DEFER (tanpa tabel). Nonce tak ditambah (tak diminta).

## 10. Checklist invariant
- [x] §5.3 HMAC + 403 + FOR UPDATE + idempoten + BEGIN/COMMIT.
- [x] §6.3 skema utuh.
- [x] §5.2 kredit transaksi PG.
- [x] §5.4 amplop OpenAI di `/api/*`.
- [x] anti-konflik Batch 3.