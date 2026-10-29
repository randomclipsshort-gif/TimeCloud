const FORMAT_VERSION = 1;
const KEY_VERSION = 1;
const KDF_ITERATIONS = 310_000;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const MAX_CIPHERTEXT_LENGTH = 100_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("This browser does not support secure salary-vault encryption.");
  }
  return globalThis.crypto;
}

function encodeBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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

async function deriveKey(passphrase, salt) {
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
    ["encrypt", "decrypt"],
  );
}

function validatePassphrase(passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 12) {
    throw new Error("Use a vault passphrase with at least 12 characters.");
  }
}

function validatePayload(payload) {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.settings === null ||
    typeof payload.settings !== "object" ||
    payload.attendance === null ||
    typeof payload.attendance !== "object" ||
    Array.isArray(payload.attendance)
  ) {
    throw new Error("Salary vault data is invalid.");
  }
}

function getAdditionalData(keyVersion) {
  return encoder.encode(`timecloud:private-salary-vault:${FORMAT_VERSION}:${keyVersion}`);
}

export async function createSalaryVault(payload, passphrase, keyVersion = KEY_VERSION) {
  validatePassphrase(passphrase);
  validatePayload(payload);
  if (!Number.isSafeInteger(keyVersion) || keyVersion < KEY_VERSION || keyVersion > 2_147_483_647) {
    throw new Error("The salary vault key version is invalid.");
  }
  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(passphrase, salt);
  return {
    record: await encryptSalaryVault(payload, key, salt, keyVersion),
    key,
  };
}

export async function encryptSalaryVault(payload, key, salt, keyVersion = KEY_VERSION) {
  validatePayload(payload);
  if (!key || !salt || salt.length !== SALT_LENGTH ||
    !Number.isSafeInteger(keyVersion) || keyVersion < KEY_VERSION ||
    keyVersion > 2_147_483_647) {
    throw new Error("The salary vault is locked.");
  }
  const cryptoApi = getCrypto();
  const nonce = cryptoApi.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: getAdditionalData(keyVersion),
      tagLength: 128,
    },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  return {
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    nonce: encodeBase64(nonce),
    salt: encodeBase64(salt),
    format_version: FORMAT_VERSION,
    key_version: keyVersion,
  };
}

export async function unlockSalaryVault(record, passphrase) {
  validatePassphrase(passphrase);
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
  const key = await deriveKey(passphrase, salt);
  let plaintext;
  try {
    plaintext = await getCrypto().subtle.decrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: getAdditionalData(record.key_version),
        tagLength: 128,
      },
      key,
      ciphertext,
    );
  } catch {
    throw new Error("Unable to unlock the salary vault. Check the passphrase or restore a valid vault backup.");
  }

  let payload;
  try {
    payload = JSON.parse(decoder.decode(plaintext));
    validatePayload(payload);
  } catch {
    throw new Error("The encrypted salary vault is damaged or contains invalid data.");
  }

  return { payload, key, salt };
}
