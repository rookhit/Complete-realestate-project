import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// TOTP (RFC 6238): 6 digits, 30-second steps, HMAC-SHA1 — what Google Authenticator, Authy,
// 1Password etc. expect. Implemented on node:crypto, no extra package.

const STEP_SECONDS = 30;
const DIGITS = 6;
// Accept the previous and next step too, for clock drift between phone and server.
const DRIFT_STEPS = 1;
const SECRET_BYTES = 20;
const ISSUER = "Nepal Bhoomi";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return binary.toString().padStart(DIGITS, "0");
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

// The link authenticator apps understand (also what a QR code encodes).
export function totpUri(secret: string, accountEmail: string): string {
  const label = encodeURIComponent(`${ISSUER}:${accountEmail}`);
  const params = new URLSearchParams({ secret, issuer: ISSUER, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// Returns the time step the code belongs to, or null. Steps at or below lastUsedStep are
// refused, so a code can't be replayed (store the returned step as the new lastUsedStep).
export function verifyTotp(secret: string, code: string, lastUsedStep: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secret);
  const current = Math.floor(Date.now() / 1000 / STEP_SECONDS);

  for (let drift = -DRIFT_STEPS; drift <= DRIFT_STEPS; drift++) {
    const step = current + drift;
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    if (timingSafeEqual(Buffer.from(hotp(key, step)), Buffer.from(code))) return step;
  }
  return null;
}

// ─── Secret encryption at rest ────────────────────────────────────────────────
// AES-256-GCM with TOTP_ENCRYPTION_KEY (32 random bytes, base64). The user id is bound in as
// additional authenticated data, so a ciphertext copied onto another user row won't decrypt.
// Read lazily, so the rest of the API starts without the key.

function encryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must be set to 32 random bytes, base64-encoded");
  }
  return key;
}

export function encryptTotpSecret(secret: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64")}`;
}

export function decryptTotpSecret(stored: string, userId: string): string {
  const [version, payload] = stored.split(":");
  if (version !== "v1" || !payload) throw new Error("Unknown TOTP secret format");
  const data = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

// ─── Recovery codes ───────────────────────────────────────────────────────────
// Shown once, stored only as SHA-256 hashes. Format XXXX-XXXX (40 random bits each; guessing
// is also capped by the per-IP and per-user 2FA limits).

export const RECOVERY_CODE_COUNT = 8;

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const code = base32Encode(randomBytes(5));
    return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
  });
}
