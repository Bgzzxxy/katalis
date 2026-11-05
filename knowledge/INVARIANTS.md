# Invariant Mutlak (Tidak Boleh Dilanggar)

Aturan-aturan di bawah ini bersifat **non-negotiable**. Setiap agent yang mengubah kode di repositori ini wajib mematuhi semua invariant di bawah. Jika ada kebutuhan fitur yang tampaknya memerlukan pelanggaran salah satu invariant, **hentikan pekerjaan dan tanyakan ke user** — jangan putuskan sendiri.

---

## 1. Keamanan Penyimpanan API Key

- Format API key mentah: `sk-ktl-<32 karakter acak base58>` (dibuat dengan CSPRNG).
- **Nilai asli API Key HANYA dikembalikan satu kali** saat dibuat. Setelah itu, kunci mentah tidak boleh bisa diambil kembali dari server, log, atau respons API mana pun.
- **DILARANG KERAS** menyimpan API Key mentah di PostgreSQL, Redis, atau file log. Yang boleh disimpan hanya:
  - `key_hash` (SHA-256 hex, 64 karakter) — untuk verifikasi.
  - `key_prefix` (misal `sk-ktl-8f92...`) — untuk tampilan di dasbor.
- Hash dibandingkan dengan `crypto.timingSafeEqual` untuk mencegah serangan timing.

**Berkas terkait:** `apps/api/src/services/key.service.ts`, `apps/api/src/middleware/api-key-auth.ts`.

---

## 2. Atomisitas Saldo & Pencegahan Race Condition

- **DILARANG** memakai pola `SELECT balance` lalu `UPDATE balance = balance - cost` tanpa penguncian. Ini menyebabkan kebocoran saldo saat puluhan request paralel.
- Semua komputasi saldo runtime wajib memakai **skrip Lua atomik di Redis** (`CHARGE_LUA` / `PRECHECK_LUA`); debit di-klamp dengan `min(cost, available)` agar saldo tidak pernah negatif.
- Biaya yang ditagih **wajib memakai nilai yang benar-benar didebit** (`debitMicro` dari hasil charge), **bukan** biaya nominal yang dihitung.
- Setelah debit Redis, mutasi **wajib disinkronkan ke PostgreSQL transaksional**:
  - `users.wallet_balance_idr` dikurangi
  - `api_keys.spent_idr` dan `last_used_at` diperbarui
  - baris `usage_logs` dicatat
- Diskon **-30% LoRA HANYA berlaku** untuk `poolTier === "LORA"` pada model LoRA **DAN** paket Unlimited yang masih aktif. Klien tidak boleh bisa meminta diskon ini dengan mengirim header; server menolak `x-katalis-pool` yang berbeda dari `model.defaultPool`.

**Berkas terkait:** `apps/api/src/db/redis.ts`, `apps/api/src/services/token-meter.ts`, `apps/api/src/routes/v1-proxy.ts`.

---

## 3. Integritas Webhook QRIS (Signature & Idempotency)

- **Wajib** memverifikasi header tanda tangan `HMAC-SHA256` dari TriPay/Midtrans. Tolak dengan HTTP **403 Forbidden** jika tanda tangan tidak cocok.
- Jumlah yang dikredit diambil dari **baris DB invoice**, bukan dari payload webhook.
- Gunakan penguncian baris `SELECT * FROM payment_invoices WHERE ... FOR UPDATE`.
- Jika invoice sudah berstatus `PAID`, kembalikan HTTP **200 OK** tanpa menambah saldo lagi (**idempoten**).
- `payment_invoices.status` hanya bertransisi: `PENDING → PAID` (satu arah) atau `PENDING → EXPIRED/FAILED`. Status terminal stabil; webhook lintas-status tidak boleh menimpa status terminal yang sudah tercatat.
- Lakukan *seed snapshot* PG (`wallet:seed:<userId>`) setelah commit transaksi, lalu **hapus** `wallet:<userId>` — jangan pernah biarkan saldo Redis basi di bawah nilai PG.

**Berkas terkait:** `apps/api/src/routes/webhooks-qris.ts`, `apps/api/src/services/qris.service.ts`, `apps/api/src/services/qris-provider.ts`.

---

## 4. Kompatibilitas OpenAI SDK & Zero-Charge Failover

- Seluruh respons error di `/v1/*` **wajib** mengikuti struktur JSON standar OpenAI:
  ```json
  { "error": { "message": "...", "type": "...", "param": null, "code": "..." } }
  ```
  Ini agar Cursor IDE, Cline, dan SDK Python/JS tidak putus alurnya.
