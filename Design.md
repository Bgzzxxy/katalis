# DESIGN.md — Sistem Desain & Spesifikasi UI/UX Lengkap (Katalis AI Gateway)

**Versi Dokumen:** 2.1 (Full Production UI/UX & Advanced Editorial-Technical Typography)  
**Gaya Visual:** *Warm Editorial Precision Instrument* (Memadukan ketajaman ruang kerja teknis ala Linear & Raycast dengan keanggunan tipografi cetak editorial ala Anthropic & Stripe Press)  
**Target Implementasi:** React 19 + Vite + Tailwind CSS + Lucide Icons (Fungsional) + Chart.js

## 1. Filosofi Desain & Daftar Larangan Mutlak (*Anti-AI-Slop Ban List*)

Antarmuka **Katalis AI Gateway** dirancang sebagai alat kerja teknis (*developer utility*) berdensitas informasi tinggi dengan sentuhan editorial hangat, bukan *landing page* pemasaran penuh hiasan. Setiap elemen visual wajib memiliki fungsi yang jelas bagi *engineer* yang memantau trafik token, mengelola API Key, atau menguji model AI.

### 1.1 Enam Larangan Visual (*Strict Prohibitions*)
1. **Dilarang Menggunakan Gradasi Ungu, Indigo, Pink, atau Neon:** Jangan pernah menggunakan kelas `bg-gradient-to-r` berwarna mencolok pada tombol, teks judul, tepi kartu, maupun latar belakang halaman.
2. **Dilarang Menambahkan Ikon Dekoratif Tanpa Fungsi (*Icon Spam*):** Jangan menaruh ikon *Sparkles*, *Rocket*, *Bot*, *Brain*, atau *Zap* di samping judul bagian atau label tombol hanya untuk mengisi ruang. Gunakan ikon secara hemat murni untuk penanda fungsi (salin ke *clipboard*, cari, filter, tutup modal, unduh CSV, cabut akses).
3. **Dilarang Memasang Banner Hero Marketing di Halaman Kerja:** Saat pengguna membuka aplikasi, tampilkan langsung ruang kerja **Monitor Telemetri & Status Pool** yang fungsional. Jangan menaruh *hero banner* besar bertuliskan slogan promosi di bagian atas aplikasi.
4. **Dilarang Membuat Kartu Raksasa yang Boros Ruang (*Bloated Card Grids*):** Jangan membungkus informasi singkat ke dalam kartu besar dengan `rounded-3xl shadow-2xl p-8`. Gunakan panel padat berbatas garis *hairline* `1px solid #DCD8CE` dengan `padding` terukur (`12px`–`16px`) serta tabel baris rapat.
5. **Dilarang Menggunakan Efek Glassmorphism Berlebihan atau Bola Cahaya Kabur:** Jangan menaruh lingkaran warna kabur (*blurred neon blobs*) di belakang kanvas. Pemisahan hierarki visual dilakukan murni melalui kontras bidang antara latar `#F0EEE8` dan permukaan panel `#FAF9F5`.
6. **Dilarang Menampilkan Elemen UI Palsu (*No Dead Controls*):** Jangan menampilkan lonceng notifikasi mati, kolom pencarian yang tidak berfungsi, atau lencana metrik karangan. Setiap tombol, *tab*, sakelar, dan *input* wajib terhubung ke *state* nyata.

## 2. Arsitektur Warna & Token Semantik

Seluruh komponen aplikasi wajib dikunci pada **8 token warna inti** berikut beserta turunan transparansinya untuk menjaga konsistensi visual dan keterbacaan standar aksesibilitas **WCAG AA / AAA**:

