import test from "node:test";
import assert from "node:assert/strict";
import { unlockLegacySalaryVault } from "./legacySalaryVault.js";

const legacyRecord = {
  ciphertext:
    "Z5XIQWZZZo7By+2dOzKLubT6PAbWmDSJBN19jm2KZMrvcpAt778WL6rqsxCVpTxDBlUAqSw8ZgPj2eQ0MpQv7+q/lb33k+u/w0AGRR9G",
  nonce: "tncoGcj3yIICQsgO",
  salt: "KOtqqIRauns6EwsEvGarVg==",
  format_version: 1,
  key_version: 1,
  revision: 1,
};

test("decrypts a legacy vault for migration without returning a client key", async () => {
  const payload = await unlockLegacySalaryVault(
    legacyRecord,
    "legacy-passphrase-for-test",
  );

  assert.deepEqual(payload, {
    settings: { dailyWage: "123" },
    attendance: {},
    payslips: [],
  });
});

test("rejects a wrong legacy passphrase without exposing ciphertext contents", async () => {
  await assert.rejects(
    unlockLegacySalaryVault(legacyRecord, "wrong-passphrase-for-test"),
    /Unable to migrate the salary vault/,
  );
});
