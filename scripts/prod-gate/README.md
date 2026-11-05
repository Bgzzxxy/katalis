# Production Gate — Katalis AI Gateway

Operational checklist for `Implementation Plan.md` §4. It separates what a
script can verify **offline** from what needs a real SDK, a real upstream, or a
real device.

## 1. Automated offline gate

```bash
bun test apps/api/tests/production-gate.test.ts
```

Requirements: local Postgres (`katalis_test`) + Redis reachable through
`.env.test`. No paid upstream is contacted — the tests start fake upstream
servers on ephemeral ports (see `apps/api/tests/helpers/upstream-mock.ts`).

Current status (verified): `10 pass / 0 fail`, 163 `expect()` calls.

## 2. Gate item → coverage map

| §4 gate item | Automated test | Manual step |
|---|---|---|
| Backend unit & integration tests green | Whole suite: `bun test apps/api/tests` (0 failed) | — |
| Frontend build has no type warnings | `bun run typecheck` then `bun run build` | — |
| `/v1/chat/completions` driven by the real OpenAI Python & Node SDKs | `Gate 1: OpenAI SDK wire compatibility` — request shape, `chat.completion` response, 401 `authentication_error` envelope, `ModelList` shape | §3 (real SDKs against the staging URL) |
| Upstream failure → auto-failover without charging the user | `Gate 2: upstream failover charges only the successful call` — primary 503 → secondary 200 bills only the successful call; both 503 → 502 with Rp 0 debited and no `usage_logs` row | §4 (kill one real upstream) |
| Forged QRIS webhook without HMAC → HTTP 403 | `Gate 3: /api/webhooks/qris rejects requests without a valid HMAC` — missing header, wrong signature, plus a positive control | — |
| Catalog has no drift between endpoints and source | `Gate 4: catalog contract has no drift between endpoints and the source` — id sets and prices of `/v1/models`, `/api/models`, `MODEL_CATALOG` | — |
| Responsive layout + WCAG ≥ 4.5:1 contrast on `#F0EEE8` / `#FAF9F5` | Design-token allowlist (`apps/web/tests/qa/design-compliance.qa.test.ts`) | §5 (real devices + contrast measurement) |

Test names in the table refer to the `describe` blocks in
`apps/api/tests/production-gate.test.ts`.

## 3. Manual — real OpenAI SDKs against the gateway

These cannot run offline: they need the official SDK packages and a live
gateway process.

### 3.1 Start the gateway

```bash
# Postgres + Redis must already be running; .env supplies DATABASE_URL / REDIS_URL.
bun run --cwd apps/api dev        # listens on PORT, default 3000
```

Create one API key in the dashboard (or `POST /api/keys` with a member session)
and export it:

```bash
export KATALIS_KEY="sk-ktl-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export KATALIS_BASE="http://127.0.0.1:3000/v1"
```

### 3.2 Python SDK

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install "openai>=1.30"
```

```python
# scripts/prod-gate/sdk_smoke.py
import os
from openai import OpenAI, AuthenticationError

client = OpenAI(
    api_key=os.environ["KATALIS_KEY"],
    base_url=os.environ["KATALIS_BASE"],
)

# 1. ModelList parses into the SDK's typed model list.
for model in client.models.list().data:
    print(model.id, model.owned_by)

# 2. ChatCompletion parses, including usage.
resp = client.chat.completions.create(
    model="qwen3-max",
    messages=[{"role": "user", "content": "Balas satu kalimat singkat."}],
    temperature=0.7,
    max_tokens=64,
)
assert resp.object == "chat.completion"
assert resp.choices[0].message.role == "assistant"
assert resp.usage.prompt_tokens > 0
print(resp.choices[0].message.content)

# 3. A bad key must raise AuthenticationError (the SDK keys off
#    error.type == "authentication_error"), not a bare APIStatusError.
try:
    OpenAI(api_key="sk-ktl-invalid000000000000000000000000",
           base_url=os.environ["KATALIS_BASE"]).chat.completions.create(
        model="qwen3-max", messages=[{"role": "user", "content": "x"}])
    raise SystemExit("expected AuthenticationError")
except AuthenticationError as err:
    print("ok: AuthenticationError ->", err.status_code)
```

```bash
python scripts/prod-gate/sdk_smoke.py
```

### 3.3 Node SDK

```bash
npm install openai        # or: bun add openai
```

```js
// scripts/prod-gate/sdk_smoke.mjs
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.KATALIS_KEY,
  baseURL: process.env.KATALIS_BASE,
});

