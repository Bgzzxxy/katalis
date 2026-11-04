# Product Requirements Document (PRD): Katalis AI Gateway

**Versi Dokumen:** 1.0 (MVP Production-Ready Specification)  
**Tanggal:** 4 November 2026  
**Arsitektur Inti:** Member-Centric Account (OAuth/Email) + Custom Hono Proxy (Node.js/Bun) + PostgreSQL + Redis + Dynamic QRIS Webhook  
**Fokus Katalog Model:** Model AI Tiongkok Berbiaya Rendah & Performa Tinggi (DeepSeek, Qwen, GLM, Kimi, Doubao)

## 1. Visi Produk & Identitas Brand

**Katalis** (`katalis.sh` / `katalis.id`) adalah layanan *AI API Gateway* dan *Token Proxy* berbasis akun member yang menyediakan akses terpadu berformat *OpenAI-compatible* (`/v1/chat/completions`) ke model-model AI unggulan asal Tiongkok dengan harga sangat terjangkau dan pembayaran lokal instan via **QRIS**.

| Opsi Nama Brand | Contoh Domain | Karakteristik & Kesan Brand | Status |
| :--- | :--- | :--- | :--- |
| **Katalis** | `katalis.sh` / `katalis.id` | Singkat, teknis, bermakna pemercepat reaksi/proses; terasa profesional untuk tool developer. | **Rekomendasi Utama (Digunakan di PRD)** |
| **ArkaLine** | `arkaline.dev` / `arkaline.id` | Modern, bersih, memiliki nuansa jalur jaringan (*line/relay*) yang serupa dengan [nutaraline GATEWAY](https://nutaraline.co.uk/). | Alternatif 1 |
| **Silika** | `silika.ai` / `silika.id` | Terinspirasi dari *silicon* (komputasi semikonduktor), minimalis, dan sangat cocok dengan palet warna hangat. | Alternatif 2 |
| **NadiProxy** | `nadiproxy.com` | Menonjolkan kecepatan aliran data (*pulse/nadi*) untuk pemantauan telemetri *real-time*. | Alternatif 3 |

### 1.1 Masalah Utama yang Diselesaikan
* **Hambatan Pembayaran Internasional:** Developer dan kreator di Indonesia kesulitan membayar API langsung ke penyedia Tiongkok ([SiliconFlow](https://www.siliconflow.cn/pricing), [DeepSeek API](https://api-docs.deepseek.com/quick_start/pricing/), [Zhipu BigModel](https://bigmodel.cn/pricing)) yang memerlukan kartu kredit internasional atau akun Alipay/WeChat Pay.
* **Fragmentasi Endpoint & API Key:** Mengelola banyak API Key terpisah untuk DeepSeek, Qwen, GLM, dan Kimi di IDE seperti Cursor, Cline, atau Roo Code tidak efisien.
* **Ketidakpastian Biaya Komputasi:** Developer membutuhkan opsi fleksibel antara **Saldo Prabayar (*Pay-as-you-go*)** tanpa masa aktif hangus, **Paket Unlimited 10 Hari** untuk sesi *coding* intensif, serta **Trial 1 Hari (Rp 100)** untuk pengujian awal.

### 1.2 Sasaran & Batasan Cakupan MVP (*Goals & Non-Goals*)

| Sasaran MVP (*In-Scope*) | Batasan di Luar MVP (*Non-Goals / Out-of-Scope*) |
| :--- | :--- |
| Sistem autentikasi member (**Email/Password & Google OAuth**) dengan dukungan pembuatan **banyak API Key (*Multi-Key*)** per akun. | Pelatihan model *fine-tuning* mandiri oleh pengguna di dalam browser. |
| Mesin *Custom Reverse Proxy* berbasis **Hono** yang kompatibel penuh dengan standar SDK OpenAI (`streaming SSE`, `tools`, `vision`). | Aplikasi *chat UI* konsumen penuh seperti ChatGPT Plus (fokus produk adalah API Gateway & Playground teknis). |
| Manajemen 3 *Pool* Kapasitas (**Dedicated LoRA Pool**, **Stable Pool**, **Flex Pool**) beserta kuota bonus harian otomatis. | Pembayaran menggunakan mata uang kripto atau transfer bank manual tanpa verifikasi otomatis. |
| Pembayaran otomatis via **Dynamic QRIS** ([TriPay Developer API](https://tripay.co.id/developer) / [Midtrans QRIS API](https://docs.midtrans.com/reference/qris)) dengan aktivasi saldo/paket instan melalui *webhook*. | Sistem penarikan saldo (*withdrawal*) kembali ke rekening bank pengguna. |

## 2. Sistem Desain Frontend (*Warm Editorial Anti-AI-Slop*)

Seluruh antarmuka web wajib mematuhi spesifikasi warna, tipografi, dan tata letak berikut agar tampil presisi, bersih, dan bebas dari klise visual AI (*anti-AI-slop*).

### 2.1 Token Palet Warna Resmi

| Nama Token | Kode Hex | Variabel CSS / Tailwind | Peruntukan Komponen UI |
| :--- | :--- | :--- | :--- |
| **Background** | `#F0EEE8` | `--bg-canvas` / `bg-[#F0EEE8]` | Latar utama halaman (*viewport canvas*), latar area kode sekunder, dan latar *table header*. |
| **Surface** | `#FAF9F5` | `--bg-surface` / `bg-[#FAF9F5]` | Panel utama, kartu metrik telemetri, tabel katalog model, modal QRIS, dan bilah navigasi. |
| **Primary** | `#282824` | `--text-primary` / `text-[#282824]` | Teks utama, judul halaman, angka metrik utama, serta warna latar tombol aksi primer (`bg-[#282824] text-[#FAF9F5]`). |
| **Accent** | `#B77A45` | `--accent-main` / `text-[#B77A45]` | Sorotan aktif, *badge* paket **Unlimited**, indikator *Dedicated LoRA Pool*, tautan interaktif, dan fokus *input*. |
| **Secondary** | `#77746B` | `--text-secondary` / `text-[#77746B]` | Teks deskripsi sekunder, label kolom tabel, *timestamp* log, dan keterangan satuan (`tok/s`, `req/s`). |
| **Border** | `#DCD8CE` | `--border-hairline` / `border-[#DCD8CE]` | Garis pembatas *hairline* `1px solid` antar panel, baris tabel, *input form*, dan pemisah *sidebar*. |
| **Success** | `#54836A` | `--state-success` / `text-[#54836A]` | Indikator gateway `Terhubung`, status HTTP `200 OK`, verifikasi QRIS lunas, dan grafik *throughput* sehat. |
| **Error** | `#C45E52` | `--state-error` / `text-[#C45E52]` | Status HTTP `401/429/502`, peringatan saldo habis, kegagalan *webhook*, dan tombol cabut (*revoke*) API Key. |

### 2.2 Aturan Ketat Desain (*Strict UI Prohibitions & Ergonomics*)
* **Larangan Visual Klise:** Dilarang menggunakan gradasi ungu/indigo/neon, efek *glassmorphism* berlebihan, atau ikon dekoratif tanpa fungsi di samping judul.
* **Pasangan Tipografi:** Gunakan **Inter** (`13px`–`14px`) untuk seluruh label navigasi dan teks UI, dipadukan dengan **JetBrains Mono** untuk ID model, API Key (`sk-ktl-...`), nominal harga, latensi (`ms`), dan potongan kode.
* **Disiplin Numerik:** Seluruh angka yang berubah secara langsung (jumlah token, *request/detik*, hitung mundur kuota harian, dan tarif tabel) wajib menerapkan properti CSS `font-variant-numeric: tabular-nums` agar kolom angka sejajar vertikal.
* **Empat Status Data Wajib (*4 Mandatory Data States*):** Setiap komponen yang memuat data dari API wajib memiliki tampilan untuk kondisi **Loading** (*skeleton bar* berwarna `#DCD8CE`), **Empty** (penjelasan + tombol aksi langsung seperti `+ Buat API Key Pertama`), **Error** (pesan kode error spesifik + tombol *Retry*), dan **Populated** (data terformat rapi).
* **Navigasi Keyboard-First:** Mendukung pintasan `⌘K` / `Ctrl+K` untuk membuka *Command Palette* (pencarian model cepat, salin ID model, dan lompat antar halaman).

## 3. Strategi Upstream Model AI Tiongkok & Katalog Harga

Untuk mencapai harga jual eceran serendah Rp 9 – Rp 45 per 1 juta token sekaligus menjaga margin laba kotor di atas 50%, sistem menggabungkan empat *upstream* utama:

| Penyedia Upstream | Dokumentasi Resmi | Peran dalam Gateway | Keunggulan Biaya & Teknis |
| :--- | :--- | :--- | :--- |
| **SiliconFlow** | [SiliconFlow Pricing](https://www.siliconflow.com/pricing) | Agregator utama untuk Qwen, GLM, Kimi, Hunyuan, dan varian DeepSeek Distill. | Menyediakan model kecil/menengah gratis atau sangat murah (~$0,07/1M token) dan kompatibel langsung dengan SDK OpenAI. |
| **DeepSeek Official API** | [DeepSeek API Pricing](https://api-docs.deepseek.com/quick_start/pricing/) | Jalur utama (*Direct Upstream*) untuk `deepseek-v4.1-flash` dan `deepseek-v4-pro`. | Tarif *Context Cache Hit* mulai dari $0,003/1M token (~Rp 48/1M token) serta diskon *off-peak* hingga 50%. |
| **Zhipu AI (BigModel)** | [Zhipu BigModel Pricing](https://bigmodel.cn/pricing) | Penyedia langsung untuk keluarga model `glm-5.3-flash` dan `glm-4.6v` (Vision). | Kuota *free-tier* harian besar dan tarif inferensi model *Flash* yang sangat ekonomis untuk *Flex Pool*. |
| **Volcengine Ark** | [Volcengine Ark Pricing](https://docs.volcengine.com/docs/ark/model-pricing?lang=zh) | Jalur cadangan berkapasitas tinggi untuk model Doubao, Kimi, dan DeepSeek. | Memiliki skema *Coding Token Plan* bulanan tetap yang ideal untuk menopang **Paket Unlimited 10 Hari**. |

### 3.1 Klasifikasi Tiga Pool Kapasitas
1. **Dedicated LoRA Pool:** Menggunakan jalur prioritas berlatensi rendah dan mendapatkan potongan tarif **30% lebih murah** bagi member yang memiliki paket **Unlimited 10 Hari** aktif.
2. **Stable Pool:** Jalur inferensi produksi tanpa batas kuota jendela waktu (*no sliding-window cap*), memotong langsung dari Saldo Prabayar atau Kuota Bonus Harian.
3. **Flex Pool:** Jalur ekonomis yang menggunakan *sliding-window rate limit* di Redis (misalnya maksimum X token per 5 jam per akun) untuk menjaga kestabilan biaya *upstream*.

## 4. Arsitektur Pembayaran QRIS Otomatis (Panduan Teknis Lengkap)

Karena Anda baru mengenal integrasi QRIS untuk website, berikut adalah cara kerja **Dynamic QRIS Payment Gateway** secara otomatis tanpa perlu mengecek mutasi rekening secara manual:

### 4.1 Apa Bedanya QRIS Statis vs QRIS Dinamis (API)?
* **QRIS Statis (Stiker Warung):** Pelanggan memindai QR, mengetik sendiri nominalnya, lalu mengirim bukti transfer via WhatsApp. Cara ini **tidak cocok** untuk bisnis API Gateway karena Anda harus mengaktifkan saldo secara manual.
* **QRIS Dinamis via Payment Gateway API (Otomatis 24 Jam):** Saat pengguna mengklik tombol **"Bayar Rp 20.000"** di website Anda, server Anda memanggil API penyedia *payment gateway* ([TriPay](https://tripay.co.id/developer) atau [Midtrans](https://docs.midtrans.com/reference/qris)). Penyedia tersebut mengembalikan **kode gambar QR khusus untuk transaksi itu saja** yang sudah mengunci nominal tepat Rp 20.000. Begitu pengguna memindai dan membayar lewat BCA/GoPay/DANA/OVO/ShopeePay, server *payment gateway* otomatis mengirim sinyal HTTP (`Webhook Callback`) ke server Anda dalam 1–3 detik, dan saldo pengguna langsung bertambah otomatis.

### 4.2 Perbandingan Penyedia Payment Gateway QRIS di Indonesia

| Penyedia | Situs & Dokumentasi | Syarat Pendaftaran | Biaya MDR QRIS per Transaksi | Rekomendasi Penggunaan |
| :--- | :--- | :--- | :--- | :--- |
| **TriPay** | [tripay.co.id/developer](https://tripay.co.id/developer) | **Bisa Perorangan (KTP)** maupun Badan Usaha (PT/CV). | ~0,7% + Rp 750 (bervariasi sesuai tier). | **Sangat Direkomendasikan untuk MVP** karena proses verifikasi akun cepat tanpa wajib membuat PT terlebih dahulu. |
| **Duitku** | [duitku.com](https://www.duitku.com/en/category/information-en/) | Mendukung akun Personal/UMKM & Korporat. | ~0,7% per transaksi QRIS. | Alternatif kuat untuk developer independen dengan dokumentasi *webhook* yang sederhana. |
| **Midtrans** | [docs.midtrans.com](https://docs.midtrans.com/reference/qris) | Umumnya membutuhkan NIB / Badan Usaha untuk fitur QRIS produksi penuh. | Standar Bank Indonesia (~0,7%). | Cocok digunakan saat bisnis sudah berbadan hukum (PT Perorangan / CV) dan membutuhkan simulator sandbox lengkap. |

### 4.3 Alur Data Transaksi QRIS (*End-to-End Flow*)
1. **Inisiasi Checkout:** Member yang sudah login memilih paket (misal: **Unlimited 10 Hari — Rp 20.000** atau **Saldo Prabayar — Rp 50.000**) dan menekan tombol `Buat Tagihan QRIS`.
2. **Pembuatan Invoice:** Backend Hono menyimpan baris baru di tabel `payment_invoices` dengan status `PENDING`, lalu mengirim `POST` ke API [TriPay](https://tripay.co.id/developer) atau [Midtrans](https://docs.midtrans.com/reference/qris) untuk meminta string QRIS.
3. **Render QR di Browser:** Frontend merender string QRIS menjadi gambar QR di atas panel `#FAF9F5` beserta hitung mundur waktu kedaluwarsa (15 menit) dan membuka koneksi *polling* ringan (`GET /api/billing/invoices/:id/status` setiap 3 detik) atau *Server-Sent Events (SSE)*.
4. **Eksekusi Webhook (`POST /api/webhooks/qris`):**
   * Saat pengguna selesai membayar di aplikasi e-wallet/m-banking, server Payment Gateway mengirim *payload* JSON ke endpoint `POST /api/webhooks/qris` milik Anda.
   * Server Hono memverifikasi tanda tangan kriptografi (`HMAC-SHA256` signature) dari header *webhook* agar tidak bisa dipalsukan oleh peretas.
   * Di dalam satu **Transaksi Database Atomik (`BEGIN ... COMMIT`)**, sistem mengubah status invoice menjadi `PAID` dan menambahkan `wallet_balance_idr` atau memperpanjang `unlimited_expires_at` pada akun member tersebut.

## 5. Spesifikasi Fitur & Halaman Aplikasi

### 5.1 Halaman Publik & Workspace Member
1. **Tab Monitor (Publik & Member):**
   * Menampilkan status koneksi gateway (`Terhubung` dengan warna `#54836A`), latensi rata-rata (`ms`), total token diproses sepanjang waktu, jumlah *request/detik*, jumlah API Key aktif, serta hitung mundur *reset* kuota bonus harian (pukul 00:00 WIB).
   * Menampilkan grafik garis *throughput* 60 detik terakhir dan bar persentase beban untuk **Dedicated LoRA Pool**, **Stable Pool**, dan **Flex Pool**.
2. **Tab Katalog Model & Kalkulator (Publik & Member):**
   * Tabel padat berisi daftar model AI Tiongkok, filter berdasarkan *Pool* dan kapabilitas (`Reasoning`, `Vision`, `Tools`), tombol salin ID model sekali klik, sakelar simulasi diskon 30% paket Unlimited, serta kalkulator estimasi biaya token.
3. **Halaman Autentikasi (`/auth/login` & `/auth/register`):**
   * Mendukung masuk dengan **Google OAuth 2.0** atau **Email + Password** (dihash menggunakan `Argon2id`).
4. **Tab Dashboard Akun & Manajemen Multi-API Key (Khusus Member Login):**
   * **Ringkasan Dompet:** Menampilkan sisa Saldo Prabayar (`Rp`), status masa aktif paket **Unlimited 10 Hari**, dan sisa **Kuota Bonus Harian**.
   * **Manajemen Multi-Key:** Member dapat membuat banyak API Key (`sk-ktl-...`), memberi label per Key (misal: `Key Cursor Laptop`, `Key Bot Telegram`), mengatur batas pemakaian maksimal (*monthly/daily spend limit*) per Key, membekukan sementara (*pause*), atau menghapus (*revoke*) Key.
   * **Analitik & Ekspor CSV:** Tabel rincian pemakaian token per model dan per API Key yang dapat diunduh sebagai file `.csv`.
5. **Tab Beli Paket / Top Up QRIS (Khusus Member Login):**
   * Pilihan paket: **Saldo Prabayar** (Rp 5.000 s/d Rp 1.000.000, aktif selamanya), **Unlimited 10 Hari** (Rp 20.000), dan **Trial 1 Hari** (Rp 100, dibatasi 1x klaim per akun terverifikasi).
   * Input kode kupon/referral dengan potongan harga atau bonus saldo otomatis.
6. **Tab Dokumentasi & Live Playground (Publik & Member):**
   * Panduan integrasi cepat untuk Python, JavaScript/TypeScript, cURL, Cursor IDE, Cline, dan Roo Code.
   * *Interactive Playground* untuk menguji pengiriman *prompt* ke model pilihan menggunakan salah satu API Key milik member dan melihat struktur respons JSON beserta waktu latensi.

## 6. Arsitektur Teknis, Struktur Modul & Skema Database

### 6.1 Stack Teknologi (Opsi 2.A)
* **Runtime & Web Framework:** **Bun** atau **Node.js (v22 LTS)** dengan framework **Hono** (sangat cepat untuk *streaming proxy* `Server-Sent Events` dan *overhead* memori minimal).
* **Frontend:** **React 19 + Vite + Tailwind CSS** (menggunakan token palet warna hangat `#F0EEE8` / `#FAF9F5` / `#282824` / `#B77A45`).
* **Database Utama:** **PostgreSQL 16** (dengan Drizzle ORM) untuk menyimpan akun member, daftar API Key, buku besar mutasi saldo (*ledger*), dan log tagihan QRIS.
* **In-Memory Store & Rate Limiter:** **Redis 7** untuk *caching* validasi API Key (`O(1)` lookup < 1ms), penghitung *sliding-window* *Flex Pool*, dan kuota bonus harian.

### 6.2 Batas Modul & Struktur Direktori (*File & Module Boundaries*)

```text
katalis-gateway/
├── apps/
│   ├── web/                          # Frontend React + Tailwind (Warm Editorial UI)
│   │   ├── src/
│   │   │   ├── components/           # Komponen UI (Navbar, MetricCard, QrisModal, CommandPalette)
│   │   │   ├── pages/                # MonitorPage, ModelsPage, KeysDashboardPage, BillingPage, DocsPage
│   │   │   ├── hooks/                # useAuth, useTelemetryStream, useBillingPoll
│   │   │   └── styles/theme.css      # Definisi variabel CSS palet #F0EEE8 - #C45E52
│   └── api/                          # Backend Hono Proxy & Billing Server
│       ├── src/
│       │   ├── index.ts              # Entrypoint server Hono
│       │   ├── routes/
│       │   │   ├── v1-proxy.ts       # Endpoint OpenAI-compatible (/v1/chat/completions, /v1/models)
│       │   │   ├── auth.ts           # Login, Register, Google OAuth callback, Session JWT
│       │   │   ├── keys.ts           # CRUD Multi-API Key (buat, beri nama, limit, revoke)
│       │   │   ├── billing.ts        # Buat invoice QRIS & cek status pembayaran
│       │   │   └── webhooks-qris.ts  # Penerima callback TriPay/Midtrans dengan verifikasi HMAC
│       │   ├── services/
│       │   │   ├── upstream-router.ts# Load balancer & auto-failover (SiliconFlow, DeepSeek, Zhipu)
│       │   │   ├── token-meter.ts    # Penghitung token input/output (tiktoken) & pemotong saldo
│       │   │   └── qris-provider.ts  # Adapter API TriPay / Duitku / Midtrans
│       │   └── db/
│       │       ├── schema.ts         # Skema tabel PostgreSQL (Drizzle ORM)
│       │       └── redis.ts          # Koneksi Redis untuk cache API key & Flex rate-limiter
```

### 6.3 Skema Database Inti (PostgreSQL DDL)

```sql
-- 1. Tabel Akun Member (Keputusan 1.B)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT,
  google_id VARCHAR(128) UNIQUE,
  wallet_balance_idr NUMERIC(14, 4) NOT NULL DEFAULT 0,
  unlimited_expires_at TIMESTAMPTZ,
  has_claimed_trial BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Multi-API Key per Member
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,                 -- Contoh: "Cursor IDE", "Bot Produksi"
  key_prefix VARCHAR(16) NOT NULL,            -- Contoh: "sk-ktl-a9f2..." (untuk ditampilkan di UI)
  key_hash VARCHAR(64) UNIQUE NOT NULL,       -- SHA-256 hash dari key asli untuk keamanan
  spend_limit_idr NUMERIC(14, 4),             -- Opsional: batas maksimum pemakaian saldo per key
  spent_idr NUMERIC(14, 4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabel Tagihan Pembayaran QRIS
CREATE TABLE payment_invoices (
  id VARCHAR(64) PRIMARY KEY,                 -- Contoh: "INV-KTL-20261104-001"
  user_id UUID NOT NULL REFERENCES users(id),
  plan_type VARCHAR(32) NOT NULL,             -- 'PREPAID' | 'UNLIMITED_10D' | 'TRIAL_1D'
  base_amount_idr INTEGER NOT NULL,
  bonus_amount_idr INTEGER NOT NULL DEFAULT 0,
  total_pay_idr INTEGER NOT NULL,
  qris_string TEXT NOT NULL,
  provider_ref VARCHAR(128) UNIQUE NOT NULL,  -- Nomor referensi dari TriPay/Midtrans
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED'
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabel Log Pemakaian Token & Telemetri
CREATE TABLE usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  model_id VARCHAR(100) NOT NULL,
  pool_tier VARCHAR(24) NOT NULL,             -- 'LORA' | 'STABLE' | 'FLEX'
  upstream_provider VARCHAR(32) NOT NULL,     -- 'SILICONFLOW' | 'DEEPSEEK' | 'ZHIPU'
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  cost_charged_idr NUMERIC(12, 6) NOT NULL,
  latency_ms INTEGER NOT NULL,
  http_status INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 7. Penanganan Kondisi Batas & Kegagalan (*Edge Cases & Error Handling*)

| Skenario Kegagalan / Edge Case | Perilaku Sistem yang Dijamin (*Guaranteed Behavior*) |
| :--- | :--- |
| **Upstream Utama Timeout atau Error `502/503`** | `upstream-router.ts` secara transparan mengalihkan (*auto-failover*) *request* ke penyedia cadangan (misal: dari DeepSeek Direct ke SiliconFlow) dalam batas waktu 3 detik. Jika seluruh *upstream* gagal, kembalikan HTTP `502` dan **jangan potong saldo pengguna (`Rp 0`)**. |
| **Koneksi Streaming Terputus di Tengah Jalan** | Jika klien menutup koneksi saat `stream: true` sedang berjalan, server menghitung jumlah *chunk* token yang sudah terkirim hingga titik putus dan memotong biaya secara proporsional. |
| **Webhook QRIS Dikirim Ganda oleh Payment Gateway** | Endpoint `POST /api/webhooks/qris` memeriksa status `payment_invoices` menggunakan kunci `SELECT ... FOR UPDATE`. Jika status sudah `PAID`, kembalikan `200 OK` tanpa menambahkan saldo dua kali (*idempotent*). |
| **Balapan Pemakaian Saldo (*Concurrent Requests Race Condition*)** | Pemeriksaan dan pemotongan saldo menggunakan operasi atomik Redis `DECRBYFLOAT` yang disinkronkan ke PostgreSQL, sehingga pengguna tidak bisa mengirim 50 *request* serentak untuk menghabiskan saldo melebihi Rp 0. |
| **Penyalahgunaan Paket Trial Rp 100** | Paket Trial 1 Hari (Rp 100) hanya dapat dibeli maksimal 1 kali per akun (`has_claimed_trial = TRUE`) dan menerapkan batas wajar (*fair-use cap*) per menit di Redis agar tidak dikuras oleh *script* otomatis. |

## 8. Tahapan Implementasi (*Milestone Roadmap*)

1. **Fase 1 — Pondasi Database & Autentikasi Member (Hari 1–2):**
   * Menyiapkan proyek monorepo (`Hono` + `React` + `PostgreSQL` + `Redis`), migrasi tabel `users` dan `api_keys`, serta alur Login/Register dan CRUD Multi-API Key.
2. **Fase 2 — Mesin Proxy OpenAI-Compatible & Integrasi Upstream Tiongkok (Hari 3–5):**
   * Membangun endpoint `/v1/chat/completions` dan `/v1/models` yang terhubung ke [SiliconFlow](https://www.siliconflow.com/pricing), [DeepSeek API](https://api-docs.deepseek.com/quick_start/pricing/), dan [Zhipu BigModel](https://bigmodel.cn/pricing), lengkap dengan pencatatan token *streaming* dan *rate-limiter* Redis untuk *Flex Pool*.
3. **Fase 3 — Integrasi Pembayaran QRIS & Webhook Otomatis (Hari 6–7):**
   * Menghubungkan adapter [TriPay Developer API](https://tripay.co.id/developer) / [Midtrans QRIS API](https://docs.midtrans.com/reference/qris), membangun halaman *checkout* QRIS, dan menguji keamanan tanda tangan *webhook* HMAC-SHA256.
4. **Fase 4 — Polish UI Palet Editorial Hangat & Pengujian End-to-End (Hari 8–9):**
   * Menerapkan sistem desain `#F0EEE8` / `#FAF9F5` / `#282824` / `#B77A45` di seluruh halaman, memastikan ke-4 status data (*Loading, Empty, Error, Populated*) berjalan mulus, dan melakukan uji beban sebelum *deployment*.
