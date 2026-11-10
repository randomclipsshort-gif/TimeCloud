import test from "node:test";
import assert from "node:assert/strict";
import {
  getIncentiveTotal,
  getIncentivesForDate,
  getIncentivesForPeriod,
} from "./incentiveTracker.js";

const incentives = [
  { id: "i1", name: "Performance bonus", amount: 500, date: "2026-10-10" },
  { id: "i2", name: "Referral", amount: 250, date: "2026-10-11" },
  { id: "i3", name: "Invalid date", amount: 100, date: "2026-02-30" },
  { id: "i4", name: "Invalid amount", amount: -1, date: "2026-10-10" },
];

test("incentives are included in inclusive payroll date ranges", () => {
  assert.deepEqual(
    getIncentivesForPeriod(incentives, {
      startDate: "2026-10-01",
      endDate: "2026-10-10",
    }).map(({ id }) => id),
    ["i1"],
  );
});

test("incentives can be selected by date and summed safely", () => {
  assert.deepEqual(
    getIncentivesForDate(incentives, "2026-10-10").map(({ id }) => id),
    ["i1"],
  );
  assert.equal(getIncentiveTotal(incentives), 750);
  assert.equal(getIncentiveTotal([
    { id: "c1", name: "One", amount: 0.1, date: "2026-10-10" },
    { id: "c2", name: "Two", amount: 0.2, date: "2026-10-10" },
  ]), 0.3);
});

test("invalid periods and incentive records are excluded", () => {
  assert.deepEqual(
    getIncentivesForPeriod(incentives, {
      startDate: "2026-10-25",
      endDate: "2026-10-01",
    }),
    [],
  );
  assert.equal(getIncentivesForDate(incentives, "2026-02-30").length, 0);
  assert.equal(getIncentiveTotal(null), 0);
});
