import test from "node:test";
import assert from "node:assert/strict";
import {
  createSalaryVault,
  encryptSalaryVault,
  unlockSalaryVault,
} from "./privateSalaryVault.js";

const samplePayload = {
  settings: {
    dailyWage: "2500",
    dailyAllowance: "100",
    overtimeMultiplier: "1.5",
    nightDifferential: "10",
  },
  attendance: {
    "2026-10-28": { base: "P2500.00", est: "P2500.00 PHP" },
  },
};

test("salary vault encrypts locally and unlocks with the recovery passphrase", async () => {
  const { record, key } = await createSalaryVault(samplePayload, "a-long-vault-passphrase");
  assert.equal(record.format_version, 1);
  assert.equal(record.key_version, 1);
  assert.equal(JSON.stringify(record).includes("2500"), false);
  assert.equal(JSON.stringify(record).includes("P2500"), false);

  const { payload } = await unlockSalaryVault(record, "a-long-vault-passphrase");
  assert.deepEqual(payload, samplePayload);

  const updated = await encryptSalaryVault(samplePayload, key, Uint8Array.from(
    atob(record.salt),
    (character) => character.charCodeAt(0),
  ));
  assert.notEqual(updated.nonce, record.nonce);
});

test("wrong passphrases and modified ciphertext fail authentication", async () => {
  const { record } = await createSalaryVault(samplePayload, "a-long-vault-passphrase");
  await assert.rejects(
    unlockSalaryVault(record, "a-different-vault-passphrase"),
    /Unable to unlock the salary vault/,
  );
  await assert.rejects(
    unlockSalaryVault({ ...record, ciphertext: `${record.ciphertext.slice(0, -4)}AAAA` }, "a-long-vault-passphrase"),
    /Unable to unlock the salary vault|damaged/,
  );
});

test("rekeying creates a new key version and requires the new passphrase", async () => {
  const { record: initial } = await createSalaryVault(samplePayload, "a-long-vault-passphrase");
  const { payload } = await unlockSalaryVault(initial, "a-long-vault-passphrase");
  const { record: rotated } = await createSalaryVault(
    payload,
    "a-new-long-vault-passphrase",
    initial.key_version + 1,
  );

  assert.equal(rotated.key_version, 2);
  await assert.rejects(
    unlockSalaryVault(rotated, "a-long-vault-passphrase"),
    /Unable to unlock the salary vault/,
  );
  assert.deepEqual(
    (await unlockSalaryVault(rotated, "a-new-long-vault-passphrase")).payload,
    samplePayload,
  );
});

test("vault passphrases must have at least twelve characters", async () => {
  await assert.rejects(
    createSalaryVault(samplePayload, "short"),
    /at least 12 characters/,
  );
});
