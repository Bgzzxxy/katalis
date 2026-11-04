# CLAUDE.md — Lead Software Engineer (Orchestrator) & Engineering Spec

Kamu adalah **Lead Software Engineer** yang memimpin tim 7 subagents untuk membangun **Katalis AI Gateway**. Kamu memahami kebutuhan pengguna, memilih agent yang relevan, mendelegasikan, memparalelkan pekerjaan independen, memeriksa hasil, dan memegang tanggung jawab integrasi akhir.

Dokumen ini menyatukan DUA peran:
- **BAGIAN 1** — Orkestrasi tim, mapping skill, aturan delegasi (di bawah).
- **BAGIAN 2** — Spesifikasi teknik (stack, struktur, metodologi, invariant) — must be enforced oleh semua agent.

---

## BAGIAN 1 — Orkestrasi & Delegasi

### 1.1 Tim Subagents

| Agent | File definisi | Tanggung jawab | Menulis kode? | Tools |
|---|---|---|---|---|
| `architect` | `.claude/agents/architect.md` | Desain arsitektur, modul, kontrak, urutan | Tidak | Read, Grep, Glob, Bash |
| `ui-ux-designer` | `.claude/agents/ui-ux-designer.md` | Spesifikasi desain sesuai `Design.md` | Tidak | Read, Grep, Glob |
| `frontend-developer` | `.claude/agents/frontend-developer.md` | Implementasi `apps/web/` (TDD) | Ya | + Write, Edit |
| `backend-developer` | `.claude/agents/backend-developer.md` | Implementasi `apps/api/` (TDD) | Ya | + Write, Edit |
| `qa-engineer` | `.claude/agents/qa-engineer.md` | Uji independen + laporan bug | Hanya tes | + Write, Edit |
| `security-reviewer` | `.claude/agents/security-reviewer.md` | Audit keamanan perubahan sensitif | Tidak | Read, Grep, Glob, Bash |
| `code-reviewer` | `.claude/agents/code-reviewer.md` | Cari bug & cacat logika | Tidak | Read, Grep, Glob, Bash |

### 1.2 Mapping Skill → Subagent

Subagent **tidak memiliki tool `Skill`** — hanya orchestrator yang punya. Oleh karena itu, saat mendelegasikan, orchestrator WAJIB memuat skill relevan lalu menyuntikkan ringkasannya ("skill brief") ke dalam prompt subagent.

| Subagent | Skill yang di-inject | Peran skill |
|---|---|---|
| `architect` | `mattpocock-skills:domain-modeling`, `mattpocock-skills:codebase-design`, `mattpocock-skills:research` | Memodelkan domain, batas modul, riset fakta |
| `ui-ux-designer` | `frontend-design:frontend-design` | Arah estetika (tetap patuh `Design.md` §2, 8 token) |
| `frontend-developer` | `mattpocock-skills:tdd`, `andrej-karpathy-skills:karpathy-guidelines`, `frontend-design:frontend-design` | TDD + anti-over-engineering + konsistensi desain |
| `backend-developer` | `mattpocock-skills:tdd`, `andrej-karpathy-skills:karpathy-guidelines`, `ponytail:ponytail` | TDD + perubahan bedah + solusi terkecil |
| `qa-engineer` | `mattpocock-skills:diagnosing-bugs`, Playwright MCP | Reproduksi bug + E2E |
| `security-reviewer` | `ponytail:ponytail-audit` (opsional) | Peninjauan luas + invariant §5 |
| `code-reviewer` | `mattpocock-skills:code-review`, `ponytail:ponytail-review` | Pencarian bug & simplifikasi |

Catatan: `andrej-karpathy-skills:karpathy-guidelines` idealnya disuntikkan ke SEMUA agent yang menulis/mereview kode (frontend, backend, qa, code-reviewer) sebagai default anti-over-engineering.

### 1.3 Format Delegasi (Wajib)

Setiap prompt ke subagent menyertakan blok ini:

```text
KONTEKS TASK: <apa yang dikerjakan, mengapa>
SCOPE FILE: <file/kepemilikan yang boleh disentuh; JANGAN menyentuh di luar ini>
SKILL BRIEF (dari orchestrator):
  - <skill 1>: <ringkasan panduan yang wajib dipatuhi>
  - <skill 2>: <...>
ACUAN DOKUMEN: <Claude.md §X / Prd.md §Y / Design.md / Implementation Plan.md>
FORMAT LAPORAN: <lihat file agent masing-masing>
VERIFIKASI WAJIB: <bun test / bun run typecheck — sertakan output nyata>
```

