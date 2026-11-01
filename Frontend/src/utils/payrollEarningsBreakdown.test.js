import test from "node:test";
import assert from "node:assert/strict";
import { summarizePayrollEarningsBreakdown } from "./payrollEarningsBreakdown.js";

test("groups cutoff earnings into itemized pay and adjustment lines", () => {
  const attendance = {
    "2026-10-01": {
      type: "Regular",
      workStartTime: "08:00",
      workEndTime: "16:00",
      est: "P600.00 PHP",
      lateMinutes: 20,
      undertimeMinutes: 10,
    },
    "2026-10-02": {
      type: "Regular",
      workStartTime: "22:00",
      workEndTime: "06:00",
      est: "P600.00 PHP",
    },
    "2026-10-03": {
      type: "Regular",
      workStartTime: "08:00",
      workEndTime: "18:30",
      est: "P600.00 PHP",
      overtimeMinutes: 150,
      overtimeAmount: 125,
    },
    "2026-10-04": {
      type: "Leave",
      leaveCode: "SL",
      est: "P600.00 PHP",
    },
  };
  const amountByDate = {
    "2026-10-01": {
      basicPay: 600, allowance: 18, lateMinutes: 20, undertimeMinutes: 10,
    },
    "2026-10-02": {
      basicPay: 600, allowance: 18, shiftDifferentials: 64.5,
    },
    "2026-10-03": {
      basicPay: 600, allowance: 18, overtime: 125, overtimeMinutes: 150,
    },
    "2026-10-04": { paidSickLeave: 600 },
  };
  const breakdown = summarizePayrollEarningsBreakdown(
    attendance,
    { startDate: "2026-10-01", endDate: "2026-10-10" },
    (_record, date) => amountByDate[date],
  );
  const items = Object.fromEntries(breakdown.items.map((item) => [item.id, item]));

  assert.deepEqual(
    [items.basicPay.units, items.basicPay.rate, items.basicPay.total],
    [3, 600, 1800],
  );
  assert.deepEqual(
    [items.allowance.units, items.allowance.rate, items.allowance.total],
    [3, 18, 54],
  );
  assert.deepEqual(
    [items.shiftDifferentials.units, items.shiftDifferentials.rate, items.shiftDifferentials.total],
    [1, 64.5, 64.5],
  );
  assert.deepEqual(
    [items.overtime.units, items.overtime.total],
    [2.5, 125],
  );
  assert.deepEqual(
    [items.paidSickLeave.units, items.paidSickLeave.total],
    [1, 600],
  );
  assert.equal(items.lateUndertime.lateMinutes, 20);
  assert.equal(items.lateUndertime.undertimeMinutes, 10);
  assert.equal(items.lateUndertime.total, 0);
  assert.equal(
    breakdown.items.reduce((total, item) => total + item.total, 0),
    2643.5,
  );
});

test("separates regular and non-special holiday pay", () => {
  const attendance = {
    "2026-10-01": {
      type: "Regular", workStartTime: "08:00", workEndTime: "16:00",
    },
    "2026-10-02": {
      type: "Regular", workStartTime: "08:00", workEndTime: "16:00",
    },
  };
  const breakdown = summarizePayrollEarningsBreakdown(
    attendance,
    { startDate: "2026-10-01", endDate: "2026-10-10" },
    (_record, date) => date === "2026-10-01"
      ? { regularHoliday: 1200 }
      : { specialHoliday: 780 },
  );
  const items = Object.fromEntries(breakdown.items.map((item) => [item.id, item]));

  assert.equal(items.regularHoliday.label, "Holiday reg");
  assert.equal(items.regularHoliday.total, 1200);
  assert.equal(items.specialHoliday.label, "Holiday non-special");
  assert.equal(items.specialHoliday.total, 780);
});

test("excludes incomplete attendance and clips overnight earnings at the cutoff", () => {
  const attendance = {
    "2026-10-10": {
      type: "Regular", workStartTime: "22:00", workEndTime: "06:00",
    },
    "2026-10-11": {
      type: "Regular", workStartTime: "09:00", workEndTime: "", clockedIn: true,
    },
  };
  const breakdown = summarizePayrollEarningsBreakdown(
    attendance,
    { startDate: "2026-10-11", endDate: "2026-10-25" },
    () => ({ basicPay: 800 }),
  );

  assert.equal(breakdown.items.length, 1);
  assert.equal(breakdown.items[0].total, 600);
  assert.equal(breakdown.items[0].units, 0.75);
});
