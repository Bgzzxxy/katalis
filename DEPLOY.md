# Deploy Katalis AI Gateway

Satu halaman. Setelah repo di-clone, yang perlu kamu lakukan hanya **mengisi nilai** — sisanya sudah diotomasi.

## Ringkas

```bash
cp .env.production .env     # template berisi placeholder
nano .env                   # isi semua <...> (lihat tabel di bawah)
./scripts/preflight.sh      # pastikan tidak ada yang kosong; rahasia tidak dicetak
./scripts/deploy.sh         # build → migrate → up → health check
```

Hasil: web di `http://<IP-server>:8080`, API same-origin di bawah `/api` dan `/v1`.

---

## 1. Isi `.env`

| Variabel | Wajib | Cara mendapatkan |
|---|---|---|
| `DATABASE_URL` | ya | Otomatis oleh compose dari `POSTGRES_PASSWORD`; untuk host langsung isi manual |
| `REDIS_URL` | ya | `redis://redis:6379` (compose) atau `redis://127.0.0.1:6379` |
| `JWT_SECRET` | ya | `openssl rand -hex 32` |
| `CORS_ORIGINS` | ya | Origin web publik, mis. `https://katalis.sh` |
| `COOKIE_SECURE` | ya | `true` bila HTTPS |
| `UPSTREAM_<PROVIDER>_API_KEY` | minimal 1 | Dashboard SiliconFlow / DeepSeek / Zhipu / Volcengine |
| `TRIPAY_API_KEY`, `TRIPAY_MERCHANT_CODE` | untuk pembayaran | Dashboard TriPay |
| `QRIS_WEBHOOK_SECRET` | untuk pembayaran | Dashboard TriPay (harus sama persis) |
| `POSTGRES_PASSWORD` | ya (compose) | Buat sendiri: `openssl rand -hex 16` |
| `WEB_PORT` | tidak | Default `8080` |

Model yang dilayani mengikuti provider mana yang kamu isi:

| Model | Upstream yang dipakai |
|---|---|
| `deepseek-v4-pro`, `deepseek-v4.1-flash` | DeepSeek → SiliconFlow → Volcengine |
| `qwen3-max`, `kimi-k2`, `doubao-pro` | SiliconFlow / Volcengine |
| `glm-5.3-flash`, `glm-4.6v` | Zhipu |
| `hunyuan-lora-coder` | SiliconFlow (LoRA) + paket Unlimited |

Provider yang dikosongkan dilewati otomatis; bila **semua** route sebuah model kosong, request model itu menjawab 502 `upstream_error`.

## 2. Webhook pembayaran

Di dashboard TriPay, setel callback ke:

```
https://<domain-anda>/api/webhooks/qris
```

Signature diverifikasi dari header `x-tripay-signature` (HMAC-SHA256 atas body mentah memakai `QRIS_WEBHOOK_SECRET`). Request tanpa signature sah ditolak **403**.

## 3. Perintah harian

| Perintah | Fungsi |
|---|---|
| `./scripts/preflight.sh` | Cek kelengkapan kredensial (tanpa mencetak rahasia) |
| `./scripts/deploy.sh --status` | Status container + health API |
| `./scripts/deploy.sh --logs` | Ikuti log API |
| `docker compose down` | Hentikan semuanya (data Postgres tetap di volume) |
| `docker compose up -d --build` | Deploy ulang setelah `git pull` |

## 4. Tanpa Docker

```bash
bun install
cp .env.production .env && nano .env        # isi nilai, arahkan host ke 127.0.0.1
bun run db:push                             # buat skema
bun run apps/api/src/index.ts               # API di :3000
bun run build && bun run --cwd apps/web preview --host 0.0.0.0   # web di :4173
```

`vite preview` sudah mem-proxy `/api` dan `/v1` ke `:3000`, jadi satu origin tetap terjaga.

## 5. Checklist sebelum menerima uang nyata

- [ ] `./scripts/preflight.sh` keluar dengan **0**
- [ ] `curl -s https://<domain>/api/health` → `{"status":"ok","db":"up","redis":"up"}`
- [ ] Kirim satu request nyata dengan salah satu API key dari `/keys`
- [ ] Buat tagihan QRIS, bayar, dan pastikan saldo bertambah **sekali saja**
- [ ] Webhook palsu tanpa signature → `403` (lihat `scripts/prod-gate/README.md`)
- [ ] Lepas `COOKIE_SECURE=false` untuk produksi HTTPS

## 6. Yang belum diotomasi (butuh kamu)

- Mengisi kredensial di atas — tidak ada agent yang boleh memegang rahasia.
- Domain + sertifikat TLS (pasang reverse proxy seperti Caddy di depan `:8080`, atau terminasi TLS di load balancer).
- Uji upstream dengan uang nyata; semua tes repo memakai upstream tiruan.