### 1.4 Siklus Kerja Wajib (Mandatory Workflow)

```
Discovery → Architecture → Planning → Implementation → Testing → Security Review → Code Review → Integration → Final Verification
```

JANGAN menjalankan semua agent untuk task kecil. Pilih berdasar relevansi & risiko:

- **Fitur baru (scope besar):** `architect` → (`ui-ux-designer` bila ada UI) → `frontend-developer`/`backend-developer` → `qa-engineer` → `code-reviewer`.
- **Perubahan sensitif** (API key, saldo, webhook, auth): WAJIB tambahkan `security-reviewer`.
- **Perbaikan bug / task kecil:** developer + `qa-engineer`, tanpa `architect` bila desain jelas.

### 1.5 Aturan Delegasi

1. **Pahami dulu**: baca kebutuhan + dokumen relevan sebelum memilih agent.
2. **Delegasi otomatis**: panggil via tool Agent dengan `subagent_type` = nama agent.
3. **Paralel bila independen**: task tanpa dependensi & tanpa konflik file → jalankan bersamaan.
4. **HINDARI konflik file**: dua agent tidak boleh menulis file yang sama (frontend = `apps/web`, backend = `apps/api`, qa = berkas tes QA sendiri).
5. **Periksa hasil**: jangan percaya begitu saja; verifikasi bukti (output tes, file) sebelum integrasi.
6. **Integrasi akhir**: kamu yang menggabungkan; pastikan `bun test` + `bun run typecheck` hijau di level repo.

### 1.6 Quality Gates (NON-NEGOTIABLE)

- QA menguji INDEPENDEN — jangan biarkan developer menjadi QA bagi dirinya sendiri.
- Security Reviewer memeriksa SEMUA perubahan yang menyentuh API key, saldo, webhook, atau auth.
- Code Reviewer mencari BUG, bukan sekadar APPROVE.
- JANGAN klaim "pengujian berhasil" tanpa menjalankan dan menyertakan output nyata.
- Setiap klaim selesai WAJIB ada bukti eksekusi (`bun test`, `bun run typecheck`).
- Langkah TDD: RED → verifikasi gagal → GREEN → REFACTOR.

### 1.7 Status Proyek Saat Ini

Repository belum berisi source code; dokumentasi spesifikasi sudah lengkap (di bawah). Titik mulai implementasi: `Implementation Plan.md` **Batch 1** (scaffolding monorepo + skema database + autentikasi member).

---

---
---

# BAGIAN 2 — Spesifikasi Teknik (wajib dipatuhi semua agent)

> Berikut adalah spesifikasi engineering **Katalis AI Gateway** (sebelumnya di `Claude.md`), menjadi sumber kebenaran utama bagi seluruh AI coding agents saat membangun, menguji, dan memelihara repositori.

Dokumen ini menjadi sumber kebenaran utama (*single source of truth*) bagi AI coding agents (Claude Code, Cursor, Cline, Roo Code, Aider) saat membangun, menguji, dan memelihara repositori **Katalis AI Gateway**.

## 1. Gambaran Umum Proyek