| Token Semantik | Kode Hex | Peran Visual & Pemetaan Komponen UI | Kontras terhadap `#FAF9F5` |
| :--- | :--- | :--- | :--- |
| **Background** | `#F0EEE8` | Latar belakang utama halaman (*viewport canvas*), latar baris kepala tabel (`thead`), latar *chip* kode *inline*, latar *input form* pasif, serta warna bar *skeleton loading*. | — |
| **Surface** | `#FAF9F5` | Permukaan kartu metrik, kontainer tabel katalog model, bilah navigasi atas (*header*), panel *sidebar* dokumentasi, serta kartu modal QRIS dan *Command Palette*. | — |
| **Primary** | `#282824` | Teks judul utama, teks isi tabel, angka metrik utama (KPI), latar tombol aksi primer (`bg-[#282824] text-[#FAF9F5]`), serta latar blok terminal/kode gelap. | **13.8 : 1** (WCAG AAA) |
| **Accent** | `#B77A45` | Aksen utama: indikator *tab* aktif, lencana **Dedicated LoRA Pool**, lencana **Paket Unlimited**, penanda harga diskon, tautan teks interaktif, dan cincin fokus *input* (`focus:border-[#B77A45]`). | **4.6 : 1** (WCAG AA) |
| **Secondary** | `#77746B` | Teks deskripsi sekunder, label kolom kepala tabel, keterangan satuan (`tok/s`, `req/s`, `ms`), *timestamp* log transaksi, dan teks *placeholder* pada *input*. | **4.7 : 1** (WCAG AA) |
| **Border** | `#DCD8CE` | Garis pembatas *hairline* `1px solid` antar panel, pemisah baris tabel (`divide-[#DCD8CE]`), garis tepi *input form*, dan garis kisi grafik (*chart grid lines*). | — |
| **Success** | `#54836A` | Indikator status gateway `Terhubung`, kode HTTP `200 OK`, lencana **Stable Pool** sehat, status tagihan QRIS `PAID / LUNAS`, serta garis utama grafik *throughput* token. | **4.5 : 1** (WCAG AA) |
| **Error** | `#C45E52` | Kode HTTP `401/402/429/502`, peringatan saldo habis (`Rp 0`), pesan validasi *input* gagal, indikator *upstream* gangguan, serta tombol cabut (*Revoke*) API Key. | **4.6 : 1** (WCAG AA) |

## 3. Sistem Tipografi Kelas Editorial & Teknis (*3-Tier Font Architecture*)

Karena palet warna aplikasi menggunakan nuansa kertas hangat (`#F0EEE8` & `#FAF9F5`) dan tinta arang (`#282824`), penggunaan satu font *sans-serif* biasa akan terasa datar. Sistem tipografi Katalis menggabungkan **tiga keluarga font dengan peran yang terpisah secara ketat**:

### 3.1 Arsitektur Tiga Font (*Tri-Font Pairing*)

| Peran Tipografi | Nama Font (Google Fonts) | Variabel CSS / Kelas Tailwind | Karakteristik & Aturan Penggunaan |
| :--- | :--- | :--- | :--- |
| **1. Display & Editorial Serif** | **`Newsreader`** (atau `Instrument Serif`) | `--font-serif` / `font-serif` | Digunakan **hanya** untuk Judul Utama Halaman (H1), Judul Artikel Dokumentasi (`/docs`), dan Nama Paket Layanan (`Saldo Prabayar`, `Unlimited 10 Hari`). Memberikan kesan hangat, cerdas, dan khas estetika riset AI modern. |
| **2. Functional UI Sans** | **`Inter`** (dengan fitur OpenType `cv02, cv03, cv04, cv11`) | `--font-sans` / `font-sans` | Digunakan untuk navigasi, tombol, label formulir, deskripsi, pesan status, dan nama model di dalam tabel. Fitur `cv02–cv11` wajib aktif agar huruf `I`, `l`, dan angka `1` memiliki kait pembeda yang jelas. |
| **3. Technical & Data Mono** | **`JetBrains Mono`** (dengan `zero` & `ss01`) | `--font-mono` / `font-mono` | Wajib digunakan untuk seluruh ID model (`deepseek-v4.1-flash`), API Key (`sk-ktl-...`), endpoint URL, angka metrik KPI, harga Rupiah, latensi (`ms`), *timestamp*, pintasan keyboard (`⌘K`), dan blok kode. |

### 3.2 Snippet Import Google Fonts (`apps/web/index.html`)

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;1,6..72,400&display=swap"
  rel="stylesheet"
