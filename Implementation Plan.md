# Implementation Plan: Eksekusi Katalis AI Gateway via AI Agents

Dokumen ini adalah panduan teknis operasional untuk mengeksekusi `PRD.md` menggunakan AI coding agents (seperti **Cursor Composer**, **Cline / Roo Code**, atau **Aider**) dengan metodologi **Test-Driven Development (TDD)** dan siklus kerja terisolasi per modul.

---

## 1. Aturan Emas untuk AI Agent (System Prompt / Rules)

Saat memberikan tugas ke AI Agent, sertakan instruksi pembatas berikut di file `.cursorrules` atau prompt awal:

```markdown
1. Selalu ikuti siklus TDD: Buat file tes terlebih dahulu (RED), jalankan dan pastikan gagal karena fungsi belum ada, buat implementasi minimal hingga tes berhasil (GREEN), lalu rapikan kode (REFACTOR).
2. Dilarang mengubah file di luar modul yang sedang dikerjakan pada sub-task aktif.
3. Seluruh endpoint proxy wajib mempertahankan format standar OpenAI SDK (/v1/chat/completions).
4. Penanganan saldo dan token wajib bersifat atomik (gunakan transaksi PostgreSQL atau Redis Lua script untuk mencegah race conditions).
5. Desain UI wajib mematuhi token palet:
   - Background: #F0EEE8
   - Surface: #FAF9F5
   - Primary: #282824
   - Accent: #B77A45
   - Secondary: #77746B
   - Border: #DCD8CE
   - Success: #54836A
   - Error: #C45E52
6. Setiap komponen UI wajib memiliki 4 status data: Loading (skeleton), Empty, Error, dan Populated.
```

---

## 2. Peta Dekomposisi 5 Batch Eksekusi (Sprint Workflow)

Pengerjaan dibagi menjadi 5 Batch berurutan. Jangan meminta AI Agent mengerjakan Batch berikutnya sebelum Batch sebelumnya lolos seluruh pengujian (`0 failing tests`).

