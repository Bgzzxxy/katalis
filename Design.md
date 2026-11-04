# DESIGN.md — Spesifikasi Sistem Desain & Panduan UI/UX Katalis AI Gateway

Dokumen ini mendefinisikan sistem desain visual, arsitektur warna, tipografi, tata letak ruang (*spatial ergonomics*), dan aturan komponen untuk frontend **Katalis AI Gateway**. Seluruh tampilan dirancang sebagai **instrumen teknis berpresisi tinggi dengan nuansa kertas editorial hangat (*Warm Editorial Precision*)**—menggabungkan kepadatan informasi ala Linear/Raycast dengan kenyamanan baca dokumen cetak.

## 1. Prinsip Utama & Daftar Larangan Visual (*Anti-AI-Slop Ban List*)

Untuk menjaga identitas visual tetap tajam, dewasa, dan kredibel di mata developer, aturan larangan berikut berlaku mutlak di seluruh halaman aplikasi:

* **Dilarang Menggunakan Gradasi Ungu/Indigo/Pink/Neon:** Jangan pernah menerapkan `bg-gradient-to-r` berwarna mencolok pada tombol, teks judul, maupun latar belakang.
* **Dilarang Menambahkan Ikon Dekoratif Tanpa Fungsi:** Jangan menaruh ikon seperti *Sparkles*, *Rocket*, *Bot*, atau *Zap* di sebelah judul bagian. Gunakan ikon secara minimalis hanya untuk penanda aksi fungsional (salin, tutup, cari, filter, ekspor).
* **Dilarang Memasang Banner Hero Marketing di Halaman Kerja:** Halaman utama aplikasi langsung membuka dasbor telemetri **Monitor** yang fungsional, bukan *landing page* promosi penuh jargon.
* **Dilarang Membuat Kartu Raksasa yang Boros Ruang:** Hindari membungkus 2 baris teks di dalam kartu besar dengan `rounded-3xl shadow-2xl p-8`. Gunakan panel padat berbatas garis *hairline* `1px solid #DCD8CE` dengan `padding` terukur (`12px`–`16px`) dan tabel berdensitas tinggi.
* **Dilarang Menggunakan Glassmorphism Berlebihan atau Blob Mengambang:** Jangan menaruh lingkaran warna kabur (*blurred blobs*) di belakang layar. Gunakan pemisahan bidang murni antara latar `#F0EEE8` dan permukaan panel `#FAF9F5`.
* **Dilarang Menampilkan Angka atau Tombol Palsu:** Setiap tombol, *tab*, filter, dan *input* wajib memiliki fungsi nyata yang merespons interaksi pengguna.

## 2. Arsitektur Warna & Token Semantik

Seluruh elemen antarmuka hanya diperbolehkan menggunakan 8 token warna inti berikut beserta turunan transparansinya:

| Token Semantik | Kode Hex | Peran Visual & Penggunaan Komponen | Rasio Kontras (vs `#FAF9F5`) |
| :--- | :--- | :--- | :--- |
| **Background** | `#F0EEE8` | Latar belakang utama halaman (*viewport canvas*), latar baris *header* tabel, latar blok kode *inline*, dan latar *skeleton loading*. | — |
| **Surface** | `#FAF9F5` | Permukaan panel utama, kartu metrik telemetri, kontainer tabel katalog model, bilah navigasi atas, dan modal QRIS. | — |
| **Primary** | `#282824` | Teks judul, teks isi utama, angka metrik utama, serta warna latar tombol aksi utama (`bg-[#282824] text-[#FAF9F5]`). | **13.8 : 1** (WCAG AAA) |
| **Accent** | `#B77A45` | Aksen utama: indikator *tab* aktif, *badge* **Dedicated LoRA Pool** & **Paket Unlimited**, tautan teks interaktif, dan cincin fokus *input*. | **4.6 : 1** (WCAG AA) |
| **Secondary** | `#77746B` | Teks deskripsi pendukung, label kolom tabel, satuan metrik (`tok/s`, `ms`), *timestamp*, dan teks *placeholder*. | **4.7 : 1** (WCAG AA) |
| **Border** | `#DCD8CE` | Garis pembatas *hairline* `1px solid` antar panel, pemisah baris tabel, tepi *input form*, dan kisi grafik (*chart grid*). | — |
| **Success** | `#54836A` | Status koneksi `Terhubung`, kode HTTP `200 OK`, indikator *Stable Pool* sehat, konfirmasi QRIS `PAID`, dan garis grafik utama. | **4.5 : 1** (WCAG AA) |
| **Error** | `#C45E52` | Kode HTTP `401/402/502`, peringatan saldo Rp 0, validasi *input* gagal, dan tombol cabut (*revoke*) API Key. | **4.6 : 1** (WCAG AA) |