/>
```

### 3.3 Skala Ukuran Teks, Line-Height & Letter-Spacing (*Type Scale Matrix*)

| Elemen UI | Font Family | Ukuran (`font-size`) | Line-Height | Bobot (`weight`) | Letter-Spacing (`tracking`) | Kelas Utilitas Standar |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Editorial Page Title (H1)** | `Newsreader` | `22px` (`1.375rem`) | `28px` (`1.27`) | `500` (Medium) | `-0.015em` | `font-serif text-[22px] leading-7 font-medium tracking-[-0.015em] text-primary` |
| **Docs Article Heading** | `Newsreader` | `18px` (`1.125rem`) | `26px` (`1.44`) | `500` (Medium) | `-0.01em` | `font-serif text-lg font-medium tracking-tight text-primary` |
| **Card / Section Title (H2)** | `JetBrains Mono` | `11px` (`0.6875rem`) | `16px` (`1.45`) | `600` (SemiBold) | `+0.06em` (`UPPERCASE`) | `font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary` |
| **Hero KPI Metric (Angka Besar)** | `JetBrains Mono` | `22px` (`1.375rem`) | `28px` (`1.27`) | `600` (SemiBold) | `-0.02em` | `font-mono text-[22px] leading-7 font-semibold tracking-tight tabular-nums text-primary` |
| **Body Copy (Docs & Deskripsi)** | `Inter` | `14px` (`0.875rem`) | `22px` (`1.57`) | `400` (Regular) | `0em` | `font-sans text-sm leading-[22px] text-primary max-w-[65ch]` |
| **Dense UI & Table Cell** | `Inter` | `13px` (`0.8125rem`) | `18px` (`1.38`) | `400` / `500` | `-0.005em` | `font-sans text-[13px] leading-[18px] text-primary` |
| **Table Column Header (TH)** | `JetBrains Mono` | `11px` (`0.6875rem`) | `16px` (`1.45`) | `500` (Medium) | `+0.05em` (`UPPERCASE`) | `font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary` |
| **Code Block & JSON Payload** | `JetBrains Mono` | `12px` (`0.75rem`) | `20px` (`1.66`) | `400` (Regular) | `0em` | `font-mono text-xs leading-5` |
| **Micro Badge & Shortcut (`kbd`)** | `JetBrains Mono` | `10px`–`11px` | `14px` (`1.27`) | `500` (Medium) | `+0.02em` | `font-mono text-[10px] leading-[14px] font-medium px-1.5 py-0.5 rounded` |

### 3.4 Lima Aturan Mikro-Tipografi (*Micro-Typography Craft*)

1. **Anatomi Penulisan Mata Uang & Satuan (*Split-Weight Currency Formatting*):**
   * Saat menampilkan harga atau saldo, jangan menulis `Rp 64.250` dengan bobot dan warna yang rata. Pisahkan simbol mata uang/satuan dengan warna sekunder `#77746B` dan ukuran lebih kecil agar mata pengguna langsung menangkap nilai angkanya:
   * *Contoh Markup:*
     ```html
     <span class="font-mono tabular-nums">
       <span class="text-xs font-normal text-secondary mr-1">Rp</span>
       <span class="text-[22px] font-semibold text-primary">64.250</span>
     </span>
     ```
2. **Disiplin Angka Sejajar (`tabular-nums` & `slashed-zero`):**
   * Seluruh angka yang berubah setiap detik (total token, `req/s`, hitung mundur `00:00 WIB`, timer QRIS `14:59`) dan seluruh kolom angka di dalam tabel wajib menggunakan `font-variant-numeric: tabular-nums slashed-zero`. Hal ini mencegah efek teks bergetar (*horizontal jitter*) saat angka berubah dari `1` (sempit) ke `8` (lebar).
3. **Batas Lebar Baris Bacaan (*Optimal Line Measure `60ch–68ch`*):**
   * Paragraf teks penjelasan di halaman **Docs**, deskripsi kartu, dan instruksi pembayaran dilarang melebar mengikuti lebar layar penuh (`1280px`). Kunci lebar paragraf menggunakan `max-w-[65ch]` agar mata pembaca tidak lelah berpindah baris.
4. **Keseimbangan Pemenggalan Baris (`text-balance` & `text-pretty`):**
   * Terapkan `text-balance` (`text-wrap: balance`) pada seluruh judul `H1`/`H2` dan judul kartu kosong (*Empty State*) agar baris kedua tidak menyisakan satu kata yatim (*orphan word*).
   * Terapkan `text-pretty` (`text-wrap: pretty`) pada seluruh deskripsi kartu paket dan pesan bantuan.