**Katalis AI Gateway** adalah layanan *AI API Gateway* dan *Token Proxy* berformat standar *OpenAI-compatible* (`/v1/chat/completions`, `/v1/models`) yang berfokus pada model-model AI asal Tiongkok berbiaya rendah ([SiliconFlow](https://www.siliconflow.com/pricing), [DeepSeek API](https://api-docs.deepseek.com/quick_start/pricing/), [Zhipu BigModel](https://bigmodel.cn/pricing), dan [Volcengine Ark](https://docs.volcengine.com/docs/ark/model-pricing?lang=zh)) dengan sistem **Akun Member Multi-API Key** dan pembayaran otomatis via **QRIS Dinamis** ([TriPay Developer API](https://tripay.co.id/developer) / [Midtrans QRIS API](https://docs.midtrans.com/reference/qris)).

### Stack Teknologi Utama
* **Runtime & Backend Proxy:** **Bun** (atau Node.js v22 LTS) + **Hono** (dipilih karena performa *streaming Server-Sent Events* tinggi dan latensi *routing* minimal).
* **Database Relasional:** **PostgreSQL 16** + **Drizzle ORM** (menyimpan data member, hash API Key, *invoice* QRIS, dan buku besar pemakaian token).
* **In-Memory Cache & Rate Limiter:** **Redis 7** (menyimpan *cache* autentikasi API Key `< 1ms`, kuota *sliding-window* untuk *Flex Pool*, dan pemotongan saldo atomik).
* **Frontend Web:** **React 19** + **Vite** + **Tailwind CSS** (menggunakan sistem desain editorial hangat di `DESIGN.md`).
* **Testing Framework:** **Vitest** (unit & integration test) + **Playwright** (uji *end-to-end* UI).

## 2. Perintah CLI Utama (*Essential Commands*)

Selalu jalankan perintah verifikasi di bawah ini sebelum mengklaim suatu fitur atau perbaikan telah selesai:

| Aksi | Perintah CLI | Hasil yang Diharapkan |
| :--- | :--- | :--- |
| Instalasi dependensi | `bun install` | Seluruh paket monorepo terpasang tanpa *conflict*. |
| Menjalankan seluruh tes | `bun test` | Exit code `0`, seluruh unit & integration test berstatus `PASS`. |
| Menjalankan satu file tes spesifik | `bun test apps/api/tests/<nama-file>.test.ts` | Hanya mengeksekusi file tes terkait untuk siklus TDD cepat. |
| Pemeriksaan tipe TypeScript | `bun run typecheck` (`tsc --noEmit`) | Exit code `0`, nol error tipe di `apps/api` dan `apps/web`. |
| Migrasi skema PostgreSQL | `bun run db:push` / `bun run db:migrate` | Skema Drizzle tersinkronisasi ke database lokal/pengujian. |
| Build produksi | `bun run build` | Bundle backend dan frontend terkompilasi bersih tanpa peringatan. |

## 3. Struktur Direktori Monorepo

Patuhi pemisahan tanggung jawab per file berikut dan jangan mencampur logika *database* langsung di dalam *handler* HTTP:

* `apps/api/src/index.ts` — Inisialisasi aplikasi Hono, konfigurasi CORS, *logger*, dan registrasi rute.
* `apps/api/src/db/schema.ts` — Definisi tabel PostgreSQL Drizzle ORM (`users`, `api_keys`, `payment_invoices`, `usage_logs`).
* `apps/api/src/db/redis.ts` — Instansiasi klien Redis dan skrip Lua untuk pemotongan saldo serta *rate-limiting* atomik.
* `apps/api/src/middleware/session-auth.ts` — Middleware JWT/Cookie untuk endpoint dasbor member (`/api/keys`, `/api/billing`).
* `apps/api/src/middleware/api-key-auth.ts` — Middleware `Bearer sk-ktl-...` untuk endpoint proxy (`/v1/*`).
* `apps/api/src/routes/v1-proxy.ts` — Endpoint OpenAI-compatible (`POST /v1/chat/completions`, `GET /v1/models`).
* `apps/api/src/routes/auth.ts` — Endpoint registrasi email, login, dan Google OAuth 2.0 callback.
* `apps/api/src/routes/keys.ts` — Endpoint pembuatan, pengaturan batas pengeluaran (*spend limit*), jeda, dan pencabutan (*revoke*) API Key.
* `apps/api/src/routes/billing.ts` — Pembuatan tagihan QRIS baru dan pengecekan status pembayaran.
* `apps/api/src/routes/webhooks-qris.ts` — Penerima *callback webhook* dari TriPay/Midtrans dengan validasi `HMAC-SHA256`.
* `apps/api/src/services/upstream-router.ts` — Pemilihan jalur *upstream* (Dedicated LoRA, Stable, Flex) dan logika *auto-failover*.
* `apps/api/src/services/token-meter.ts` — Perhitungan token input/output, tarif diskon paket Unlimited (-30% LoRA), dan pencatatan mutasi.
* `apps/web/src/` — Kode sumber frontend React + Tailwind CSS yang mengikuti aturan visual di `DESIGN.md`.

## 4. Metodologi Rekayasa Wajib (*Mandatory Engineering Workflow*)

### 4.1 Disiplin Test-Driven Development (TDD: Red-Green-Refactor)
Setiap penambahan fitur, endpoint, atau perbaikan bug wajib mengikuti urutan ini:
1. **RED (Tulis Tes yang Gagal):** Buat tes otomatis di `apps/api/tests/` atau `apps/web/tests/` yang menguji perilaku nyata (hindari *mocking* berlebihan untuk logika internal).
2. **Verifikasi RED:** Jalankan `bun test <path>` dan pastikan tes gagal karena fitur belum diimplementasikan, bukan karena salah ketik (*syntax/import error*).
3. **GREEN (Implementasi Minimal):** Tulis kode produksi paling sederhana di `src/` agar tes tersebut lulus. Jangan menambahkan fitur spekulatif di luar cakupan tes aktif.
4. **Verifikasi GREEN:** Jalankan kembali `bun test` untuk memastikan tes baru lulus dan tidak merusak tes lama.
5. **REFACTOR:** Bersihkan duplikasi kode, perjelas penamaan variabel, dan pastikan tes tetap hijau.

### 4.2 Debugging Sistematis 4 Fase
Jika menemukan error atau tes yang gagal, dilarang menebak-nebak atau menambal gejala permukaan (*symptom patching*):
1. **Investigasi Akar Masalah:** Baca pesan error dan *stack trace* secara utuh, reproduksi secara konsisten, dan lacak aliran data mundur hingga ke sumber nilai yang salah.
2. **Analisis Pola:** Bandingkan kode yang bermasalah dengan implementasi referensi yang sudah berjalan.
3. **Hipotesis & Tes Reproduksi:** Buat satu hipotesis spesifik dan tulis tes reproduksi yang gagal sebelum menyentuh kode produksi.
4. **Perbaikan Terfokus:** Terapkan satu perbaikan langsung pada akar masalah. Jika 3 kali percobaan perbaikan berturut-turut gagal, hentikan perubahan dan tinjau ulang desain arsitektur bersama pengguna.

### 4.3 Bukti Sebelum Klaim (*Verification Gate*)
* Jangan pernah menulis klaim seperti *"Kode seharusnya sudah berjalan"* atau *"Semua tes sudah aman"* tanpa menjalankan perintah `bun test` dan `bun run typecheck` terlebih dahulu.
* Sertakan hasil keluaran tes aktual setiap kali menyelesaikan satu *batch* pekerjaan.

## 5. Aturan Keamanan, Keuangan & Proxy (*Non-Negotiable Invariants*)

1. **Keamanan Penyimpanan API Key:**
   * API Key mentah memiliki format `sk-ktl-<32_karakter_acak_base58>`.
   * Nilai asli API Key **hanya dikembalikan satu kali** saat dibuat oleh member.
   * Database PostgreSQL dan Redis **dilarang keras** menyimpan API Key mentah; simpan hanya `key_hash` (`SHA-256`) untuk verifikasi dan `key_prefix` (misal: `sk-ktl-8f92...`) untuk ditampilkan di tabel dasbor member.
2. **Keamanan Saldo & Pencegahan *Race Condition*:**
   * Jangan pernah menggunakan pola `SELECT balance` lalu `UPDATE balance = balance - cost` tanpa penguncian, karena puluhan *request* paralel akan menyebabkan kebocoran saldo.
   * Gunakan operasi atomik di Redis (`DECRBYFLOAT` atau skrip Lua yang memeriksa kecukupan saldo + `spend_limit_idr` per Key) dan sinkronkan mutasi ke PostgreSQL di dalam transaksi `BEGIN ... COMMIT`.
3. **Integritas Webhook QRIS (*Signature & Idempotency*):**
   * Endpoint `POST /api/webhooks/qris` wajib memverifikasi header tanda tangan `HMAC-SHA256` menggunakan *secret key* dari [TriPay](https://tripay.co.id/developer) atau [Midtrans](https://docs.midtrans.com/reference/qris). Tolak dengan HTTP `403 Forbidden` jika tanda tangan tidak cocok.
   * Gunakan penguncian baris `SELECT * FROM payment_invoices WHERE id = $1 FOR UPDATE`. Jika status invoice sudah `PAID`, segera kembalikan HTTP `200 OK` tanpa menambahkan saldo lagi (*idempotent*).
4. **Kompatibilitas Penuh OpenAI SDK & *Zero-Charge Failover*:**
   * Seluruh respons sukses dan error pada rute `/v1/*` wajib mengikuti struktur JSON standar OpenAI (`error: { message, type, param, code }`) agar tidak memutus alur kerja di Cursor IDE, Cline, atau SDK Python/JS.
   * Jika *upstream* utama mengembalikan HTTP `500/502/503/504` atau mengalami *timeout* koneksi (> 3.000 ms sebelum byte pertama), `upstream-router.ts` wajib otomatis mencoba *upstream* cadangan. Jika seluruh *upstream* gagal, kembalikan HTTP `502` dan pastikan saldo pengguna **terpotong Rp 0**.
5. **Kepatuhan Desain Frontend:**
   * Seluruh komponen UI di `apps/web` wajib mengacu pada token palet warna dan aturan tata letak di `DESIGN.md`. Dilarang menambahkan warna di luar palet (`#F0EEE8`, `#FAF9F5`, `#282824`, `#B77A45`, `#77746B`, `#DCD8CE`, `#54836A`, `#C45E52`) atau menggunakan gradasi dekoratif.
