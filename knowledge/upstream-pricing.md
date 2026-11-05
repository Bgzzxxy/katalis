# Harga Upstream — Sumber Resmi & Konversi IDR

Dokumen ini adalah satu-satunya rujukan audit untuk nilai
`priceInMicroPer1M` / `priceOutMicroPer1M` di
`apps/api/src/services/model-catalog.ts`.

**Tanggal pengambilan data:** 6 November 2026 (semua halaman diambil pada hari yang sama).

**Sumber yang dihitung:** hanya halaman harga resmi provider yang sudah di-wire di
`routes` katalog:

| Provider | Halaman harga resmi |
|---|---|
| SiliconFlow | https://www.siliconflow.com/pricing (+ halaman detail model `https://www.siliconflow.com/models/<slug>`) |
| DeepSeek | https://api-docs.deepseek.com/quick_start/pricing |
| Zhipu BigModel | https://bigmodel.cn/pricing |
| Volcengine Ark | https://docs.volcengine.com/docs/ark/model-pricing?lang=zh |

Berkas riset lokal `local_gateway_pricing_research.md`, blog, dan agregator **tidak**
dipakai sebagai otoritas; paling jauh hanya corroboration dan tidak mengubah nilai apa pun.

---

## 1. Kurs (FX) yang dipakai

Harga resmi dicantumkan dalam **USD** (SiliconFlow, DeepSeek) dan **CNY**
(Zhipu BigModel, Volcengine Ark). Konversi ke IDR memakai **satu kurs eksplisit**:

| Konversi | Kurs | Sumber |
|---|---|---|
| USD → IDR | **1 USD = Rp 18.132,167129** | https://open.er-api.com/v6/latest/USD — field `time_last_update_utc` = `Thu, 05 Nov 2026 00:02:31 +0000` |
| USD → CNY | **1 USD = 6,685421 CNY** | endpoint & timestamp yang sama (field `rates.CNY`) |
| CNY → IDR (turunan) | 18.132,167129 / 6,685421 = **Rp 2.712,195257 per CNY** | aritmetika dari dua baris di atas |

Cross-check independen: https://api.exchangerate-api.com/v4/latest/USD (date
`2026-11-05`) → `IDR 18132.17`, `CNY 6.69` — identik pada 2 desimal, jadi kurs di atas
dipakai apa adanya. JISDOR Bank Indonesia tidak dapat diakses (reset koneksi), sehingga
kurs pasar ini yang dicatat, bukan kurs referensi BI.

Konvensi katalog: `priceInMicroPer1M` = **IDR per 1 juta token × 1_000_000**
(micro-IDR), integer. Nilai tiap baris di bawah dibulatkan ke micro-IDR terdekat.

---

## 2. Tabel harga resmi per model

Catatan arah konversi: SiliconFlow/DeepSeek dalam USD; Zhipu/Ark dalam CNY (kolom
"USD/1M" diisi setelah dibagi kurs CNY→USD 6,685421).

| Model Katalog | Upstream model name | Provider | List price input (asli) | List price output (asli) | Input USD/1M | Output USD/1M | Sumber URL |
|---|---|---|---|---|---|---|---|
| `deepseek-v4-pro` | `deepseek-v4-pro` (= DeepSeek-V4-Pro-0813) | DeepSeek | $0.66 off-peak / $1.32 peak (cache miss) | $1.98 off-peak / $3.96 peak | 0.66 / 1.32 | 1.98 / 3.96 | https://api-docs.deepseek.com/quick_start/pricing |
| `deepseek-v4.1-flash` | `deepseek-flash` (= DeepSeek-V4.1-Flash-1017) | DeepSeek | $0.15 off-peak / $0.30 peak (cache miss) | $0.60 off-peak / $1.20 peak | 0.15 / 0.30 | 0.60 / 1.20 | https://api-docs.deepseek.com/quick_start/pricing |
| `qwen3-max` | `Qwen/Qwen3-Max` | SiliconFlow | N/A — needs vendor contact | N/A — needs vendor contact | N/A | N/A | https://www.siliconflow.com/pricing |
| `glm-5.3-flash` | `glm-5.3-flash` | Zhipu BigModel | ¥0.8 / 1M | ¥2.8 / 1M | 0.119663 | 0.418822 | https://bigmodel.cn/pricing |
| `glm-4.6v` | `glm-4.6v` | Zhipu BigModel | ¥1 / 1M (≤32K) ; ¥2 (32K–128K) | ¥3 / 1M (≤32K) ; ¥6 (32K–128K) | 0.149579 (≤32K) | 0.448738 (≤32K) | https://bigmodel.cn/pricing |
| `kimi-k2` | `moonshotai/Kimi-K2-Instruct` | SiliconFlow | $0.58 / 1M | $2.29 / 1M | 0.58 | 2.29 | https://www.siliconflow.com/models/kimi-k2-instruct |
| `doubao-pro` | `doubao-pro-32k` | Volcengine Ark | N/A — needs vendor contact | N/A — needs vendor contact | N/A | N/A | https://docs.volcengine.com/docs/ark/model-pricing?lang=zh |
| `hunyuan-lora-coder` | `katalis/hunyuan-lora-coder` / `hunyuan-coder-lora` | SiliconFlow / Ark | N/A — needs vendor contact | N/A — needs vendor contact | N/A | N/A | — |