5. **Kontras Hirarki di Dalam Baris Tabel:**
   * Di dalam satu baris tabel, bedakan bobot teks secara tegas: **Nama Model** menggunakan `font-sans font-medium text-primary` (`#282824`), **ID Model** menggunakan kapsul `font-mono text-xs bg-canvas border border-border`, **Angka Konteks** menggunakan `font-mono text-xs text-secondary` (`#77746B`), dan **Harga Akhir** menggunakan `font-mono text-xs font-semibold text-primary` (atau `text-accent` `#B77A45` jika sedang diskon).

### 3.5 Konfigurasi Lengkap `theme.css` & `tailwind.config.js`

```css
/* apps/web/src/styles/theme.css */
:root {
  --bg-canvas: #F0EEE8;
  --bg-surface: #FAF9F5;
  --text-primary: #282824;
  --accent-main: #B77A45;
  --text-secondary: #77746B;
  --border-hairline: #DCD8CE;
  --state-success: #54836A;
  --state-error: #C45E52;

  --accent-bg-subtle: rgba(183, 122, 69, 0.12);
  --accent-border-subtle: rgba(183, 122, 69, 0.32);
  --success-bg-subtle: rgba(84, 131, 106, 0.12);
  --success-border-subtle: rgba(84, 131, 106, 0.32);
  --error-bg-subtle: rgba(196, 94, 82, 0.12);
  --error-border-subtle: rgba(196, 94, 82, 0.32);
}

body {
  background-color: var(--bg-canvas);
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

h1, .font-editorial {
  font-family: 'Newsreader', Georgia, serif;
  text-wrap: balance;
}

.font-mono, code, pre, kbd {
  font-family: 'JetBrains Mono', monospace;
  font-variant-ligatures: none; /* Matikan ligatur di ID model & API Key agar mudah dibaca karakter per karakter */
}

.tabular-nums {
  font-variant-numeric: tabular-nums slashed-zero;
}
```

```javascript
// apps/web/tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F0EEE8",
        surface: "#FAF9F5",
        primary: "#282824",
        accent: "#B77A45",
        secondary: "#77746B",
        border: "#DCD8CE",
        success: "#54836A",
        error: "#C45E52",
      },
      fontFamily: {
        serif: ["Newsreader", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "4px",
        md: "6px",
        lg: "8px",
      },
    },
  },
  plugins: [],
};
```

## 4. Tata Letak Ruang & Ergonomi Navigasi (*Spatial Ergonomics*)

### 4.1 Grid, Spacing & Pembatas Bidang
* **Kontainer Utama:** `max-w-7xl mx-auto px-4 sm:px-6 py-6` dengan jarak vertikal antar-seksi `space-y-6` (`24px`) dan jarak antar-kartu dalam grid `gap-3` atau `gap-4` (`12px`–`16px`).
* **Prinsip Hairline Surface:** Setiap panel kerja menggunakan latar `bg-surface` (`#FAF9F5`) di atas kanvas `bg-canvas` (`#F0EEE8`) yang dipisahkan oleh garis `border border-border` (`1px solid #DCD8CE`) tanpa *drop shadow*. Bayangan (`shadow-xl`) hanya diizinkan pada elemen melayang (*floating overlays*) yaitu **Modal Checkout QRIS**, **Modal Pembuatan API Key**, **Command Palette (`⌘K`)**, dan **Toast Notification**.

### 4.2 Struktur Header Navigasi Atas (`Sticky Top Bar`)
Header memiliki tinggi tetap `56px` (`h-14`), menempel di bagian atas (`sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-border`), dan terbagi menjadi 3 zona:

1. **Zona Kiri (Identitas & Status Gateway):**
   * Kotak monogram `KT` (`w-7 h-7 rounded bg-primary text-surface font-mono font-bold text-xs flex items-center justify-center`).
   * Teks brand `katalis` (`font-serif font-semibold text-base tracking-tight text-primary`) + lencana `GATEWAY` (`font-mono text-[10px] px-1.5 py-0.5 rounded bg-canvas border border-border text-secondary`).
   * Indikator status *real-time*: titik berdenyut hijau (`bg-success`) + teks `Terhubung` (`text-success text-xs font-medium`) + latensi rata-rata `18ms` (`font-mono text-xs text-secondary tabular-nums`).