- Jika upstream utama mengembalikan `500/502/503/504` atau timeout (byte pertama > 3000 ms), router **wajib** otomatis mencoba upstream cadangan.
- Jika **seluruh** upstream gagal: kembalikan HTTP **502** dan pastikan saldo pengguna **terpotong Rp 0**.
- Respons upstream 4xx di-*passthrough* tanpa biaya (`shouldCharge: false`) — request yang invalid/unauthorized dari sisi upstream tidak boleh ditagih.
- Pemutusan klien (client abort) **bukan** pemicu failover dan tidak boleh ditagih.

**Berkas terkait:** `apps/api/src/services/upstream-router.ts`, `apps/api/src/routes/v1-proxy.ts`, `apps/api/src/middleware/error-handler.ts`.

---

## 5. Kepatuhan Desain Frontend (design.md v4.0)

- Token warna **v4.0** (Warm Editorial Light default + Obsidian Carbon Dark `class="dark"`) — sumber: `stitch_katalis_design_system/warm_editorial_precision/DESIGN.md` & `obsidian_carbon_precision_dark_mode/DESIGN.md`:
  - Surface: `#F0EEE8`/`#0D0D0C` canvas · `#FAF9F5`/`#1A1A17` surface · `#F3F1EB`/`#24231F` surface-hover · `#E6E2D8`/`#141412` secondary · `#282824`/`#090908` terminal.
  - Text: `#282824`/`#F0EEE8` primary · `#77746B`/`#A39E93` secondary · `#6E6B62` secondary-aa · `#8C887E`/`#8A857A` muted.
  - Accent: `#B77A45`/`#D4955A` graphic · `#8F5B2D`/`#D4955A` AA-text.
  - State: success `#54836A`/`#68A382` (+text `#3D6B52`) · warning `#B5761E`/`#E0A346` (+text `#8C5E1A`) · error `#C45E52`/`#E07265` (+text `#A33E32`) · info `#3B6E8C`/`#5B9BD5`.
  - Border: hairline `#DCD8CE`/`#2A2925` · strong `#B8B2A6`/`#42403A`.
- **DILARANG**: warna Tailwind bawaan (`bg-indigo-*`, `bg-purple-*`, `bg-blue-*`, `bg-slate-*`, dll), gradasi dekoratif, blob kabur, glassmorphism berlebihan, ikon dekoratif (Sparkles/Rocket/Bot/Zap).
- **`<svg>` dan `<img>`** dilarang di komponen src kecuali ikon fungsional (Lucide Copy/Plus/Search) dan QR code yang dihasilkan lokal.
- `shadow-*` **HANYA** diizinkan pada overlay melayang: `CommandPalette.tsx`, `CreateKeyModal.tsx`, `SpendLimitModal.tsx`, `QrisModal.tsx`, `useToast.tsx`.
- `backdrop-blur` **HANYA** diizinkan pada header sticky shell: `DashboardLayout.tsx`, `PublicLayout.tsx`, `LandingPage.tsx`.
- **4 status data wajib** (Loading/Empty/Error/Populated) ditegakkan oleh `components/ui/DataState.tsx` — setiap komponen yang memuat data backend harus melalui komponen ini.
- Angka dinamis **wajib** `tabular-nums` (dengan `slashed-zero`); angka Rupiah besar memakai format split-weight `Currency.tsx`.
- **DILARANG menampilkan angka/tombol palsu** yang tidak terhubung ke state nyata.

Guard otomatis: `apps/web/tests/qa/design-compliance.qa.test.ts`.

---

## 6. Bukti Sebelum Klaim (Verification Gate)

- **JANGAN PERNAH** menulis klaim seperti "kode seharusnya sudah berjalan" atau "semua tes sudah aman" tanpa menjalankan perintah verifikasi terlebih dahulu.
- Setiap klaim selesai **wajib** menyertakan hasil keluaran nyata dari:
  - `bun test <path>` (exit code 0, ringkasan pass/fail)
  - `bun run typecheck` dan/atau `bun run --cwd apps/web typecheck` (exit code 0)
- Siklus TDD wajib: **RED** (tulis tes gagal, verifikasi gagal) → **GREEN** (implementasi minimal, verifikasi lulus) → **REFACTOR** (bersihkan, tes tetap hijau).
- Debugging sistematis 4 fase: (1) investigasi akar masalah dari stack trace, (2) analisis pola dengan implementasi referensi, (3) hipotesis + tes reproduksi, (4) perbaikan terfokus pada akar. Jika 3 percobaan berturut-turut gagal, **hentikan dan tinjau ulang desain bersama user**.
