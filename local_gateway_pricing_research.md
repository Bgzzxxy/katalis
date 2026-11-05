# Laporan Riset Komparasi: Struktur Harga Token AI per 1 Juta Token (Input, Output, Cached) Provider Lokal Indonesia

**Tanggal Riset & Verifikasi Data:** 5 November 2026  
**Cakupan Investigasi:** 6 Provider Gateway AI Lokal Indonesia (Nutaraline, NusaGate, OneAPI Indonesia, TokenFlow, NilovrAI, CleveCode)  
**Tujuan Analisis:** Membedah struktur tarif riil per 1 juta token, disparitas harga antar-model, model penagihan (Rupiah langsung, konversi kredit/multiplier, paket kuota/kredit), serta batas toleransi margin untuk pembangunan platform Katalis AI Gateway.

---

## 1. Analisis Model Bisnis & Skema Penagihan Provider Lokal

Dari hasil penelusuran langsung terhadap situs resmi dan dokumentasi masing-masing platform, terdapat **3 model penagihan utama** yang digunakan oleh para pemain lokal di Indonesia:

1. **Model A: Penagihan Rupiah Langsung per 1 Juta Token (Pay-As-You-Go Murni)**
   * **Contoh Provider:** [Nutaraline Gateway](https://nutaraline.co.uk/) dan [NusaGate](https://nusagate.com/models).
   * **Karakteristik:** Menampilkan angka Rupiah riil per 1M token secara transparan untuk *Input*, *Output*, dan *Cache Hit*. Saldo pengguna didepositkan dalam Rupiah (via QRIS) dan dipotong per transaksi sesuai pemakaian token aktual.
2. **Model B: Sistem Nilai Tukar Kredit / Multiplier Bersama**
   * **Contoh Provider:** [NilovrAI](https://nilovr.com/pricing/) (1 Kredit = Rp 400 tetap) dan [TokenFlow](https://tokenflow.my.id/) (Sistem Multiplier Token 1× s/d 60×).
   * **Karakteristik:** Pengguna membeli paket kredit atau token gabungan (misal Rp 10.000 = 25 kredit di NilovrAI, atau Rp 24.000 = 100M token dasar di TokenFlow). Model yang lebih mahal mengonsumsi kredit/token dengan pengganda (*multiplier*) lebih tinggi.
3. **Model C: Sistem Kuota Dollar/Kredit Bersubsidi Grosir**
   * **Contoh Provider:** [CleveCode](https://clevecode.com/) (Mulai $1/bulan mendapat $10 kredit AI) dan [OneAPI Indonesia](https://oneapi.id/models) (Menampilkan harga basis USD per 1M token dengan diskon 20%–70% dari harga resmi, ditagihkan via QRIS).

---

## 2. Tabel Master Perbandingan Harga per 1 Juta Token (Input / Output / Cache Hit)

Tabel berikut menyajikan perbandingan harga aktual per 1 juta token dalam **Rupiah (IDR)** (atau ekuivalen Rupiah pada kurs acuan pasar Rp 16.000 / USD jika provider mencantumkan tarif USD) per 5 November 2026:

| Model AI Populer | [Nutaraline Gateway](https://nutaraline.co.uk/) | [NusaGate](https://nusagate.com/models) | [OneAPI Indonesia](https://oneapi.id/models) *(Kurs Rp 16.000)* | [NilovrAI](https://nilovr.com/pricing/) *(1 Kredit = Rp 400)* | [TokenFlow](https://tokenflow.my.id/) *(Paket 100M = Rp 24rb)* | [CleveCode](https://clevecode.com/) *(Subsidi 10x Kredit)* |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **DeepSeek V4.1 Flash** | **Rp 42 in / Rp 84 out**<br>*(LoRA: Rp 45 / Rp 90)*<br>*(Unlimited: Rp 29,4 / Rp 58,8)*<br>*(Flex: Rp 33 / Rp 66)* | **Rp 900 in / Rp 3.200 out**<br>*(Cache Hit: Rp 90 / 10%)* | **Rp 3.360 in / Rp 13.440 out**<br>($0.21 / $0.84)<br>*(Tersedia opsi Free)* | **≈ Rp 800 per 1M total**<br>*(Tarif 2 kredit / 1M token)* | **Multiplier: 2.56×**<br>*(≈ Rp 614 / 1M token)*<br>*(1017: 3× ≈ Rp 720)* | Termasuk dalam paket all-model balance |
| **DeepSeek V4 Pro** | Rp 30 in / Rp 60 out *(V4 Flash)* | **Rp 4.000 in / Rp 12.000 out**<br>*(Cache Hit: Rp 400 / 10%)* | **Rp 7.360 in / Rp 22.240 out**<br>($0.46 / $1.39 pada 0813) | **≈ Rp 460 per 1M total**<br>*(1.15 kredit)*<br>*(0813: 1.8 kredit ≈ Rp 720)* | **Multiplier: 1.15×**<br>*(≈ Rp 276 / 1M token)* | Termasuk dalam paket all-model balance |
| **Qwen 3.8 Flash** | **Rp 9 in / Rp 18 out** *(North Mini)* | **Rp 900 in / Rp 2.800 out**<br>*(Cache Hit: Rp 90 / 10%)* | Diarahkan via Qwen open-weights | **≈ Rp 800 per 1M total**<br>*(Tarif 2 kredit / 1M token)* | **Multiplier: 2×** *(Estimasi)* | Termasuk dalam paket all-model balance |
| **Qwen 3.8 Max** | — | **Rp 11.800 in / Rp 35.500 out**<br>*(Cache Hit: Rp 1.200 / 10%)* | Mengikuti katalog enterprise | — | — | Termasuk dalam paket all-model balance |
| **GLM 5.3 Flash** | **Rp 9 in / Rp 18 out** *(Nemotron/Dots)* | **Rp 1.100 in / Rp 3.000 out**<br>*(Cache Hit: Rp 110 / 10%)* | **Rp 1.120 in / Rp 4.000 out**<br>($0.07 / $0.25)<br>*(Tersedia opsi Free)* | **≈ Rp 800 per 1M total**<br>*(Tarif 2 kredit / 1M token)* | **Multiplier: 2×**<br>*(≈ Rp 480 / 1M token)* | Termasuk dalam paket all-model balance |
| **GLM 5.3 (Flagship)** | — | **Rp 8.300 in / Rp 26.000 out**<br>*(Cache Hit: Rp 830 / 10%)* | **Rp 480 in / Rp 61.440 out**<br>($0.03 in / $3.84 out) | **≈ Rp 800 per 1M total**<br>*(Tarif 2 kredit / 1M token)* | **Multiplier: 2×**<br>*(≈ Rp 480 / 1M token)* | Termasuk dalam paket all-model balance |
| **Kimi K3 / K3.1 Pro** | — | **Rp 17.000 in / Rp 89.000 out**<br>*(Cache Hit: Rp 1.700 / 10%)* | **Rp 8.160 in / Rp 172.800 out** (`K3`)<br>**Rp 25.600 in / Rp 128.000 out** (`K3.1`) | — | **K2.7-Code: 1×** *(≈ Rp 240/1M)*<br>**K2.8: 2×** *(≈ Rp 480/1M)* | Termasuk dalam paket all-model balance |
| **Xiaomi MiMo V2.6 Flash** | — | — | **Rp 1.120 in / Rp 2.240 out**<br>($0.07 in / $0.14 out) | **≈ Rp 800 per 1M total**<br>*(Tarif 2 kredit / 1M token)* | **Multiplier: 2×**<br>*(≈ Rp 480 / 1M token)* | Termasuk dalam paket all-model balance |
| **Xiaomi MiMo V2.6 Pro** | — | — | **Rp 5.600 in / Rp 11.200 out**<br>($0.35 in / $0.70 out) | **≈ Rp 800 per 1M total**<br>*(Tarif 2 kredit / 1M token)* | **Multiplier: 2×**<br>*(≈ Rp 480 / 1M token)* | Termasuk dalam paket all-model balance |
| **GPT-6 / GPT-6.1 Sol / Luna** | — | **GPT-6 Luna: Rp 600 in / Rp 3.000 out**<br>**GPT-6.1 Sol: Rp 10.000 in / Rp 60.000 out**<br>**GPT-6 Astra: Rp 60.000 in / Rp 310.000 out** | **GPT-6 Luna: Rp 1.120 in / Rp 5.600 out**<br>**GPT-6.1 Sol: Rp 22.400 in / Rp 112.000 out**<br>**GPT-6 Astra: Rp 112.000 in / Rp 560.000 out** | **GPT-6 Luna: ≈ Rp 800/1M** | **GPT-6 Luna: 8×** *(≈ Rp 1.920/1M)*<br>**GPT-6 Astra: 42×** *(≈ Rp 10.080/1M)* | **Starter ($1):** Luna & Terra<br>**Lite ($5+):** Sol & Astra |
| **Claude Sonnet / Opus 5.5** | — | — | **Sonnet 5.5: Rp 22.400 in / Rp 112.000 out**<br>**Opus 5.5: Rp 44.800 in / Rp 224.000 out** | — | **Hanya via model proxy Claude** | **Lite ($5+):** Opus 5, Fable 5, Fable 5.1 |

---

## 3. Profil Mendalam Masing-Masing Provider Lokal

### 1. [Nutaraline Gateway](https://nutaraline.co.uk/)
* **Model Bisnis:** Pay-as-you-go eceran termurah + Opsi langganan Unlimited 10 Hari (Rp 20.000).
* **Strategi Harga:** Memecah pasar dengan harga dasar ekstrem (**Rp 9 s/d Rp 45 per 1M token input**).
* **Fitur Utama:** Pemisahan *Dedicated LoRA Pool*, *Stable Pool*, dan *Flex Pool* (kuota jendela waktu).
* **Analisis Margin:** Mengandalkan arbitrase *prompt caching* DeepSeek ($0.003/1M = ~Rp 48/1M) dan varian kuantisasi NVFP4. Pada paket Unlimited Rp 20.000, margin didapat dari pengguna yang tidak menghabiskan kuota atau beralih ke jam sepi (*off-peak*).

### 2. [NusaGate](https://nusagate.com/models)
* **Model Bisnis:** Pay-as-you-go murni dengan transparansi diskon *Prompt Caching* 10% dari harga input penuh.
* **Strategi Harga:** Menetapkan harga di kisaran menengah-ekonomis:
  * `deepseek-v4.1-flash`: **Rp 900 input / Rp 3.200 output** (Cache hit: **Rp 90**).
  * `qwen3.8-flash`: **Rp 900 input / Rp 2.800 output** (Cache hit: **Rp 90**).
  * `glm-5.3-flash`: **Rp 1.100 input / Rp 3.000 output** (Cache hit: **Rp 110**).
  * `kimi-k3`: **Rp 17.000 input / Rp 89.000 output** (Cache hit: **Rp 1.700**).
  * `gpt-6-luna`: **Rp 600 input / Rp 3.000 output** (Cache hit: **Rp 60**).
* **Analisis Margin:** Margin kotor NusaGate berkisar antara **50% – 70%** dari harga modal upstream resmi, menjadikannya acuan paling realistis untuk bisnis gateway yang sehat dan stabil.

### 3. [OneAPI Indonesia](https://oneapi.id/models)
* **Model Bisnis:** Agregator 28 model dari 9 provider dengan kuota gratis untuk 4 model dan diskon 20%–70% dibanding harga vendor asli.
* **Fitur Khusus:** Mendukung fitur `:online` (Web Search bawaan seharga $0.005 per pencarian) dan integrasi ganda OpenAI SDK (`/v1/chat/completions`) serta Anthropic SDK (`/v1/messages`).
* **Catatan Reputasi:** Pada audit independen [BazaarLink Probe](https://bazaarlink.ai/en/probe/relay/api.oneapi.id), tercatat tingkat pergantian model (*model substitution*) sebesar 57% pada model Claude Opus dan Sonnet demi mengejar harga diskon.

### 4. [NilovrAI](https://nilovr.com/pricing/)
* **Model Bisnis:** Penjualan paket kredit (1 Kredit = Rp 400, top up mulai Rp 10.000 via QRIS).
* **Struktur Pemotongan:** Menghitung total token gabungan (Input + Output) dikalikan tarif kredit model:
  * `deepseek-v4-pro`: 1.15 kredit / 1M token (≈ **Rp 460 / 1M token**).
  * `glm-5.2`: 1.25 kredit / 1M token (≈ **Rp 500 / 1M token**).
  * `deepseek-v4-flash`, `glm-5.3-flash`, `mimo-v2.6-pro`, `qwen3.8-flash`: 2 kredit / 1M token (≈ **Rp 800 / 1M token**).
* **Kelebihan:** Sistem kredit membuat pengguna tidak pusing menghitung rasio input vs output, dan kredit tidak pernah hangus.

### 5. [TokenFlow](https://tokenflow.my.id/)
* **Model Bisnis:** Penjualan kuota token bervolume besar (Flash Sale mulai Rp 24.000 untuk 100M token dasar hingga Rp 179.000 untuk 1B token dasar) dengan masa aktif 28 hari (sisa token terakumulasi jika top up ulang).
* **Sistem Multiplier:**
  * Model dasar / hemat (misal Kimi K2.7 Code): **1×** (1 token request = 1 token paket).
  * Model flash / populer (`deepseek-v4.1-flash`, `glm-5.3-flash`, `mimo-v2.6-flash`): **2× s/d 2.56×** (1 token request memotong 2 s/d 2.56 token paket).
  * Model flagship frontier (`gemini-4-argon`: **60×**, `gpt-6-astra`: **42×**).
* **Analisis:** Mengunci arus kas di muka (*upfront cashflow*) dengan paket minimum Rp 24.000, sangat disukai pengguna yang tidak ingin sering-sering top up.

### 6. [CleveCode](https://clevecode.com/)
* **Model Bisnis:** Akses model frontier berbasis langganan bulanan mikro ($1/bulan dapat $10 kredit AI, $5/bulan dapat $35 kredit, $10/bulan dapat $80 kredit, dan $20/bulan dapat $170 kredit).
* **Analisis Margin:** Memanfaatkan subsidi silang (*cross-subsidization*) dan pembelian kuota grosir (*wholesale bulk*). Pengguna yang membayar $1 mendapatkan saldo nominal 10x lipat, namun pemakaian dibatasi pada model open-weight dan rate limit tertentu.

---

## 4. Rekomendasi Penetapan Harga untuk Gateway Anda (Katalis AI Gateway)

Jika Anda ingin bersaing dan merebut pasar dari provider-provider di atas, berikut adalah rekomendasi strategi penetapan harga yang **lebih murah dari NusaGate dan OneAPI**, tetapi **jauh lebih aman dan menguntungkan dibanding perang harga ekstrem Nutaraline**:

1. **Model Flagship Coding: `deepseek-v4.1-flash`**
   * Pasang di tarif **Rp 95 input / Rp 190 output per 1M token** (dengan tarif **Cache Hit Rp 48 / 1M**).
   * *Posisi Pasar:* Jauh lebih murah dibanding NusaGate (Rp 900 / Rp 3.200), namun menghasilkan margin bersih **~50%** bagi Anda setiap kali sesi *coding agent* mengalami *cache hit*.
2. **Model Multimodal Cepat: `glm-5.3-flash` & `qwen3.8-flash`**
   * Pasang di tarif **Rp 150 input / Rp 350 output per 1M token**.
   * *Posisi Pasar:* Sangat kompetitif untuk agen visual dan pencarian data, dengan biaya modal upstream DeepInfra/SiliconFlow hanya ~$0.075 / 1M (~Rp 1.200).
3. **Model Penalaran Berat: `deepseek-v4-pro`**
   * Pasang di tarif **Rp 1.500 input / Rp 3.500 output per 1M token**.
   * *Posisi Pasar:* Mengalahkan NusaGate (Rp 4.000 / Rp 12.000) dan OneAPI (Rp 7.360 / Rp 22.240).
4. **Fitur "Pancingan": Kuota Harian Gratis 2 Juta Token**
   * Hubungkan model `GLM-4.7-Flash` dari [Z.ai](https://docs.z.ai/guides/overview/pricing) yang modalnya **Rp 0 (gratis dari provider)** sebagai fitur bonus pendaftaran harian. Ini meniru strategi OneAPI (4 model gratis) tanpa mengeluarkan biaya operasional token sepeser pun.