2. **Zona Tengah (5 Tab Ruang Kerja Utama):**
   * `Monitor` — Telemetri trafik *live*, grafik *throughput*, dan status beban 3 *Pool*.
   * `Model (14+)` — Katalog model AI Tiongkok, filter protokol/pool, dan kalkulator biaya.
   * `Beli / Top Up` — Pembelian Paket Prabayar, Unlimited 10 Hari, dan Trial Rp 100 via QRIS.
   * `Dashboard Key` — Manajemen saldo member, kuota harian, pembuatan Multi-API Key, dan ekspor CSV.
   * `Docs & Playground` — Panduan SDK (OpenAI & Anthropic `/v1/messages`) dan penguji endpoint interaktif.
   * *Gaya Tab Aktif:* `bg-primary text-surface font-medium px-3 py-1.5 rounded text-xs`.
   * *Gaya Tab Pasif:* `text-secondary hover:text-primary hover:bg-canvas px-3 py-1.5 rounded text-xs transition-colors`.
3. **Zona Kanan (Aksi Cepat & Status Akun Member):**
   * Tombol pemicu pencarian cepat: `Cari model...` dengan lencana `<kbd>⌘K</kbd>`.
   * Tombol salin endpoint sekali klik: `BASE: https://katalis.sh/v1` (`font-mono text-xs bg-canvas border border-border px-2.5 py-1 rounded hover:border-accent`).
   * Lencana Akun Member: Jika sudah login, tampilkan sisa saldo dompet (`Rp 64.250` dalam `font-mono text-xs text-success font-semibold`) + menu profil singkat; jika belum login, tampilkan tombol `Masuk / Daftar` (`bg-accent text-surface text-xs font-medium px-3 py-1.5 rounded`).

## 5. Spesifikasi Anatomi Komponen Per Halaman

### 5.1 Halaman 1: Monitor (Real-Time Gateway Telemetry)
1. **Bilah Kontrol Atas:** Judul `Real-time Gateway Telemetry` (`font-serif text-[22px]`), lencana `ONLINE · 99.94% SLA` (`text-success bg-[rgba(84,131,106,0.12)] border border-[rgba(84,131,106,0.32)]`), serta tombol jeda/lanjutkan *stream* (`Live Stream: Aktif`).
2. **Empat Kartu KPI Padat (`grid-cols-2 lg:grid-cols-4 gap-3`):**
   * *Total Token Diproses* (angka utama `font-mono text-[22px] tabular-nums` + rincian hari ini & `tok/s` berwarna `#54836A`).
   * *Total Request API* (angka utama + `req/s` & rasio sukses `99.8%`).
   * *Active API Keys Online* (jumlah kunci aktif + rincian pengguna *Unlimited* vs *Pay-as-you-go*).
   * *Reset Kuota Bonus Harian* (hitung mundur `HH:MM:SS` menuju `00:00 WIB` berwarna `#B77A45`).
3. **Grid Utama (`grid-cols-1 lg:grid-cols-3 gap-4`):**
   * **Panel Grafik Throughput (2 Kolom):** Menggunakan `Chart.js` di dalam wadah `<div class="relative h-64 w-full">` dengan `maintainAspectRatio: false`. Garis data menggunakan `#54836A` (Token/s) atau `#B77A45` (Req/s), garis kisi `#DCD8CE`, dan label sumbu `JetBrains Mono` `#77746B`.
   * **Panel Status 3-Pool Kapasitas (1 Kolom):** Menampilkan 3 kartu sub-panel berlatar `#F0EEE8` untuk **Dedicated LoRA Pool** (bar progres `#B77A45`), **Stable Pool** (bar progres `#54836A`), dan **Flex Pool** (bar progres `#77746B` / `#B77A45`), lengkap dengan persentase beban *upstream*.
