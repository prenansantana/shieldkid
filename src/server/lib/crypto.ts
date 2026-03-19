import { createHmac, createCipheriv, createDecipheriv, randomBytes } from "crypto";

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
