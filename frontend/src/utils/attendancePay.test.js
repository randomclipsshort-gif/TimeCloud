import test from "node:test";
import assert from "node:assert/strict";
import { getAttendanceBasePay } from "./attendancePay.js";

test("configured daily wage fills a zero base on an assigned regular shift", () => {
  assert.equal(
    getAttendanceBasePay(
      { type: "Regular", base: "P0.00", hasAssignedShift: true },
      "1800",
    ),
    1800,
  );
});

test("configured wage is prorated for a zero-base half-day record", () => {
  assert.equal(
    getAttendanceBasePay(
      {
        type: "Regular",
        shift: "Half-day",
        base: "P0.00",
        shiftStartTime: "08:00",
        shiftEndTime: "17:00",
      },
      "1800",
    ),
    900,
  );
});

test("existing base amounts and records without an eligible shift are preserved", () => {
  assert.equal(
    getAttendanceBasePay(
      { type: "Regular", base: "P1500.00", hasAssignedShift: true },
      "1800",
    ),
    1500,
  );
  assert.equal(
    getAttendanceBasePay(
      { type: "Absent", base: "P0.00", hasAssignedShift: true },
      "1800",
    ),
    0,
  );
  assert.equal(
    getAttendanceBasePay(
      { type: "Regular", base: "P0.00" },
      "1800",
    ),
    0,
  );
});