4. **Grid Bawah (`grid-cols-1 lg:grid-cols-2 gap-4`):**
   * **Daftar 5 Model Aktivitas Tertinggi:** Menampilkan nama model, lencana *Pool*, persentase pangsa trafik (`% share`), dan tarif ringkas.
   * **Tabel Log Transaksi Proxy Terbaru:** Menampilkan 7–10 transaksi terakhir (`WAKTU`, `MODEL ID`, `TOKEN IN/OUT`, `LATENCY`, `STATUS 200/429`) dengan filter cepat `ALL`, `200 OK`, dan `429 LIMIT`.

### 5.2 Halaman 2: Katalog Model & Kalkulator Biaya
1. **Bilah Filter & Pencarian:**
   * Input pencarian teks (`placeholder="Cari model (mis. deepseek-flash, qwen3.8, glm-5.3, vision)..."`) dengan fokus `focus:border-accent`.
   * Tombol filter kategori: `Semua`, `Dedicated LoRA`, `Stable Pool`, `Flex Pool`, `Mendukung Vision`, dan `Anthropic /v1/messages Ready`.
   * Sakelar (*Toggle Switch*) **Simulasi Diskon Paket Unlimited (-30% LoRA)**: Saat aktif, latar sakelar berubah menjadi `#B77A45` dan seluruh tarif model LoRA di tabel langsung menampilkan harga diskon 30%.
2. **Tabel Katalog Model Berdensitas Tinggi:**
   * Kolom: `NAMA MODEL & POOL`, `ID MODEL (KLIK SALIN)`, `PROTOKOL & FITUR`, `CONTEXT / MAX OUT`, `INPUT / 1M`, `OUTPUT / 1M`, `CACHE HIT / 1M`, dan `AKSI`.
   * Setiap sel `ID MODEL` adalah tombol kapsul `font-mono text-xs bg-canvas border border-border hover:border-accent px-2 py-1 rounded` yang langsung menyalin ID model saat diklik.
   * Tampilkan lencana protokol `OpenAI` dan `Anthropic` agar pengguna **Claude Code** dan **Cline** tahu model mana yang mendukung `/v1/messages` secara *native*.
3. **Panel Kalkulator Simulasi Biaya Token:**
   * Terletak di bawah tabel: pengguna memilih model dari *dropdown*, memasukkan estimasi juta token *Input*, *Output*, dan persentase *Cache Hit* (default `75%`), lalu sistem menampilkan estimasi biaya langsung dalam Rupiah (`Rp`) di dalam kotak berlatar `#F0EEE8`.

### 5.3 Halaman 3: Beli Paket / Top Up QRIS Dinamis
1. **Pemilihan Paket Layanan (`grid-cols-1 md:grid-cols-3 gap-3`):**
   * Nama paket menggunakan `font-serif text-lg font-medium text-primary` agar tampil elegan dan kontras dengan angka harga `font-mono`.
   * **Saldo Prabayar (*Pay-as-you-go*):** Nominal `Rp 5.000` hingga `Rp 1.000.000` (pilihan tombol cepat `Rp 10.000`, `Rp 25.000`, `Rp 50.000`, `Rp 100.000`, `Rp 250.000` + input angka kustom). Saldo aktif selamanya tanpa masa hangus.
   * **Unlimited 10 Hari (`Rp 20.000`):** Dilengkapi lencana `POPULER` (`bg-[rgba(183,122,69,0.12)] text-accent border border-[rgba(183,122,69,0.32)]`). Memberikan akses tanpa batas token pada model *Unlimited* + diskon 30% di *Dedicated LoRA Pool*.
   * **Trial 1 Hari (`Rp 100`):** Paket uji coba 24 jam (dibatasi 1x klaim per akun member terverifikasi).
2. **Input Kode Promo / Referral:**
   * Kolom input `font-mono uppercase` + tombol `Terapkan Kode`. Menampilkan pesan umpan balik tepat di bawah input (`✓ Kode aktif: Bonus +10% saldo prabayar` berwarna `#54836A` atau `✕ Kode tidak ditemukan` berwarna `#C45E52`).
