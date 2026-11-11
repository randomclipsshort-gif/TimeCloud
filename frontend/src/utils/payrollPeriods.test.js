import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPayrollPeriod,
  getCalendarPayrollPeriod,
  getPayrollCutoffPeriodsForDate,
  getNextPayrollPeriod,
  getPayrollPeriodForDate,
  getPayrollPeriodForEndDate,
  getPayrollPeriodForMonth,
  getPreviousPayrollPeriod,
  isPayrollPeriodEarningsAvailable,
  isValidPayrollPeriodEndDate,
  summarizePayrollPeriod,
} from "./payrollPeriods.js";

test("maps cutoff dates to inclusive semi-monthly periods", () => {
  assert.deepEqual(getPayrollPeriodForDate("2026-10-10"), {
    startDate: "2026-09-26",
    endDate: "2026-10-10",
  });
  assert.deepEqual(getPayrollPeriodForDate("2026-10-11"), {
    startDate: "2026-10-11",
    endDate: "2026-10-25",
  });
  assert.deepEqual(getPayrollPeriodForDate("2026-10-25"), {
    startDate: "2026-10-11",
    endDate: "2026-10-25",
  });
  assert.deepEqual(getPayrollPeriodForDate("2026-10-26"), {
    startDate: "2026-10-26",
    endDate: "2026-11-10",
  });
  assert.deepEqual(getPayrollPeriodForDate("2026-11-10"), {
    startDate: "2026-10-26",
    endDate: "2026-11-10",
  });
  assert.deepEqual(getPayrollPeriodForDate("2026-11-11"), {
    startDate: "2026-11-11",
    endDate: "2026-11-25",
  });
});

test("selects the adjacent first and second cutoff periods around a date", () => {
  assert.deepEqual(getPayrollCutoffPeriodsForDate("2026-11-11"), {
    firstCutoff: { startDate: "2026-10-26", endDate: "2026-11-10" },
    secondCutoff: { startDate: "2026-11-11", endDate: "2026-11-25" },
  });
  assert.deepEqual(getPayrollCutoffPeriodsForDate("2026-11-26"), {
    firstCutoff: { startDate: "2026-11-26", endDate: "2026-12-10" },
    secondCutoff: { startDate: "2026-11-11", endDate: "2026-11-25" },
  });
  assert.equal(getPayrollCutoffPeriodsForDate("invalid"), null);
});

test("handles year transitions and leap-year February", () => {
  assert.deepEqual(getPayrollPeriodForDate("2027-01-10"), {
    startDate: "2026-12-26",
    endDate: "2027-01-10",
  });
  assert.deepEqual(getPayrollPeriodForDate("2024-02-25"), {
    startDate: "2024-02-11",
    endDate: "2024-02-25",
  });
  assert.deepEqual(getPayrollPeriodForDate("2024-02-29"), {
    startDate: "2024-02-26",
    endDate: "2024-03-10",
  });
  assert.deepEqual(getPayrollPeriodForDate("2024-03-01"), {
    startDate: "2024-02-26",
    endDate: "2024-03-10",
  });
});

test("creates month/cutoff periods and validates persisted end dates", () => {
  assert.deepEqual(getPayrollPeriodForMonth("2026-10", 10), {
    startDate: "2026-09-26",
    endDate: "2026-10-10",
  });
  assert.deepEqual(getPayrollPeriodForMonth("2026-10", 25), {
    startDate: "2026-10-11",
    endDate: "2026-10-25",
  });
  assert.equal(isValidPayrollPeriodEndDate("2026-02-25"), true);
  assert.equal(isValidPayrollPeriodEndDate("2026-02-29"), false);
  assert.equal(isValidPayrollPeriodEndDate("2026-10-11"), false);
  assert.equal(getPayrollPeriodForEndDate("2026-10-11"), null);
});

test("creates valid full-calendar-month payroll periods", () => {
  assert.deepEqual(getCalendarPayrollPeriod("2026-11"), {
    startDate: "2026-11-01",
    endDate: "2026-11-30",
  });
  assert.deepEqual(getCalendarPayrollPeriod("2024-02"), {
    startDate: "2024-02-01",
    endDate: "2024-02-29",
  });
  assert.equal(getCalendarPayrollPeriod("2026-13"), null);
});

