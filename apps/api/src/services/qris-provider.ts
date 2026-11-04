import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppEnv } from "../env";

export type QrisProviderId = "TRIPAY" | "MIDTRANS";
export type QrisWebhookStatus = "PAID" | "EXPIRED" | "FAILED";

export type QrisCreateInput = {
  merchantRef: string;
  amountIdr: number;
  planType: string;
};

export type QrisCreateInvoiceResult = {
  qrisString: string;
  providerRef: string;
  expiresAt?: Date;
};

export type QrisWebhookEvent = {
  providerRef: string;
  status: QrisWebhookStatus;
};

export interface QrisProvider {
  providerId: QrisProviderId;
  createInvoice(input: QrisCreateInput): Promise<QrisCreateInvoiceResult>;
  verifySignature(headers: Headers, rawBody: string): boolean;
  parseWebhook(rawBody: string): QrisWebhookEvent | null;
}

/** Constant-time SHA-256 HMAC of the raw body equals the hex digest header.
 *  Hex must be complete (64 chars) and valid; case is normalised because
 *  Buffer.from accepts upper/lower hex, matching the provider digest formats. */
export function verifyHmacSignature(
  secret: string,
  signatureHex: string,
  rawBody: string,
): boolean {
  if (!secret) return false;
  const normalized = signatureHex.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) return false;
  const received = Buffer.from(normalized, "hex");
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest());
  return (
    received.length === 32 &&
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}

// Detail API TriPay/Midtrans below is a documented assumption, isolated here so
// it can be swapped after the provider docs are verified against a sandbox.
type TripayAdapter = QrisProvider & { secret: string };

function createTripayProvider(env: AppEnv): TripayAdapter {
  const secret = env.QRIS_WEBHOOK_SECRET ?? "";
  return {
    providerId: "TRIPAY",
    async createInvoice({ merchantRef, amountIdr }) {
      // shortcut: return a deterministic placeholder rather than calling Tripay.
      // Upgrade: call the real Tripay create-QRIS endpoint once verified.
      return {
        qrisString: `qr://tripay/${merchantRef}`,
        providerRef: `TRIPAY-${merchantRef}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };
    },
    verifySignature(headers, rawBody) {
      return verifyHmacSignature(
        secret,
        headers.get("x-tripay-signature") ?? "",
        rawBody,
      );
    },
    parseWebhook(rawBody) {
      return parseSimpleWebhook(rawBody);
    },
    secret,
  };
}

function parseSimpleWebhook(rawBody: string): QrisWebhookEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as {
      provider_ref?: unknown;
      status?: unknown;
    };
    if (typeof parsed.provider_ref !== "string") return null;
    if (
      parsed.status === "PAID" ||
      parsed.status === "EXPIRED" ||
      parsed.status === "FAILED"
    ) {
      return { providerRef: parsed.provider_ref, status: parsed.status };
    }
  } catch {
    // invalid JSON -> null
  }
  return null;
}

export function createQrisProvider(env: AppEnv): QrisProvider | null {
  // Midtrans is intentionally unsupported until its docs are verified; the
  // adapter interface above is the swap seam. Returning null when the env is
  // not configured lets billing fail with PAYMENT_GATEWAY_ERROR instead of
  // persisting a synthetic invoice.
  if (env.QRIS_PROVIDER !== "TRIPAY") return null;

  // Test mode may use the placeholder adapter without real credentials; any
  // non-test deployment must never mint a fake qr:// QRIS string.
  if (env.NODE_ENV === "test") return createTripayProvider(env);
  if (!env.TRIPAY_API_KEY || !env.TRIPAY_MERCHANT_CODE) return null;
  return createTripayProvider(env);
}