3. **Panel Ringkasan Tagihan & Generator QRIS Dinamis:**
   * Menampilkan rincian: Paket Dipilih, Nominal Dasar, Bonus Saldo, Biaya/Kode Unik QRIS, dan **Total Bayar (`Rp`)**.
   * Saat tombol `Buat Kode QRIS Sekarang` (`bg-primary text-surface`) diklik, tampilkan kotak QRIS berbingkai `border-border` dengan nomor referensi invoice (`INV-KTL-...`), hitung mundur kedaluwarsa `15:00` (`text-accent font-mono tabular-nums`), dan indikator status *polling* otomatis (`Menunggu Pembayaran...` yang langsung berubah menjadi panel hijau `#54836A` `Pembayaran Terverifikasi!` saat *webhook* masuk).

### 5.4 Halaman 4: Dashboard Akun Member & Manajemen Multi-API Key
1. **Tiga Kartu Ringkasan Dompet Member:**
   * **Sisa Saldo Prabayar:** Angka `Rp` dengan format *split-weight* (`Rp` kecil `#77746B` + angka besar `#54836A`) + tombol pintas `+ Top Up Saldo`.
   * **Status Paket Aktif:** Lencana status (`UNLIMITED 10 HARI` atau `PAY-AS-YOU-GO`) beserta tanggal berakhir masa aktif.
   * **Kuota Bonus Harian Gratis:** Bar progres horizontal `#54836A` di atas latar `#F0EEE8` yang menampilkan sisa token gratis hari ini (misal: `1.440.000 / 2.000.000 token gratis`).
2. **Manajemen Multi-API Key (Keputusan Arsitektur 1.B):**
   * Header tabel dengan tombol `+ Buat API Key Baru` (`bg-primary text-surface text-xs font-semibold px-3 py-1.5 rounded`).
   * Tabel daftar API Key milik member dengan kolom:
     * `LABEL KEY` (misal: `Cursor Laptop`, `Cline Project A`, `Bot Produksi`).
     * `PREFIX KEY` (`sk-ktl-8f92...` — dengan `font-variant-ligatures: none`).
     * `PEMAKAIAN / BATAS LIMIT` (contoh: `Rp 12.400 / Rp 50.000` dengan bar progres kecil; mendukung pengaturan batas pengeluaran bulanan per Key).
     * `TERAKHIR DIGUNAKAN` (`2 menit lalu` atau `Belum pernah`).
     * `STATUS` (`Aktif` berwarna `#54836A` atau `Dibekukan` berwarna `#77746B`).
     * `AKSI`: Tombol `Atur Limit`, `Jeda/Aktifkan`, dan `Revoke` (`text-error hover:underline`).
3. **Modal "Simpan API Key Baru Anda" (Hanya Muncul 1 Kali):**
   * Saat member membuat Key baru, tampilkan modal dengan peringatan tegas berlatar `rgba(183, 122, 69, 0.12)` dan tepi `#B77A45`: *"Salin dan simpan API Key ini sekarang. Demi keamanan (penyimpanan hash SHA-256), kunci lengkap tidak akan pernah ditampilkan lagi setelah Anda menutup jendela ini."*
4. **Tabel Riwayat Pemakaian Token per Model & Ekspor CSV:**
   * Merinci pemakaian per model (`MODEL ID`, `SUMBER KEY`, `REQUEST`, `INPUT TOKEN`, `CACHED TOKEN`, `OUTPUT TOKEN`, `BIAYA RP`) lengkap dengan tombol `Unduh CSV`.

### 5.5 Halaman 5: Dokumentasi & Live API Playground (Split-Pane)
1. **Navigasi Kiri (`220px` pada Desktop):**
   * `1. Mulai Cepat & SDK` (Contoh kode Python, JS/TS, dan cURL).
   * `2. Integrasi Claude Code (/v1/messages)` (Panduan khusus mengatur `ANTHROPIC_BASE_URL=https://katalis.sh/anthropic`, `ANTHROPIC_AUTH_TOKEN=sk-ktl-...`, dan `"CLAUDE_CODE_ATTRIBUTION_HEADER": "0"` agar *prompt caching* hemat 90%).
   * `3. Konfigurasi Cursor, Cline & Roo Code` (Panduan *OpenAI-Compatible* Base URL `https://katalis.sh/v1`).
   * `4. Live API Playground` (Penguji request interaktif langsung dari browser).
   * `5. Kode Kendala (Error Codes)` (Referensi HTTP `401`, `402`, `429`, `502`).