```
┌────────────────────────────────────────────────────────┐
│ BATCH 1: Scaffolding, Skema Database & Autentikasi     │
│ - Monorepo Setup (Hono API + React Vite Web)           │
│ - Drizzle ORM PostgreSQL & Redis Client                │
│ - Auth Member (Email/Password & Session)               │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ BATCH 2: Manajemen Multi-API Key & Middleware Auth     │
│ - Hash SHA-256 Key generator (sk-ktl-...)              │
│ - Fast Auth Middleware via Redis Cache (<1ms)          │
│ - CRUD Key & Limit Pengeluaran per Key                 │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ BATCH 3: Mesin Proxy OpenAI-Compatible & Upstream      │
│ - Endpoint /v1/chat/completions (SSE Streaming)        │
│ - Upstream Adapter (SiliconFlow, DeepSeek, Zhipu)      │
│ - Auto-Failover & Token Counter / Metering Saldo       │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ BATCH 4: Integrasi Payment Gateway QRIS & Webhook      │
│ - Adapter TriPay / Duitku / Midtrans QRIS API          │
│ - Webhook Receiver dengan Verifikasi Signature HMAC    │
│ - Transaksi Atomik Penambahan Saldo & Unlimited Plan   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ BATCH 5: Frontend UI (Palet Hangat #F0EEE8) & Telemetri│
│ - Dashboard Monitor & Live Telemetry Chart             │
│ - Katalog Model, Filter Pool, & Kalkulator Token       │
│ - Halaman Member (Manajemen Key & Checkout QRIS)       │
│ - Live API Playground & Command Palette (Ctrl+K)       │
└────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi Detail Per Batch (Prompt Siap Pakai untuk AI Agent)

### BATCH 1: Scaffolding Monorepo, Database PostgreSQL & Autentikasi Member

* **Tujuan:** Menyiapkan struktur proyek, koneksi database Drizzle PostgreSQL + Redis, dan alur pendaftaran member.
* **File Target:**
  * `apps/api/src/db/schema.ts`
  * `apps/api/src/db/index.ts`
  * `apps/api/src/services/auth.service.ts`
  * `apps/api/src/routes/auth.ts`
  * `apps/api/tests/auth.test.ts`
* **Prompt untuk AI Agent:**
  ```text
  Kita akan mengimplementasikan Batch 1 dari PRD.md:
  1. Siapkan skema Drizzle ORM untuk tabel `users` di apps/api/src/db/schema.ts sesuai DDL di PRD.md.
  2. Buat file tes apps/api/tests/auth.test.ts menggunakan Vitest yang menguji:
     - Register user baru dengan email & password (password wajib di-hash menggunakan Argon2id).
     - Validasi email duplikat mengembalikan error 400.
     - Login user mengembalikan JWT session token.
  3. Tulis implementasi minimal di apps/api/src/services/auth.service.ts dan rute Hono di apps/api/src/routes/auth.ts sampai seluruh tes lulus.
  Jalankan perintah: `bun test apps/api/tests/auth.test.ts` dan pastikan exit code 0.
  ```

---

### BATCH 2: Manajemen Multi-API Key & Fast Auth Middleware

* **Tujuan:** Memberikan kemampuan kepada member untuk membuat banyak API Key (`sk-ktl-...`) dan memvalidasi key di Redis dengan latensi `< 1ms`.
* **File Target:**
  * `apps/api/src/services/key.service.ts`
  * `apps/api/src/middleware/api-key-auth.ts`
  * `apps/api/src/routes/keys.ts`
  * `apps/api/tests/keys.test.ts`
* **Prompt untuk AI Agent:**
  ```text
  Kita akan mengimplementasikan Batch 2 dari PRD.md:
  1. Buat file tes apps/api/tests/keys.test.ts yang menguji:
     - Pembuatan API Key baru menghasilkan format string `sk-ktl-<random_base58>`, hanya menyimpan SHA-256 hash di database, dan mengembalikan raw key hanya 1 kali ke user.
     - Simpan metadata key (user_id, balance, is_active, spend_limit) ke Redis key `apikey:<hash>` untuk caching O(1).
     - Middleware api-key-auth.ts memverifikasi header `Authorization: Bearer sk-ktl-...`. Jika valid, pasang user context di Hono. Jika tidak ada / salah, return HTTP 401 JSON OpenAI format.
     - Fungsi revoke / nonaktifkan key langsung menghapus cache di Redis.
  2. Implementasikan kodenya hingga seluruh tes lulus.
  Jalankan perintah: `bun test apps/api/tests/keys.test.ts`.
  ```

---

### BATCH 3: Mesin Proxy OpenAI-Compatible & Router Upstream Tiongkok

* **Tujuan:** Inti proxy yang menerima request `/v1/chat/completions`, meneruskan ke SiliconFlow / DeepSeek, mencatat token, dan auto-failover jika terjadi error.
* **File Target:**
  * `apps/api/src/services/upstream-router.ts`
  * `apps/api/src/services/token-meter.ts`
  * `apps/api/src/routes/v1-proxy.ts`
  * `apps/api/tests/proxy.test.ts`
* **Prompt untuk AI Agent:**
  ```text
  Kita akan mengimplementasikan Batch 3 dari PRD.md:
  1. Buat file tes apps/api/tests/proxy.test.ts yang menguji:
     - Endpoint Hono POST `/v1/chat/completions` yang kompatibel dengan OpenAI SDK.
     - Dukungan parameter `stream: true` menggunakan Server-Sent Events (SSE).
     - Auto-failover: jika upstream utama (misal DeepSeek) timeout / return 502, router otomatis mencoba jalur cadangan di SiliconFlow.
     - Jika seluruh upstream gagal, return 502 dan pastikan wallet_balance_idr user TIDAK terpotong (Rp 0).
     - Jika berhasil, token-meter.ts menghitung total token dan memotong saldo user secara atomik.
  2. Implementasikan kodenya hingga seluruh tes lulus.
  Jalankan perintah: `bun test apps/api/tests/proxy.test.ts`.
  ```

---

### BATCH 4: Integrasi Payment Gateway QRIS & Webhook Signature

* **Tujuan:** Menghubungkan API TriPay / Midtrans untuk membuat invoice QRIS otomatis dan memproses saldo via webhook aman.
* **File Target:**
  * `apps/api/src/services/qris.service.ts`
  * `apps/api/src/routes/billing.ts`
  * `apps/api/src/routes/webhooks.ts`
  * `apps/api/tests/qris-webhook.test.ts`
* **Prompt untuk AI Agent:**
  ```text
  Kita akan mengimplementasikan Batch 4 dari PRD.md:
  1. Buat file tes apps/api/tests/qris-webhook.test.ts yang menguji:
     - Pembuatan tagihan QRIS baru menyimpan record di tabel `payment_invoices` dengan status PENDING dan mengembalikan qris_string.
     - Endpoint POST `/api/webhooks/qris`:
       * Memvalidasi HMAC-SHA256 signature dari header. Jika invalid, tolak dengan HTTP 403.
       * Jika valid, ubah status invoice menjadi PAID dan tambahkan wallet_balance_idr user di dalam transaksi atomik (DB Transaction).
       * Sifat Idempotent: jika webhook yang sama dikirim dua kali untuk invoice yang sudah PAID, return 200 OK tanpa menduplikasi penambahan saldo.
  2. Implementasikan kodenya hingga seluruh tes lulus.
  Jalankan perintah: `bun test apps/api/tests/qris-webhook.test.ts`.
  ```

---

### BATCH 5: Frontend UI dengan Palet Hangat (#F0EEE8) & Antarmuka Member

* **Tujuan:** Membangun antarmuka web modern, cepat, dan rapi sesuai desain editorial di `PRD.md`.
* **File Target:**
  * `apps/web/src/styles/theme.css`
  * `apps/web/src/pages/Monitor.tsx`
  * `apps/web/src/pages/Models.tsx`
  * `apps/web/src/pages/KeysDashboard.tsx`
  * `apps/web/src/components/QrisModal.tsx`
  * `apps/web/src/pages/Playground.tsx`
* **Prompt untuk AI Agent:**
  ```text
  Kita akan mengimplementasikan Batch 5 dari PRD.md:
  1. Pasang token palet warna resmi di Tailwind:
     bg-canvas: #F0EEE8, bg-surface: #FAF9F5, text-primary: #282824,
     accent: #B77A45, text-secondary: #77746B, border-hairline: #DCD8CE,
     state-success: #54836A, state-error: #C45E52.
  2. Bangun halaman:
     - Monitor: Telemetri grafik Chart.js, pool status, dan log request real-time.
     - Models: Tabel katalog 14 model, tombol salin ID, filter pool/vision, dan kalkulator estimasi token.
     - Keys Dashboard: Ringkasan saldo dompet, kuota harian, form buat API key baru, dan list API key dengan spend limit.
     - Modal QRIS: Render QRIS dinamis, hitung mundur 15 menit, dan auto-refresh saat status invoice berubah menjadi PAID.
     - Docs & Playground: Simulator request chat completion interaktif.
  3. Pastikan setiap komponen memiliki 4 status data: Loading (skeleton), Empty, Error, dan Populated.
  Jalankan perintah: `bun run build` di apps/web dan pastikan tidak ada type/lint error.
  ```

---

## 4. Checklist Gate Kesiapan Sebelum Launch (Production Gate)

Sebelum merilis gateway ke publik, verifikasi 6 parameter ini:
- [ ] Seluruh unit & integration test backend lulus (`bun test` -> 0 failed).
- [ ] Build frontend lolos tanpa peringatan tipe (`tsc --noEmit && vite build`).
- [ ] Endpoint `/v1/chat/completions` diuji langsung menggunakan OpenAI Python & Node SDK resmi dengan base URL mengarah ke gateway lokal.
- [ ] Pengujian kegagalan *upstream*: matikan koneksi ke salah satu upstream untuk membuktikan bahwa *auto-failover* berjalan mulus tanpa memotong saldo user.
- [ ] Pengujian keamanan webhook QRIS: simulasi request webhook palsu tanpa signature HMAC tertolak dengan HTTP 403.
- [ ] Halaman web responsif di layar ponsel maupun desktop, dan skema warna `#F0EEE8` / `#FAF9F5` kontras dengan jelas (rasio kontras teks WCAG ≥ 4.5:1).
