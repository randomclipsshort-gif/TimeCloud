import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ENCRYPTION_VERSION = 1;
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const MAX_CIPHERTEXT_LENGTH = 1_000_000;

function getAdditionalData(userId) {
  return Buffer.from(`timecloud:private-financial-data:${ENCRYPTION_VERSION}:${userId}`);
}

function decodeBase64(value, expectedLength, label) {
  if (
    typeof value !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error(`Private financial data has invalid ${label}.`);
  }
  const decoded = Buffer.from(value, "base64");
  if (
    decoded.toString("base64") !== value ||
    (expectedLength !== null && decoded.length !== expectedLength) ||
    decoded.length === 0
  ) {
    throw new Error(`Private financial data has invalid ${label}.`);
  }
  return decoded;
}

function validateKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error("Private financial data encryption is not configured.");
  }
}

export function encryptPrivateFinancialData(data, key, userId) {
  validateKey(key);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(getAdditionalData(userId));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
    encryption_version: ENCRYPTION_VERSION,
  };
}

export function decryptPrivateFinancialData(record, key, userId) {
  validateKey(key);
  if (
    !record ||
    record.encryption_version !== ENCRYPTION_VERSION ||
    typeof record.ciphertext !== "string" ||
    record.ciphertext.length > MAX_CIPHERTEXT_LENGTH
  ) {
    throw new Error("Private financial data has an unsupported format.");
  }

  const nonce = decodeBase64(record.nonce, NONCE_LENGTH, "nonce");
  const authTag = decodeBase64(record.auth_tag, AUTH_TAG_LENGTH, "authentication tag");
  const ciphertext = decodeBase64(record.ciphertext, null, "ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(getAdditionalData(userId));
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext);
}
