import test from "node:test";
import assert from "node:assert/strict";
import {
  appendPayslipSnapshot,
  createPayslipSnapshot,
  findPayslipSnapshot,
  getPayslipDirectoryPeriods,
  getPayslipPeriodsThroughYearEnd,
  getUpcomingPayslipPeriods,
  removePayslipSnapshot,
} from "./payrollHistory.js";
import { getPayrollPeriodForDate } from "./payrollPeriods.js";

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

test("active payslip periods include the current period and one future period", () => {
  const currentPeriod = getPayrollPeriodForDate("2026-11-15");
  const options = getUpcomingPayslipPeriods(
    currentPeriod,
    [],
    "employee-1",
  );

  assert.deepEqual(
    options.map(({ period, isCurrent }) => [
      period.startDate,
      period.endDate,
      isCurrent,
    ]),
    [
      ["2026-11-11", "2026-11-25", true],
      ["2026-11-26", "2026-12-10", false],
    ],
  );
});

test("payslip cutoff directory includes future periods through year end", () => {
  const currentPeriod = getPayrollPeriodForDate("2026-11-15");
  const periods = getPayslipPeriodsThroughYearEnd(currentPeriod, 2026);

  assert.deepEqual(
    periods.map(({ period, isCurrent }) => [period.endDate, isCurrent]),
    [
      ["2026-11-25", true],
      ["2026-12-10", false],
      ["2026-12-25", false],
    ],
  );
});

test("snapshotted periods disappear from active payslip periods", () => {
  const currentPeriod = getPayrollPeriodForDate("2026-11-15");
  const options = getUpcomingPayslipPeriods(
    currentPeriod,
    [
      { employeeId: "employee-1", period: currentPeriod },
      {
        employeeId: "employee-1",
        period: getPayrollPeriodForDate("2026-11-26"),
      },
      {
        employeeId: "another-employee",
        period: getPayrollPeriodForDate("2026-12-11"),
      },
    ],
    "employee-1",
  );

  assert.deepEqual(
    options.map(({ period, isCurrent }) => [
      period.startDate,
      period.endDate,
      isCurrent,
    ]),
    [
      ["2026-12-11", "2026-12-25", false],
      ["2026-12-26", "2027-01-10", false],
    ],
  );
});

test("payslip cutoff directory uses saved history for previous periods", () => {
  const currentPeriod = getPayrollPeriodForDate("2026-11-15");
  const firstFuturePeriod = getPayrollPeriodForDate("2026-11-26");
  const secondFuturePeriod = getPayrollPeriodForDate("2026-12-11");
  const unsavedPreviousPeriod = getPayrollPeriodForDate("2026-10-25");
  const savedPreviousPayslip = createSnapshot();
  const directoryPeriods = getPayslipDirectoryPeriods({
    currentPeriod,
    activePeriods: [
      { period: currentPeriod, isCurrent: true },
      { period: firstFuturePeriod, isCurrent: false },
      { period: secondFuturePeriod, isCurrent: false },
    ],
    payrollPeriods: [
      { period: currentPeriod, isCurrent: true, netPay: 900 },
      { period: unsavedPreviousPeriod, isCurrent: false, netPay: 800 },
    ],
    payslipHistory: [savedPreviousPayslip],
  });

  assert.deepEqual(
    directoryPeriods.map(({ period }) => period.endDate),
    [
      currentPeriod.endDate,
      firstFuturePeriod.endDate,
      secondFuturePeriod.endDate,
      savedPreviousPayslip.period.endDate,
    ],
  );
  assert.equal(
    directoryPeriods.some(
      ({ period }) => period.endDate === unsavedPreviousPeriod.endDate,
    ),
    false,
  );
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
