import { isValidPayslipSnapshot } from "../utils/payrollHistory.js";

const FORMAT_VERSION = 1;
const KEY_VERSION = 1;
const KDF_ITERATIONS = 310_000;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const MAX_CIPHERTEXT_LENGTH = 1_000_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser does not support secure legacy-vault migration.");
  }
  return globalThis.crypto;
}

function decodeBase64(value, expectedLength, label) {
  if (typeof value !== "string" || value.length > MAX_CIPHERTEXT_LENGTH) {
    throw new Error(`The encrypted salary vault has invalid ${label}.`);
  }
  let bytes;
  try {
    bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new Error(`The encrypted salary vault has invalid ${label}.`);
  }
  if ((expectedLength && bytes.length !== expectedLength) || bytes.length === 0) {
    throw new Error(`The encrypted salary vault has invalid ${label}.`);
  }
  return bytes;
}

async function deriveLegacyKey(passphrase, salt) {
  const cryptoApi = getCrypto();
  const material = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: KDF_ITERATIONS,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

function validateLegacyPayload(payload) {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.settings === null ||
    typeof payload.settings !== "object" ||
    Array.isArray(payload.settings) ||
    payload.attendance === null ||
    typeof payload.attendance !== "object" ||
    Array.isArray(payload.attendance) ||
    (payload.payslips !== undefined &&
      (!Array.isArray(payload.payslips) ||
        !payload.payslips.every(isValidPayslipSnapshot)))
  ) {
    throw new Error("Salary vault data is invalid.");
  }
}

function getLegacyAdditionalData(keyVersion) {
  return encoder.encode(`timecloud:private-salary-vault:${FORMAT_VERSION}:${keyVersion}`);
}

export async function unlockLegacySalaryVault(record, passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 12) {
    throw new Error("Use your existing vault passphrase to migrate the data.");
  }
  if (
    !record ||
    record.format_version !== FORMAT_VERSION ||
    !Number.isSafeInteger(record.key_version) ||
    record.key_version < KEY_VERSION ||
    record.key_version > 2_147_483_647
  ) {
    throw new Error("This salary vault format is not supported by this app version.");
  }

  const salt = decodeBase64(record.salt, SALT_LENGTH, "key salt");
  const nonce = decodeBase64(record.nonce, NONCE_LENGTH, "encryption nonce");
  const ciphertext = decodeBase64(record.ciphertext, null, "encrypted data");
  const key = await deriveLegacyKey(passphrase, salt);
  let plaintext;
  try {
    plaintext = await getCrypto().subtle.decrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: getLegacyAdditionalData(record.key_version),
        tagLength: 128,
      },
      key,
      ciphertext,
    );
  } catch {
    throw new Error("Unable to migrate the salary vault. Check the passphrase or restore a valid vault backup.");
  }

  let payload;
  try {
    payload = JSON.parse(decoder.decode(plaintext));
    validateLegacyPayload(payload);
  } catch {
    throw new Error("The encrypted salary vault is damaged or contains invalid data.");
  }
  return payload;
}
