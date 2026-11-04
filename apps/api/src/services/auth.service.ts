import { eq } from "drizzle-orm";
import { Algorithm, hash, verify as verifyArgon2 } from "@node-rs/argon2";
import { sign, verify as verifyJwt } from "hono/jwt";
import type { Db } from "../db";
import { users } from "../db/schema";
import { toIdr } from "../db/money";
import { AppError } from "../middleware/error-handler";

export type SessionUser = { id: string; email: string };

export type PublicUser = {
  id: string;
  email: string;
  wallet_balance_idr: number;
  unlimited_expires_at: Date | null;
};

export type RegisterResult = {
  id: string;
  email: string;
};

type UserRow = {
  id: string;
  email: string;
  passwordHash: string | null;
  walletBalanceIdr: string;
  unlimitedExpiresAt: Date | null;
};

const ARGON_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

// Timing dummy: a real Argon2id hash generated at module load with the same options
// as user passwords. Used on the "unknown email" / "no password" login paths so that
// they consume comparable time to the valid-account path, mitigating email
// enumeration through response-latency analysis.
const DUMMY_ARGON_HASH_PROMISE: Promise<string> = hashPassword(
  "katalis-timing-dummy",
);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INVALID_CREDENTIALS = "Email atau password salah";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await verifyArgon2(passwordHash, password);
  } catch {
    return false;
  }
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    wallet_balance_idr: toIdr(row.walletBalanceIdr),
    unlimited_expires_at: row.unlimitedExpiresAt,
  };
}

export async function register(
  db: Db,
  input: { email: string; password: string },
): Promise<RegisterResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  try {
    const [row] = await db
      .insert(users)
      .values({ email: normalizedEmail, passwordHash })
      .returning({ id: users.id, email: users.email });

    return row;
  } catch (err) {
    if (isEmailTaken(err)) {
      throw new AppError(400, "EMAIL_TAKEN", "Email sudah terdaftar", {
        type: "validation_error",
        param: "email",
      });
    }
    if (isValueTooLong(err)) {
      throw new AppError(400, "VALIDATION_ERROR", "Email melebihi batas panjang maksimum", {
        type: "validation_error",
        param: "email",
      });
    }
    throw err;
  }
}

export async function login(
  db: Db,
  input: { email: string; password: string },
): Promise<{ user: PublicUser; session: SessionUser }> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      walletBalanceIdr: users.walletBalanceIdr,
      unlimitedExpiresAt: users.unlimitedExpiresAt,
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!row || !row.passwordHash) {
    // Run dummy Argon2 verification to equalize latency with the valid-account path,
    // closing the timing oracle that allows attackers to enumerate registered emails.
    const dummyHash = await DUMMY_ARGON_HASH_PROMISE;
    await verifyPassword(input.password, dummyHash);
    throw invalidCredentials();
  }

  const valid = await verifyPassword(input.password, row.passwordHash);
  if (!valid) throw invalidCredentials();

  const user = toPublicUser(row);
  return { user, session: { id: user.id, email: user.email } };
}

export async function signSessionToken(
  session: SessionUser,
  jwtSecret: string,
): Promise<string> {
  return sign(
    {
      sub: session.id,
      email: session.email,
      exp: Math.floor(Date.now() / 1000) + 604800,
    },
    jwtSecret,
    "HS256",
  );
}

export async function verifySessionToken(
  token: string,
  jwtSecret: string,
): Promise<SessionUser> {
  let payload: { sub?: unknown; email?: unknown };
  try {
    payload = (await verifyJwt(token, jwtSecret, "HS256")) as {
      sub?: unknown;
      email?: unknown;
    };
  } catch {
    throw new AppError(401, "UNAUTHENTICATED", "Sesi tidak valid", {
      type: "auth_error",
    });
  }

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new AppError(401, "UNAUTHENTICATED", "Sesi tidak valid", {
      type: "auth_error",
    });
  }

  // Defend against validly-signed tokens containing non-UUID sub which would cause
  // downstream PostgreSQL queries (eq(users.id, ...)) to throw 22P02 and yield a 500.
  if (!UUID_REGEX.test(payload.sub)) {
    throw new AppError(401, "UNAUTHENTICATED", "Sesi tidak valid", {
      type: "auth_error",
    });
  }

  return { id: payload.sub, email: payload.email };
}

export async function getPublicUser(
  db: Db,
  userId: string,
): Promise<PublicUser> {
  if (!UUID_REGEX.test(userId)) {
    throw new AppError(401, "UNAUTHENTICATED", "Sesi tidak valid", {
      type: "auth_error",
    });
  }

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      walletBalanceIdr: users.walletBalanceIdr,
      unlimitedExpiresAt: users.unlimitedExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    throw new AppError(401, "UNAUTHENTICATED", "Sesi tidak valid", {
      type: "auth_error",
    });
  }

  return toPublicUser(row);
}

function invalidCredentials(): AppError {
  return new AppError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS, {
    type: "auth_error",
  });
}

type PgError = { code?: string; constraint_name?: string };

function isEmailTaken(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const top = err as PgError;
  const cause = (err as { cause?: unknown }).cause as PgError | undefined;
  return isEmailUniqueViolation(top) || isEmailUniqueViolation(cause);
}

function isEmailUniqueViolation(err: PgError | undefined): boolean {
  return (
    err?.code === "23505" && err.constraint_name === "users_email_unique"
  );
}

function isValueTooLong(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const top = err as PgError;
  const cause = (err as { cause?: unknown }).cause as PgError | undefined;
  return top?.code === "22001" || cause?.code === "22001";
}