2. **Panel Kerja Kanan (`flex-1`):**
   * Paragraf penjelasan dibatasi `max-w-[65ch]` dengan judul seksi memakai `Newsreader` (`font-serif`).
   * Blok kode menggunakan latar `#282824` dan teks `#FAF9F5` dengan tombol `Salin Kode` di sudut kanan atas. Setiap contoh kode otomatis menyuntikkan pilihan model dan prefix key member.
   * Pada tab **Live API Playground**, pengguna dapat memilih protokol (`OpenAI /v1/chat/completions` atau `Anthropic /v1/messages`), memilih model target, memilih API Key milik mereka, mengetik *prompt*, dan menekan `Kirim Request POST →` untuk melihat respons JSON, latensi (`ms`), rincian `cached_tokens`, serta estimasi potongan biaya secara langsung.

## 6. Matriks Empat Status Data Wajib (*4 Mandatory Data States*)

Setiap komponen yang memuat data dari backend Hono wajib memiliki implementasi visual untuk keempat kondisi berikut:

| Status Data | Aturan Visual & Komponen yang Ditampilkan |
| :--- | :--- |
| **1. Loading** | Tampilkan kerangka baris (*skeleton rows*) dengan ukuran geometri yang identik dengan tabel/kartu asli menggunakan blok `bg-canvas animate-pulse` di atas panel `bg-surface`. Dilarang membiarkan layar berkedip kosong atau bergeser (*layout shift*). |
| **2. Empty** | Tampilkan kontainer berbatas garis putus-putus `border border-dashed border-border p-8 text-center` dengan judul jelas (`font-serif text-lg text-balance`), penjelasan singkat berwarna `#77746B`, dan satu tombol aksi primer (`+ Buat API Key Pertama Anda`). |
| **3. Error** | Tampilkan kotak peringatan berlatar `bg-[rgba(196,94,82,0.10)] border border-error p-4 rounded-md` yang memuat kode error teknis dalam `font-mono text-error` (contoh: `ERROR 402 · INSUFFICIENT_WALLET_BALANCE`), pesan penyebab yang jujur, dan tombol solusi langsung (`Top Up Saldo via QRIS →` atau `Coba Lagi`). |
| **4. Populated** | Tampilkan data secara utuh dengan pemotongan teks panjang (`truncate`) yang dilengkapi `title` *tooltip*, perataan kanan untuk seluruh kolom numerik (`text-right font-mono tabular-nums`), serta umpan balik *toast* instan di sudut kanan bawah (`bg-primary text-surface border border-border`) setiap kali aksi berhasil dilakukan. |

## 7. Checklist Audit UI/UX Sebelum Rilis (*Frontend Verification Gate*)

Sebelum agen menyatakan pekerjaan frontend selesai, pastikan seluruh poin berikut terpenuhi:
* Tidak ada satu pun kelas warna Tailwind bawaan seperti `bg-indigo-*`, `bg-purple-*`, `bg-blue-*`, atau `bg-slate-*` yang bocor ke dalam kode komponen; seluruh warna menggunakan token `canvas`, `surface`, `primary`, `accent`, `secondary`, `border`, `success`, dan `error`.
* Ketiga keluarga font (`Newsreader` untuk judul editorial, `Inter` dengan `cv02–cv11` untuk UI, dan `JetBrains Mono` dengan `tabular-nums slashed-zero` serta `font-variant-ligatures: none` untuk data teknis) terpasang dan diterapkan sesuai perannya.
* Pintasan keyboard `⌘K` / `Ctrl+K` berfungsi membuka *Command Palette* dari halaman mana saja, dan tombol `Escape` menutup seluruh modal yang sedang terbuka.
* Grafik `Chart.js` di halaman **Monitor** dibungkus di dalam kontainer bertinggi tetap (`h-64`) dengan `maintainAspectRatio: false` sehingga ukuran kanvas tidak memanjang tanpa batas saat ukuran jendela diubah.
* Tampilan responsif telah diuji pada lebar layar ponsel (`375px`), tablet (`768px`), dan desktop (`1280px+`) tanpa ada tabel yang merusak lebar halaman utama (*gunakan `overflow-x-auto` pada pembungkus tabel*).