### 2.1 Konfigurasi Variabel CSS & Tailwind (`apps/web/src/styles/theme.css`)

```css
:root {
  --bg-canvas: #F0EEE8;
  --bg-surface: #FAF9F5;
  --text-primary: #282824;
  --accent-main: #B77A45;
  --text-secondary: #77746B;
  --border-hairline: #DCD8CE;
  --state-success: #54836A;
  --state-error: #C45E52;

  /* Turunan Transparansi untuk Badge & Hover */
  --accent-subtle: rgba(183, 122, 69, 0.12);
  --accent-border: rgba(183, 122, 69, 0.30);
  --success-subtle: rgba(84, 131, 106, 0.12);
  --success-border: rgba(84, 131, 106, 0.30);
  --error-subtle: rgba(196, 94, 82, 0.12);
  --error-border: rgba(196, 94, 82, 0.30);
}
```

### 2.2 Aturan Warna untuk Blok Kode & Terminal JSON
* Gunakan latar `#282824` dengan teks `#FAF9F5`, komentar kode berwarna `#77746B`, *string/key* berwarna `#B77A45`, dan nilai berhasil berwarna `#54836A` agar tetap100% berada di dalam keluarga palet yang sama tanpa meminjam warna hitam pekat asing.

## 3. Tipografi & Disiplin Numerik

### 3.1 Pasangan Font (*Dual-Font Pairing*)
1. **UI & Narasi (`--font-sans`):** `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
   * Digunakan untuk navigasi, judul panel, deskripsi fitur, label tombol, dan instruksi pembayaran.
2. **Teknis & Numerik (`--font-mono`):** `'JetBrains Mono', monospace`
   * Digunakan untuk ID model (`deepseek-v4.1-flash`), API Key (`sk-ktl-...`), nominal Rupiah (`Rp 25.000`), latensi (`19ms`), kode status HTTP (`200 OK`), tabel log, serta contoh kode integrasi.

### 3.2 Skala Ukuran Teks & Ketebalan (*Type Hierarchy*)

| Elemen UI | Ukuran (`font-size`) | Ketebalan (`font-weight`) | Line Height | Aturan Tambahan |
| :--- | :--- | :--- | :--- | :--- |
| **Judul Halaman (H1)** | `16px` (`text-base`) | `600` (SemiBold) | `24px` | Warna `#282824`, `letter-spacing: -0.01em`. |
| **Judul Panel / Seksi (H2)** | `11px` (`text-[11px]`) | `600` (SemiBold) | `16px` | `UPPERCASE`, `letter-spacing: 0.05em`, warna `#77746B`. |
| **Angka Metrik Utama (KPI)** | `20px` (`text-xl`) | `600` (SemiBold) | `28px` | Wajib `font-mono` + `tabular-nums`, warna `#282824`. |
| **Teks Isi & Baris Tabel** | `13px` (`text-[13px]`) | `400` / `500` | `20px` | Kepadatan tinggi agar seluruh kolom tabel muat tanpa *scroll* berlebih. |
| **Label Kolom Tabel (TH)** | `11px` (`text-[11px]`) | `500` (Medium) | `16px` | Wajib `font-mono`, `UPPERCASE`, warna `#77746B`, latar `#F0EEE8`. |
| **Badge & Shortcut (`kbd`)** | `10px`–`11px` | `500` (Medium) | `14px` | Wajib `font-mono`, `padding: 2px 6px`, `border-radius: 4px`. |

### 3.3 Disiplin Angka Sejajar (*Tabular Numerals*)
Seluruh elemen yang menampilkan angka dinamis (total token, *request/detik*, sisa waktu kuota harian, harga input/output per 1M token, dan sisa saldo Rupiah) **wajib** memiliki kelas `.tabular-nums` (`font-variant-numeric: tabular-nums`) agar digit angka tidak bergeser kiri-kanan saat diperbarui secara *real-time*.

