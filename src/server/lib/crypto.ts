import { createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getHmacSecret(): string {
  const secret = process.env.HMAC_SECRET;
  if (!secret) throw new Error("HMAC_SECRET environment variable is required");
  return secret;
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is required");
  return Buffer.from(key, "hex");
}

/**
 * Hash a CPF using HMAC-SHA256.
 * This produces a deterministic, irreversible hash for cache lookups.
 * HMAC (vs plain SHA) prevents rainbow table attacks on the ~200M valid CPFs.
 */
export function hashCpf(cpf: string): string {
  const normalized = cpf.replace(/\D/g, "");
  return createHmac("sha256", getHmacSecret()).update(normalized).digest("hex");
}

/**
 * Encrypt a value using AES-256-GCM.
 * Returns: iv:authTag:ciphertext (all hex-encoded)
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a value encrypted with AES-256-GCM.
 * Expects format: iv:authTag:ciphertext (all hex-encoded)
 */
export function decrypt(encryptedValue: string): string {
  const [ivHex, authTagHex, ciphertext] = encryptedValue.split(":");
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted value format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Hash an API token for storage (we never store tokens in plaintext).
 */
export function hashToken(token: string): string {
  return createHmac("sha256", getHmacSecret()).update(token).digest("hex");
}

/**
 * SDK session tokens — stateless, HMAC-signed, short-lived.
 *
 * Prevents image uploads from outside the SDK:
 * 1. SDK requests a session before opening the camera
 * 2. Session contains a nonce + expiry, signed with HMAC
 * 3. Image uploads require a valid session token
 * 4. Sessions are single-use (nonce checked server-side)
 */

const SESSION_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function createSessionToken(): { sessionId: string; expiresAt: number } {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${nonce}:${expiresAt}`;
  const signature = createHmac("sha256", getHmacSecret())
    .update(`session:${payload}`)
    .digest("hex");

  return {
    sessionId: `${payload}:${signature}`,
    expiresAt,
  };
}

export function validateSessionToken(sessionId: string): { valid: boolean; nonce: string; error?: string } {
  const parts = sessionId.split(":");
  if (parts.length !== 3) {
    return { valid: false, nonce: "", error: "Formato de sessao invalido" };
  }

  const [nonce, expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr!, 10);

  // Verify signature
  const expectedSig = createHmac("sha256", getHmacSecret())
    .update(`session:${nonce}:${expiresAtStr}`)
    .digest("hex");

  const sigBuf = Buffer.from(signature ?? "", "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, nonce: nonce!, error: "Sessão inválida" };
  }

  // Check expiry
  if (Date.now() > expiresAt) {
    return { valid: false, nonce: nonce!, error: "Sessão expirada" };
  }

  return { valid: true, nonce: nonce! };
}

// In-memory map of used nonces with per-entry expiry timestamps
const usedNonces = new Map<string, number>();

// Evict expired nonces every minute
setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiresAt] of usedNonces) {
    if (now > expiresAt) {
      usedNonces.delete(nonce);
    }
  }
}, 60 * 1000).unref();

export function markSessionUsed(nonce: string): boolean {
  if (usedNonces.has(nonce)) {
    return false; // Already used
  }
  // Store nonce until the session TTL elapses
  usedNonces.set(nonce, Date.now() + SESSION_TTL_MS);
  return true;
}
