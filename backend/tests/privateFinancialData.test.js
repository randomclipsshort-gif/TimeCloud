import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptPrivateFinancialData,
  encryptPrivateFinancialData,
} from "../src/services/privateFinancialData.js";

const key = Buffer.alloc(32, 0x43);
const privateData = {
  settings: { dailyWage: "2500" },
  attendance: { "2026-11-10": { base: "P2500.00" } },
  payslips: [{ id: "employee-1:2026-11-10", netPay: 2375 }],
};

test("server-managed private financial encryption round-trips per user", () => {
  const record = encryptPrivateFinancialData(privateData, key, "alice");

  assert.equal(record.encryption_version, 1);
  assert.equal(JSON.stringify(record).includes("2500"), false);
  assert.deepEqual(decryptPrivateFinancialData(record, key, "alice"), privateData);
  assert.throws(() => decryptPrivateFinancialData(record, key, "bob"));
  assert.throws(() =>
    decryptPrivateFinancialData(record, Buffer.alloc(32, 0x44), "alice"),
  );
});

test("server-managed private financial encryption rejects damaged envelopes", () => {
  const record = encryptPrivateFinancialData(privateData, key, "alice");

  assert.throws(() =>
    decryptPrivateFinancialData(
      { ...record, ciphertext: `${record.ciphertext.slice(0, -4)}AAAA` },
      key,
      "alice",
    ),
  );
  assert.throws(() =>
    decryptPrivateFinancialData({ ...record, encryption_version: 99 }, key, "alice"),
  );
});
