#!/usr/bin/env bash
# Verify that every credential the gateway needs is actually filled in — without
# ever printing a secret. Safe to run before or after deploy.
#
#   ./scripts/preflight.sh          # check .env
#   ./scripts/preflight.sh .env.prod
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
FILE=${1:-.env}

[ -f "$FILE" ] || { echo "File $FILE tidak ada." >&2; exit 1; }

REQUIRED=(DATABASE_URL REDIS_URL JWT_SECRET CORS_ORIGINS)
UPSTREAMS=(SILICONFLOW DEEPSEEK ZHIPU VOLCENGINE)
QRIS=(TRIPAY_API_KEY TRIPAY_MERCHANT_CODE QRIS_WEBHOOK_SECRET)

fail=0

value_of() {
  grep -E "^$1=" "$FILE" | head -1 | cut -d= -f2- || true
}

# A placeholder is empty or an unedited `<...>` token from .env.production.
filled() {
  local value
  value=$(value_of "$1")
  [ -n "$value" ] && [[ "$value" != "<"* ]]
}

check() { # key, why-it-matters
  if filled "$1"; then
    printf '  \033[32mOK  \033[0m %s\n' "$1"
  else
    printf '  \033[31mMISS\033[0m %-34s %s\n' "$1" "$2"
    fail=1
  fi
}

echo "== Wajib =="
for key in "${REQUIRED[@]}"; do
  check "$key" "aplikasi menolak start"
done

secret=$(value_of JWT_SECRET)
if filled JWT_SECRET && [ ${#secret} -lt 32 ]; then
  printf '  \033[31mMISS\033[0m %-34s minimal 32 karakter (ada %d)\n' "JWT_SECRET" "${#secret}"
  fail=1
fi

echo "== Upstream AI =="
up_ok=0
for provider in "${UPSTREAMS[@]}"; do
  if filled "UPSTREAM_${provider}_API_KEY"; then
    printf '  \033[32mOK  \033[0m %s\n' "UPSTREAM_${provider}_API_KEY"
    up_ok=$((up_ok + 1))
  else
    printf '  \033[33mSKIP\033[0m %-34s model via %s akan 502\n' "UPSTREAM_${provider}_API_KEY" "$provider"
  fi
done
if [ "$up_ok" -eq 0 ]; then
  printf '  \033[31mFAIL\033[0m tidak ada satu pun provider upstream\n'
  fail=1
fi

echo "== Pembayaran QRIS =="
for key in "${QRIS[@]}"; do
  check "$key" "tagihan QRIS akan 502"
done

echo
if [ "$fail" -eq 0 ]; then
  printf '\033[32mSiap deploy.\033[0m\n'
else
  printf '\033[33mMasih ada yang kosong — lihat baris MISS di atas.\033[0m\n'
fi
exit "$fail"
