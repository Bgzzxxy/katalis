# syntax=docker/dockerfile:1

# ---- deps -------------------------------------------------------------------
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile

# ---- web build --------------------------------------------------------------
FROM deps AS web-build
WORKDIR /app
COPY tsconfig.json ./
COPY apps/web ./apps/web
RUN bun run --cwd apps/web build

# ---- runtime ----------------------------------------------------------------
FROM oven/bun:1.4-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY apps/api ./apps/api
EXPOSE 3000
# The app refuses to boot with a missing/weak DATABASE_URL, REDIS_URL or
# JWT_SECRET, so a misconfigured container fails fast instead of serving 500s.
CMD ["bun", "run", "apps/api/src/index.ts"]

FROM nginx:1.27-alpine AS web
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY scripts/deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