for await (const model of client.models.list()) console.log(model.id);

const resp = await client.chat.completions.create({
  model: "qwen3-max",
  messages: [{ role: "user", content: "Balas satu kalimat singkat." }],
  temperature: 0.7,
  max_tokens: 64,
});
if (resp.object !== "chat.completion") throw new Error("bad object");
if (resp.choices[0].message.role !== "assistant") throw new Error("bad role");
if (!resp.usage?.prompt_tokens) throw new Error("missing usage");
console.log(resp.choices[0].message.content);

try {
  await new OpenAI({
    apiKey: "sk-ktl-invalid000000000000000000000000",
    baseURL: process.env.KATALIS_BASE,
  }).chat.completions.create({
    model: "qwen3-max",
    messages: [{ role: "user", content: "x" }],
  });
  throw new Error("expected AuthenticationError");
} catch (err) {
  if (err?.constructor?.name !== "AuthenticationError") throw err;
  console.log("ok: AuthenticationError ->", err.status);
}
```

```bash
node scripts/prod-gate/sdk_smoke.mjs
```

Pass criteria: no exception on the happy path, both model lists print every
catalog id, and an invalid key raises `AuthenticationError` in both SDKs.

### 3.4 Streaming (optional, same gate item)

Add `stream: true` to the request and assert the SDK yields `ChatCompletionChunk`
objects terminated by `[DONE]`. The proxy forces `stream_options.include_usage`
so the final chunk carries `usage`.

## 4. Manual — kill a real upstream

The offline test proves the failover *logic*; this proves the *deployment*.

1. Point the gateway at two real providers, e.g.
   `UPSTREAM_SILICONFLOW_BASE_URL` + `UPSTREAM_SILICONFLOW_API_KEY` and
   `UPSTREAM_VOLCENGINE_BASE_URL` + `UPSTREAM_VOLCENGINE_API_KEY`.
2. Record the wallet (`GET /api/billing/usage` or the dashboard) and send one
   request to `qwen3-max` — its route order is SILICONFLOW → VOLCENGINE.
3. Block the primary: set `UPSTREAM_SILICONFLOW_BASE_URL` to an unreachable
   host (e.g. `http://127.0.0.1:9`) and restart the API.
4. Send the same request again. Expected: HTTP 200 from VOLCENGINE, one
   `usage_logs` row with `upstream_provider = 'VOLCENGINE'`, and the wallet
   debited exactly once (by the successful call's tokens).
5. Block both providers. Expected: HTTP 502 with
   `{"error":{"type":"api_error","code":"upstream_error",...}}`, **zero** debit,
   no new `usage_logs` row.

```sql
-- Inspect attribution and charge after step 4.
SELECT upstream_provider, prompt_tokens, completion_tokens, cost_charged_idr
FROM usage_logs ORDER BY id DESC LIMIT 5;
```

## 5. Manual — responsive + contrast

Serve the built frontend behind the API's reverse proxy (same origin, so
`/api` and `/v1` resolve), then:

1. Chrome DevTools device toolbar: 360×640 (mobile) and 1440×900 (desktop).
   Every page must be usable with no horizontal scroll.
2. Measure contrast of body text on `#F0EEE8` and `#FAF9F5` with Lighthouse or
   the axe DevTools extension. Required: WCAG AA ≥ 4.5:1 for normal text.
3. Confirm the palette stays inside the design tokens — no gradient, no hex
   outside `#F0EEE8 #FAF9F5 #282824 #B77A45 #77746B #DCD8CE #54836A #C45E52`.

## 6. Webhook smoke against staging (optional)

The offline gate covers signature rejection with the real HMAC routine. To
rehearse the provider's exact wire format, capture one real TriPay/Midtrans
callback (or their sandbox simulator) and replay it:

```bash
curl -i -X POST "$BASE/api/webhooks/qris" \\
  -H 'content-type: application/json' \\
  -H "x-tripay-signature: $(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$QRIS_WEBHOOK_SECRET" -hex | awk '{print $2}')" \\
  --data-raw "$BODY"
```

Expected: `200 {"ok":true}`; replaying the same body credits nothing twice.
Sending the same body with any other signature gives `403 INVALID_SIGNATURE`
and leaves the invoice `PENDING`.