## 4. Tata Letak Ruang & Ergonomi Komponen (*Spatial Ergonomics*)

### 4.1 Struktur Kanvas & Grid
* **Lebar Kontainer Maksimum:** `max-width: 1280px` (`max-w-7xl`) di tengah layar dengan `padding` horizontal `16px` (mobile) hingga `24px` (desktop).
* **Radius Sudut (*Border Radius*):** Gunakan sudut tegas namun rapi sebesar `6px` (`rounded-md`) untuk panel dan tabel, serta `4px` (`rounded`) untuk tombol, *input*, dan *badge*.
* **Garis Pembatas (*Hairline Borders*):** Setiap kartu dan panel di atas latar `#F0EEE8` wajib menggunakan `background: #FAF9F5` dan `border: 1px solid #DCD8CE` tanpa *drop shadow* tebal (kecuali untuk modal mengambang seperti *Command Palette* dan *Modal QRIS*).

### 4.2 Pola Split-Pane untuk Halaman Dokumentasi & Playground
Halaman **Docs & Playground** menggunakan tata letak dua kolom pada layar desktop:
1. **Navigasi Kiri (`220px` tetap):** Daftar seksi dokumentasi (*Mulai Cepat*, *Live API Playground*, *Konfigurasi Cursor/Cline*, *Kode Kendala*). Item aktif ditandai latar `#282824` dan teks `#FAF9F5`.
2. **Panel Kerja Kanan (`flex-1`):** Menampilkan *snippet* kode multi-bahasa (Python, JS, cURL) atau formulir pengujian *prompt* interaktif secara berdampingan dengan panel keluaran JSON.

## 5. Spesifikasi Komponen Kunci

### 5.1 Header Navigasi Atas
* Tinggi tetap `56px` (`h-14`), menempel di atas (`sticky top-0 z-30`), latar `#FAF9F5` dengan batas bawah `1px solid #DCD8CE`.
* **Sisi Kiri:** Kotak monogram `KT` (`bg-[#282824] text-[#FAF9F5] font-mono`), nama brand **katalis**, *badge* `GATEWAY` (`bg-[#F0EEE8] text-[#77746B] border border-[#DCD8CE]`), serta indikator titik hijau berdenyut (`#54836A`) bertuliskan `Terhubung · 18ms`.
* **Sisi Tengah:** 5 tombol *tab* navigasi (`Monitor`, `Model`, `Dashboard Key`, `Beli / Top Up`, `Docs & Playground`). *Tab* aktif memiliki garis bawah atau latar `#282824` dengan teks `#FAF9F5`.
* **Sisi Kanan:** Tombol pencarian cepat `Cari model... ⌘K`, tombol salin Base URL `https://katalis.sh/v1`, serta ringkasan saldo member jika sudah login (`Rp 64.250` dengan warna `#54836A`).

### 5.2 Grafik Telemetri & Indikator 3-Pool (Halaman Monitor)
* **Grafik Utama (`Chart.js`):** Wajib dibungkus di dalam kontainer `<div class="relative h-64 w-full">` dengan opsi `maintainAspectRatio: false`.
  * Garis *Token/detik* menggunakan warna `#54836A` (Success) dengan isian area transparan `rgba(84, 131, 106, 0.10)`.
  * Garis *Request/detik* menggunakan warna `#B77A45` (Accent) dengan isian area transparan `rgba(183, 122, 69, 0.10)`.
  * Garis kisi (*grid lines*) menggunakan `#DCD8CE` dan teks sumbu menggunakan `JetBrains Mono` `#77746B`.
* **Kartu Status Pool Kapasitas:**
  * **Dedicated LoRA Pool:** Badge `#B77A45` (Accent) dan bar progres berwarna `#B77A45`.
  * **Stable Pool:** Badge `#54836A` (Success) dan bar progres berwarna `#54836A`.
  * **Flex Pool:** Badge `#77746B` (Secondary) dan bar progres berwarna `#B77A45` saat beban mendekati batas jendela kuota.