test("keeps private period earnings hidden until private data is ready", () => {
  assert.equal(isPayrollPeriodEarningsAvailable("migration-required"), false);
  assert.equal(isPayrollPeriodEarningsAvailable("loading"), false);
  assert.equal(isPayrollPeriodEarningsAvailable("unavailable"), false);
  assert.equal(isPayrollPeriodEarningsAvailable("error"), false);
  assert.equal(isPayrollPeriodEarningsAvailable("ready"), true);
  assert.equal(isPayrollPeriodEarningsAvailable("unexpected"), false);
});

test("period navigation is contiguous with no gaps or overlaps", () => {
  const before = getPayrollPeriodForDate("2026-10-10");
  const middle = getNextPayrollPeriod(before);
  const after = getNextPayrollPeriod(middle);
  assert.deepEqual(middle, getPayrollPeriodForDate("2026-10-11"));
  assert.deepEqual(after, getPayrollPeriodForDate("2026-10-26"));
  assert.deepEqual(getPreviousPayrollPeriod(after), middle);
  assert.equal(getPreviousPayrollPeriod(middle).endDate, before.endDate);
  assert.equal(formatPayrollPeriod(getPayrollPeriodForDate("2026-10-10")), "Sep 26, 2026–Oct 10, 2026");
});

test("assigns the full overnight shift to the cutoff containing its start date", () => {
  const attendance = {
    "2026-10-10": {
      type: "Regular", workStartTime: "08:00", workEndTime: "16:00", est: "₱800.00 PHP",
    },
    "2026-10-11": {
      type: "Regular", workStartTime: "08:00", workEndTime: "16:00", est: "₱800.00 PHP",
    },
    "2026-10-25": {
      type: "Regular", workStartTime: "10:00 PM", workEndTime: "2:00 AM",
      overtimeMinutes: 60, est: "₱400.00 PHP",
    },
    "2026-10-26": {
      type: "Regular", workStartTime: "09:00", workEndTime: "", clockedIn: true, est: "₱900.00 PHP",
    },
  };
  assert.deepEqual(
    summarizePayrollPeriod(attendance, getPayrollPeriodForDate("2026-10-10")),
    {
      eligibleWorkdays: 1,
      regularHours: 8,
      overtimeHours: 0,
      recordedEarnings: 800,
      incompleteClockOuts: 0,
    },
  );
  assert.deepEqual(
    summarizePayrollPeriod(attendance, getPayrollPeriodForDate("2026-10-25")),
    {
      eligibleWorkdays: 2,
      regularHours: 11,
      overtimeHours: 1,
      recordedEarnings: 1200,
      incompleteClockOuts: 0,
    },
  );
  assert.deepEqual(
    summarizePayrollPeriod(attendance, getPayrollPeriodForDate("2026-10-26")),
    {
      eligibleWorkdays: 0,
      regularHours: 0,
      overtimeHours: 0,
      recordedEarnings: 0,
      incompleteClockOuts: 1,
    },
  );
});

test("includes a cutoff-date night shift in full even when it ends the next day", () => {
  const attendance = {
    "2026-11-10": {
      type: "Regular", workStartTime: "22:00", workEndTime: "06:00", est: "₱645.00 PHP",
    },
  };

  assert.deepEqual(
    summarizePayrollPeriod(attendance, getPayrollPeriodForDate("2026-11-10")),
    {
      eligibleWorkdays: 1,
      regularHours: 8,
      overtimeHours: 0,
      recordedEarnings: 645,
      incompleteClockOuts: 0,
    },
  );
  assert.deepEqual(
    summarizePayrollPeriod(attendance, getPayrollPeriodForDate("2026-11-11")),
    {
      eligibleWorkdays: 0,
      regularHours: 0,
      overtimeHours: 0,
      recordedEarnings: 0,
      incompleteClockOuts: 0,
    },
  );
});

test("adds dated incentives to only the payroll period containing the incentive date", () => {
  const incentives = [
    { id: "i1", name: "Performance bonus", amount: 250, date: "2026-10-10" },
    { id: "i2", name: "Referral", amount: 150, date: "2026-10-11" },
  ];
  const firstCutoff = summarizePayrollPeriod(
    {},
    getPayrollPeriodForDate("2026-10-10"),
    undefined,
    incentives,
  );
  const secondCutoff = summarizePayrollPeriod(
    {},
    getPayrollPeriodForDate("2026-10-11"),
    undefined,
    incentives,
  );
  assert.equal(firstCutoff.recordedEarnings, 250);
  assert.equal(secondCutoff.recordedEarnings, 150);
});
