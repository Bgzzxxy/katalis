import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  QrisCreateInvoiceResult,
  QrisProvider,
  QrisWebhookEvent,
} from "../../src/services/qris-provider";

export const QRIS_TEST_SECRET = "qris-test-secret-0123456789abcdef";

export function signQrisBody(rawBody: string): string {
  return createHmac("sha256", QRIS_TEST_SECRET).update(rawBody).digest("hex");
}

export function signedJson(body: unknown): {
  body: string;
  headers: Record<string, string>;
} {
  const raw = JSON.stringify(body);
  return {
    body: raw,
    headers: {
      "content-type": "application/json",
      "x-tripay-signature": signQrisBody(raw),
    },
  };
}

const PAID = "PAID" as const;
const EXPIRED = "EXPIRED" as const;
const FAILED = "FAILED" as const;

export type FakeQrisOptions = {
  failCreate?: boolean;
  expiresAt?: Date;
  providerRef?: (merchantRef: string) => string;
};

export function createFakeQrisProvider(options: FakeQrisOptions = {}): QrisProvider {
  return {
    providerId: "TRIPAY",
    async createInvoice({ merchantRef }): Promise<QrisCreateInvoiceResult> {
      if (options.failCreate) throw new Error("gateway down");
      const providerRef = options.providerRef
        ? options.providerRef(merchantRef)
        : `FAKE-${merchantRef}`;
      return {
        qrisString: `qr://fake/${providerRef}`,
        providerRef,
        expiresAt: options.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000),
      };
    },
    verifySignature(headers, rawBody) {
      const received = Buffer.from(headers.get("x-tripay-signature") ?? "", "hex");
      const expected = Buffer.from(signQrisBody(rawBody), "hex");
      return (
        received.length === 32 &&
        received.length === expected.length &&
        timingSafeEqual(received, expected)
      );
    },
    parseWebhook(rawBody): QrisWebhookEvent | null {
      try {
        const parsed = JSON.parse(rawBody) as {
          provider_ref?: unknown;
          status?: unknown;
        };
        if (typeof parsed.provider_ref !== "string") return null;
        if (parsed.status === PAID || parsed.status === EXPIRED || parsed.status === FAILED) {
          return { providerRef: parsed.provider_ref, status: parsed.status };
        }
      } catch {
        // fall through to invalid payload
      }
      return null;
    },
  };
}