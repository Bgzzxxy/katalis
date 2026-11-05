# Jebakan, Utang Teknis & Masalah yang Diketahui

Dokumen ini mencatat hal-hal yang **bukan bug langsung** tetapi bisa menyandera agent berikutnya yang bekerja di repo ini. Jangan buang waktu untuk mendiagnosis ulang hal-hal yang sudah tercatat di sini.

---

## 1. `bun test` Tampak "Flaky" — Ini Bukan Flaky, Tapi Kontaminasi DB

**Gejala:** Ketika beberapa proses `bun test` berjalan **bersamaan** (mis. orchestrator + subagent QA sekaligus), muncul puluhan kegagalan palsu. Lalu saat dijalankan sendirian, semuanya hijau.

**Akar masalah:** Semua berkas tes API memakai **satu DB tes `katalis_test` + Redis bersama**, dan setiap berkas memanggil `TRUNCATE ... users/usage_logs/...` di `beforeEach`. Ada juga konflik string global dari Happy DOM (web) yang menimpa Web Fetch primitives saat kedua suite `apps/api` dan `apps/web` dijalankan dalam satu proses.

**Cara menghindari:**
- Jalankan tes API dan web secara terpisah: `bun test apps/api` dan `bun test apps/web/tests`.
- Jalankan root `bun test` hanya saat **tidak ada** proses test lain berjalan (cek `ps -eo args | grep '[b]un test'`).
- Untuk verifikasi terarah yang stabil, jangan paralelkan beberapa run test di terminal yang berbeda.

**Referensi:** `knowledge/README.md` §4; memory `katalis-test-suite-contention`.

---

## 2. Kredensial Produksi Belum Diisi

File `.env` dan `.env.test` **TIDAK boleh di-commit** (sudah di `.gitignore`, hanya `.env.example` yang dilacak). Saat ini `.env` lokal berisi placeholder dev, tetapi **variabel produksi berikut belum diisi**:

| Variabel | Akibat jika kosong |
|---|---|
| `UPSTREAM_<PROVIDER>_BASE_URL` + `..._API_KEY` (SiliconFlow/DeepSeek/Zhipu/Volcengine) | `/v1/chat/completions` → 502 `upstream_error` |
| `TRIPAY_API_KEY` + `TRIPAY_MERCHANT_CODE` | Pembuatan tagihan QRIS → 502 `PAYMENT_GATEWAY_ERROR` |
| `QRIS_WEBHOOK_SECRET` | Webhook verifikasi signature tidak dapat divalidasi (semua webhook dianggap invalid) |

Jangan pernah menulis nilai rahasia nyata ke file yang ter-commit. Gunakan env vars di lingkungan deploy.

---

## 3. Timer Redis Telemetri Belum Di-`unref()`

Di `apps/api/src/services/telemetry.service.ts`, helper `within()` membungkus panggilan `redis.get`/`redis.set` dengan `Promise.race` + `setTimeout(200)`. **Timer ini tidak di-`unref()`**, sehingga setiap request telemetri menahan event loop ~200 ms lebih lama setelah selesai.

**Dampak:** kecil pada server long-running. **Kapan diperbaiki:** saat observabilitas menuntut latency lebih ketat atau banyak request telemetri paralel; cukup `.unref()` pada timer.

---

## 4. Tanpa Kredensial Upstream, `GET /v1/models` Tetap Berfungsi Tapi Tidak Ada Yang Bisa Dichat

`GET /v1/models` mengembalikan daftar 8 model dari `model-catalog.ts` tanpa menghubungi upstream apa pun. Jadi katalog tampil normal, tapi `POST /v1/chat/completions` akan selalu 502 sampai kredensial upstream diisi. Ini bukan bug — ini perilaku yang diharapkan saat infrastruktur upstream belum dikonfigurasi.

---

## 5. FLEX Pool Berbagi Hitungan Token (Bukan per-Key)

FLEX window di Redis (`flex:<userId>`) mengakumulasi token **per user**, bukan per API key. Token dihitung dari estimasi `raw/4 + max_tokens` (bukan token asli yang dikeluarkan upstream). Ini keputusan bisnis tahap 1; kalau nanti perlu per-key atau token asli, `v1-proxy.ts` + `FLEX_WINDOW_LUA` yang diubah.

---

## 6. Katalog Model Frontend vs Backend (Duplikasi Yang Disengaja)

Daftar model + harga ada di DUA tempat:
- `apps/api/src/services/model-catalog.ts` (micro-IDR, sumber kebenaran bisnis)
- `apps/web/src/lib/model-catalog.ts` (IDR/1M, untuk kalkulator & tabel katalog)

Keduanya harus konsisten; `apps/web/tests/qa/pricing-parity.qa.test.ts` mengunci paritas ini. Ada komentar `shortcut:` di kedua file: **update keduanya saat harga berubah**.

---

## 7. `PATCH /api/keys/:id` — Rename Saja, Tanpa Regenerasi Key

Endpoint `PATCH /:id` hanya mengganti nama key (label). Ia **tidak** mengubah hash, prefix, atau nilai rahasia. Kalau nanti user minta "rotate key", itu fitur baru (buat baru + revoke lama), bukan tanggung jawab endpoint ini.

---

## 8. Bonus & Kupon QRIS Belum Diimplementasikan

`apps/api/src/services/qris.service.ts` `planPricing()` selalu mengembalikan `bonus: 0`. Kode promo (`coupon_code`) diterima di schema `POST /api/billing/invoices` tapi langsung ditolak (`INVALID_PLAN`/`badCoupon`) karena belum ada tabel kupon. Jadi tombol promo di UI **sengaja tidak dirender** (sesuai invariant "no dead controls").

---

## 9. Tidak Ada Docker/Reverse-Proxy

Software berjalan dengan `bun` langsung, tanpa containerisasi. Tidak ada `Dockerfile` atau `docker-compose.yml`. Jika ada agent yang mengerjakan deployment, ia harus **membuat sendiri** konfigurasi reverse-proxy yang memenuhi syarat same-origin `/api/*` dan `/v1/*`.

---

## 10. Change Log Singkat untuk Konteks Cepat

Lihat `knowledge/PROGRESS.md` untuk rincian per batch. Yang perlu diingat:
- `cde5fc7`..`1111e4d`: seluruh fungsionalitas (5 batch + redesign v2.1).
- HEAD terakhir `1111e4d` berisi seluruh UI yang aman, teruji, dan responsif.