Bukti tambahan per model (dari halaman resmi yang sama):

- **SiliconFlow `/pricing`** (tabel serverless, diambil 6 Nov 2026, semua tabel
  "Load More" diklik): DeepSeek-V4.1-Flash `$0.15 in / $0.003 cached / $0.6 out`;
  DeepSeek-V4-Pro-0813 `$1.32 / $0.044 / $3.96`; GLM-5.3-Flash
  `$0.15 / $0.03 / $0.5`; DeepSeek-V4-Pro `$1.50162 / $0.135 / $3.135`. Halaman detail
  per-model (`/models/deepseek-v4-1-flash`, `/models/deepseek-v4-pro-0813`,
  `/models/glm-5-3-flash`, `/models/kimi-k2-instruct`) menyebut angka yang sama.
  `Kimi-K2-Instruct` hanya muncul di blok "Compare with Other Models" halaman
  `/models/kimi-k2-instruct` ($0.58 / $2.29), bukan di tabel serverless utama —
  karenanya dicatat dengan URL halaman detail tersebut.
- **DeepSeek pricing**: `deepseek-flash` = DeepSeek-V4.1-Flash-1017; `deepseek-v4-pro`
  = DeepSeek-V4-Pro-0813. Off-peak = ½ peak; peak = 01:00–04:00 & 06:00–10:00 UTC,
  Mon–Fri (kecuali hari libur Tiongkok).
- **Zhipu BigModel**: GLM-5.3-Flash `输入 0.8元/M`, `输出 2.8元/M`, cache hit
  `0.23元/M`. GLM-4.6V (dari FAQ visual): input `[0,32K) 1元/M, [32K,128K) 2元/M`,
  output `[0,32K) 3元/M, [32K,128K) 6元/M`.
- **Volcengine Ark** (model list harga 6 Nov 2026): `glm-5.3-flash ¥0.80 / ¥2.80`,
  `deepseek-v4-1-flash` idle ¥1.00 / ¥4.00, peak ¥2.00 / ¥8.00,
  `deepseek-v4-pro正式版 ¥9.00 / ¥27.00`.

---

## 3. Model dengan harga resmi > 5% berbeda dari katalog → sudah diperbarui

Ambang: `|IDR_baru − IDR_lama| / IDR_lama > 5%`. Untuk harga dua tingkat
(peak/off-peak atau bertingkat panjang konteks) dipakai **rata-rata sederhana**
sebagai harga katalog tunggal, karena katalog hanya punya satu angka per model:
off-peak dan peak sama-sama berlaku, dan satu-satunya ubin panjang konteks yang
diperhitungkan adalah yang paling murah (≤32K) untuk GLM-4.6V.

| Model | Tier dasar | Input IDR/1M lama → baru | Out IDR/1M lama → baru | Δ |
|---|---|---|---|---|
| `deepseek-v4-pro` | DeepSeek, rata-rata peak/off-peak: (0.66+1.32)/2 = $0.99; (1.98+3.96)/2 = $2.97 | 27 → **17.951** (0.99 × 18.132,167129) | 110 → **53.853** (2.97 × 18.132,167129) | −33,5% / −51,0% |
| `deepseek-v4.1-flash` | DeepSeek, rata-rata: (0.15+0.30)/2 = $0.225; (0.60+1.20)/2 = $0.90 | 9 → **4.080** (0.225 × 18.132,167129) | 22 → **16.319** (0.90 × 18.132,167129) | −54,7% / −25,8% |
| `glm-5.3-flash` | Zhipu (identik dengan Ark) ¥0.8 / ¥2.8 × Rp 2.712,195257 | 2 → **2.170** | 9 → **7.594** | +8,5% / −15,6% |
| `glm-4.6v` | Zhipu tier ≤32K ¥1 / ¥3 × Rp 2.712,195257 | 5 → **2.712** | 18 → **8.137** | −45,8% / −54,8% |
| `kimi-k2` | SiliconFlow $0.58 / $2.29 × 18.132,167129 | 12 → **10.517** | 48 → **41.523** | −12,4% / −13,5% |

