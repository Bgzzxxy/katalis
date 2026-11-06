#!/usr/bin/env bash
# One-command production bring-up for Katalis AI Gateway.
#
#   ./scripts/deploy.sh            # build, migrate, start, health-check
#   ./scripts/deploy.sh --status   # show container state + health
#   ./scripts/deploy.sh --logs     # follow API logs
#
# Prerequisite: `.env` filled in (start from `.env.production`), docker compose
# installed. Nothing here writes secrets to the repo.
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1
COMPOSE="docker compose"

die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
ok() { printf '\033[32m%s\033[0m\n' "$*"; }

require_env() {
  local file=$1
  [ -f "$file" ] || die "File $file tidak ada. Jalankan: cp .env.production .env lalu isi nilainya."
  for key in DATABASE_URL REDIS_URL JWT_SECRET CORS_ORIGINS; do
    local value
    value=$(grep -E "^${key}=" "$file" | head -1 | cut -d= -f2- || true)
    case "$value" in
      ""|"<"*) die "$key belum diisi di $file." ;;
    esac
  done
}

case "${1:-}" in
  --status)
    $COMPOSE ps
    curl -fsS "http://127.0.0.1:3000/api/health" && echo
    exit 0
    ;;
  --logs)
    $COMPOSE logs -f api
    exit 0
    ;;
  "")
    ;;
  *)
    die "Opsi tidak dikenal: $1"
    ;;
esac

command -v docker >/dev/null || die "docker tidak terpasang."
require_env .env

# POSTGRES_PASSWORD drives the compose DATABASE_URL; it must exist even though
# the API itself only ever sees the assembled URL.
grep -qE '^POSTGRES_PASSWORD=' .env || die "POSTGRES_PASSWORD belum ada di .env (dipakai docker-compose untuk membuat database)."

ok "1/5 membangun image..."
$COMPOSE build

ok "2/5 menyalakan Postgres + Redis..."
$COMPOSE up -d postgres redis
# Wait for healthy without guessing a sleep duration.
for _ in $(seq 1 60); do
  if $COMPOSE ps --format json 2>/dev/null | grep -q '"Health":"healthy"'; then :; fi
  if [ "$($COMPOSE ps --status running --services | wc -l)" -ge 2 ]; then break; fi
  sleep 1
done

ok "3/5 menerapkan skema database..."
$COMPOSE run --rm --entrypoint bun api node_modules/.bin/drizzle-kit push --config drizzle.config.ts \
  || die "Migrasi gagal. Periksa DATABASE_URL dan log: $COMPOSE logs api"

ok "4/5 menyalakan API + web..."
$COMPOSE up -d api web

ok "5/5 memeriksa kesehatan..."
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
    ok "API sehat."
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null 2>&1 || {
  $COMPOSE logs --tail 40 api
  die "API tidak sehat setelah 60 detik."
}

PORT_VALUE=$(grep -E '^WEB_PORT=' .env | head -1 | cut -d= -f2- || true)
PORT_VALUE=${PORT_VALUE:-8080}
ok "Selesai. Web: http://<IP-server>:${PORT_VALUE}  ·  API: http://127.0.0.1:3000"
ok "Cek kredensial upstream/pembayaran: ./scripts/preflight.sh"