### 5.3 Tabel Katalog Model & Kalkulator Biaya (Halaman Model)
* Baris *header* tabel menggunakan latar `#F0EEE8` dan batas bawah `1px solid #DCD8CE`.
* Baris data menggunakan latar `#FAF9F5` dengan efek *hover* `bg-[#F0EEE8]/60`.
* **Kolom ID Model:** Ditampilkan sebagai tombol kapsul `font-mono` (`bg-[#F0EEE8] border border-[#DCD8CE] text-[#282824] hover:border-[#B77A45]`). Saat diklik, menyalin ID model ke *clipboard* dan memunculkan *toast* konfirmasi.
* **Sakelar Simulasi Diskon Unlimited (-30%):** Saat diaktifkan, harga asli dicoret tipis (`line-through text-[#77746B]`) dan harga diskon ditampilkan tegas dengan warna `#B77A45`.

### 5.4 Dashboard Member Multi-API Key (Halaman Dashboard Key)
* Menampilkan 3 kartu ringkasan di bagian atas: **Sisa Saldo Dompet (`Rp`)**, **Status Paket Unlimited (Tanggal Berakhir)**, dan **Bar Kuota Bonus Harian**.
* **Tabel Manajemen Multi-Key:**
  * Kolom: `NAMA KEY`, `PREFIX KEY (sk-ktl-...)`, `PEMAKAIAN / BATAS LIMIT`, `TERAKHIR DIGUNAKAN`, `STATUS`, dan `AKSI`.
  * Menyediakan tombol `+ Buat API Key Baru` (`bg-[#282824] text-[#FAF9F5]`), tombol edit batas pemakaian (`spend_limit_idr`), serta tombol cabut akses (`Revoke` berwarna `#C45E52`).
* **Modal Key Baru Diterbitkan:** Menampilkan API Key lengkap satu kali di dalam kotak berlatar `#F0EEE8` dengan batas `#B77A45`, tombol `Salin Key`, dan peringatan bahwa key tidak akan ditampilkan lagi setelah jendela ditutup.

### 5.5 Modal Checkout QRIS Dinamis (Halaman Beli / Top Up)
* Menampilkan rincian tagihan secara transparan: Nominal Paket, Bonus Kupon/Referral, Kode Unik/Biaya Layanan, dan **Total Bayar (`Rp`)**.
* Kotak kode QRIS diletakkan di tengah kontainer bersih `#FAF9F5` berbingkai `1px solid #DCD8CE` dengan penanda waktu mundur `14:59` (`tabular-nums text-[#B77A45]`).
* Menampilkan indikator status *polling* otomatis (`Menunggu Pembayaran...` -> berubah otomatis menjadi kotak hijau `#54836A` `Pembayaran Lunas! Saldo telah ditambahkan` begitu *webhook* diterima).

## 6. Matriks Empat Status Data Wajib (*4 Mandatory Data States*)

Setiap komponen yang mengambil atau memanipulasi data wajib mengimplementasikan keempat kondisi berikut secara eksplisit:

| Kondisi (*State*) | Spesifikasi Visual & Perilaku UI |
| :--- | :--- |
| **1. Loading** | Menampilkan baris kerangka (*skeleton bars*) dengan tinggi yang sama persis dengan data asli menggunakan warna `#F0EEE8` beranimasi `animate-pulse` di atas panel `#FAF9F5` (mencegah pergeseran tata letak / *layout shift*). |
| **2. Empty** | Menampilkan kotak berbatas garis putus-putus `1px dashed #DCD8CE` dengan penjelasan singkat berwarna `#77746B` dan satu tombol aksi langsung (contoh: *"Belum ada API Key aktif di akun Anda"* + tombol `+ Buat API Key Pertama`). |
| **3. Error** | Menampilkan panel berlatar `rgba(196, 94, 82, 0.10)` dengan batas `1px solid #C45E52`, kode error teknis dalam `font-mono` (misal: `HTTP 401 · INVALID_API_KEY`), penjelasan penyebab, serta tombol pemulihan langsung (`Coba Lagi` atau `Top Up Saldo`). |
| **4. Populated** | Menampilkan data lengkap dengan pemotongan teks panjang (`truncate`) yang rapi, perataan kanan untuk seluruh kolom angka (`text-right tabular-nums`), dan umpan balik *toast* instan untuk setiap aksi penyalinan atau mutasi data. |