Nilai katalog baru (micro-IDR per 1M) untuk file `model-catalog.ts`:

```
deepseek-v4-pro      in 17_951_000   out 53_853_000
deepseek-v4.1-flash  in  4_080_000   out 16_319_000
glm-5.3-flash        in  2_170_000   out  7_594_000
glm-4.6v             in  2_712_000   out  8_137_000
kimi-k2              in 10_517_000   out 41_523_000
```
Verifikasi output ≥ input bertahan di kelima model (2.170 < 7.594; 4.080 < 16.319; dst.).


## 4. Model TANPA harga list publik → harga katalog TIDAK diubah

| Model | Alasan |
|---|---|
| `qwen3-max` | Rute katalog adalah `Qwen/Qwen3-Max` (SiliconFlow) dan `qwen3-max` (Ark). SiliconFlow **tidak memuat** model ini di halaman `/pricing` maupun `/models/llm` (pencarian menghasilkan 404 untuk `/models/qwen3-max`); Ark tidak memuat `qwen3-max` di tabel harga LLM-nya. Tidak ada harga resmi → `N/A — needs vendor contact`. Harga tetap 16.000 / 64.000 IDR. |
| `doubao-pro` | Rute utama `doubao-pro-32k` di Volcengine Ark; Ark telah mengganti jajaran Doubao dengan `doubao-seed-*` sehingga `doubao-pro-32k` tidak ada lagi di tabel harga resmi. Rute cadangan `ByteDance-Seed/Doubao-Pro` juga tidak ada di SiliconFlow (`/models/doubao-pro*` → 404). Tidak ada harga resmi → `N/A — needs vendor contact`. Harga tetap 1.000 / 4.000 IDR. |
| `hunyuan-lora-coder` | Baik `katalis/hunyuan-lora-coder` (SiliconFlow) maupun `hunyuan-coder-lora` (Ark) adalah **endpoint LoRA privat**; tidak ada entri harga publik. Harga LoRA ditentukan oleh biaya training + unit inferensi yang dinegosiasikan → `N/A — needs vendor contact`. Harga tetap 3.000 / 12.000 IDR. |

Tidak ada satu pun dari ketiga model ini yang diperkirakan; semuanya ditandai
`N/A — needs vendor contact`.

---

## 5. Catatan penting yang TIDAK diubah harganya

1. **Rute SiliconFlow untuk dua model DeepSeek tidak lagi tersedia.** Katalog
   memakai `SILICONFLOW → deepseek-ai/DeepSeek-V3` sebagai failover untuk
   `deepseek-v4-pro` dan `deepseek-v4.1-flash`; SiliconFlow hari ini hanya
   mempublikasikan `DeepSeek-V3.2`, `-V3.1-Terminus`, `-V3.1`, `-V3` (halaman
   `/models/deepseek-v3-0324` → 404, `/models/deepseek-v3` tidak muncul di
   `/models/llm`). Ini masalah **routing**, bukan harga; harga katalog dihitung dari
   rute primer (DeepSeek resmi) yang masih sah. Perubahan id rute berada di luar
   slice ini (scope hanya field harga).
2. **GLM-5.3-Flash kadang berpromo lima puluh persen** ("限时五折": input ¥0.4,
   output ¥1.4). Yang dipakai adalah tarif **standar** ¥0.8 / ¥2.8 agar harga tidak
   berayun mengikuti promo.
3. **DeepSeek off-peak hanya ½ harga**, dan jam peak adalah 01:00–04:00 &
   06:00–10:00 UTC Senin–Jumat. Rata-rata aritmetika sederhana dipakai, bukan
   tertimbang volume, karena volume peak/off-peak belum terukur.
4. **GLM-4.6V bertingkat panjang konteks.** Harga katalog memakai tier ≤32K
   (¥1 / ¥3); tier 32K–128K (¥2 / ¥6) tidak dicerminkan oleh satu angka katalog.
