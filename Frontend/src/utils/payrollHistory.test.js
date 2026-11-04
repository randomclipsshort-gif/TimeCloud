import test from "node:test";
import assert from "node:assert/strict";
import {
  appendPayslipSnapshot,
  createPayslipSnapshot,
  findPayslipSnapshot,
  removePayslipSnapshot,
} from "./payrollHistory.js";

const period = { startDate: "2026-10-26", endDate: "2026-11-10" };
const createSnapshot = (endDate = period.endDate) => createPayslipSnapshot({
  employeeId: "employee-1",
  employeeName: "Example Employee",
  period: endDate === period.endDate
    ? period
    : { startDate: "2026-11-11", endDate },
  generatedAt: "2026-11-03T00:00:00.000Z",
  summary: {
    recordedEarnings: 1000,
    regularHours: 8,
    overtimeHours: 1,
  },
  earningsBreakdown: { items: [{ id: "basicPay", total: 1000 }] },
  deductions: {
    items: [{ id: "sss", amount: 50 }],
    total: 50,
    employeeContributionTotal: 50,
  },
  netPay: 950,
  settings: { dailyWage: "1000", overtimeMultiplier: "1.25" },
});

test("payslip snapshots preserve period calculations and reject duplicates", () => {
  const first = createSnapshot();
  const history = appendPayslipSnapshot([], first);

  assert.equal(history.length, 1);
  assert.equal(findPayslipSnapshot(history, "employee-1", period), first);
  assert.throws(
    () => appendPayslipSnapshot(history, createSnapshot()),
    /already exists/,
  );
});

test("payslip history keeps distinct payroll periods", () => {
  const current = createSnapshot();
  const following = createSnapshot("2026-11-25");
  const history = appendPayslipSnapshot(
    appendPayslipSnapshot([], current),
    following,
  );

  assert.deepEqual(history.map((snapshot) => snapshot.period.endDate), [
    "2026-11-10",
    "2026-11-25",
  ]);
});

test("payslip snapshots require a valid semi-monthly period", () => {
  assert.throws(
    () => createPayslipSnapshot({
      ...createSnapshot(),
      period: { startDate: "2026-11-02", endDate: "2026-11-30" },
    }),
    /invalid payroll data/,
  );
});

test("payslip snapshots accept a full calendar month", () => {
  const snapshot = createPayslipSnapshot({
    ...createSnapshot(),
    period: { startDate: "2026-11-01", endDate: "2026-11-30" },
  });

  assert.equal(snapshot.period.startDate, "2026-11-01");
  assert.equal(snapshot.period.endDate, "2026-11-30");
});

test("removes a saved payslip without changing the existing history", () => {
  const first = createSnapshot("2026-11-25");
  const second = createSnapshot();
  const history = [first, second];

  assert.deepEqual(removePayslipSnapshot(history, first.id), [second]);
  assert.deepEqual(history, [first, second]);
  assert.throws(
    () => removePayslipSnapshot(history, "missing"),
    /could not be found/,
  );
});
