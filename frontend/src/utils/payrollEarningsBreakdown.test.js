import test from "node:test";
import assert from "node:assert/strict";
import {
  groupIncentiveEarningsItems,
  summarizePayrollEarningsBreakdown,
} from "./payrollEarningsBreakdown.js";

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

test("splits basic pay by effective daily-wage periods", () => {
  const attendance = {};
  const period = { startDate: "2026-11-11", endDate: "2026-11-25" };
  for (let day = 11; day <= 25; day += 1) {
    const date = `2026-11-${String(day).padStart(2, "0")}`;
    attendance[date] = {
      type: "Regular",
      workStartTime: "08:00",
      workEndTime: "16:00",
    };
  }

  const breakdown = summarizePayrollEarningsBreakdown(
    attendance,
    period,
    (_record, date) => ({
      basicPay: date < "2026-11-13" ? 645 : 700,
    }),
    [],
    [
      { effectiveDate: "2026-11-01", settings: { dailyWage: "645" } },
      { effectiveDate: "2026-11-13", settings: { dailyWage: "700" } },
    ],
  );
  const basicPay = breakdown.items.find((item) => item.id === "basicPay");

  assert.equal(basicPay.total, 10390);
  assert.deepEqual(
    basicPay.rateTiers.map(
      ({ startDate, endDate, rate, units, total }) => ({
        startDate,
        endDate,
        rate,
        units,
        total,
      }),
    ),
    [
      {
        startDate: "2026-11-11",
        endDate: "2026-11-12",
        rate: 645,
        units: 2,
        total: 1290,
      },
      {
        startDate: "2026-11-13",
        endDate: "2026-11-25",
        rate: 700,
        units: 13,
        total: 9100,
      },
    ],
  );
});

test("assigns overnight earnings to the cutoff containing the shift start date", () => {
  const attendance = {
    "2026-10-10": {
      type: "Regular", workStartTime: "22:00", workEndTime: "06:00",
    },
    "2026-10-11": {
      type: "Regular", workStartTime: "09:00", workEndTime: "", clockedIn: true,
    },
  };
  const nextCutoffBreakdown = summarizePayrollEarningsBreakdown(
    attendance,
    { startDate: "2026-10-11", endDate: "2026-10-25" },
    () => ({ basicPay: 800 }),
  );
  assert.equal(nextCutoffBreakdown.items.length, 0);

  const startDateCutoffBreakdown = summarizePayrollEarningsBreakdown(
    attendance,
    { startDate: "2026-10-01", endDate: "2026-10-10" },
    () => ({ basicPay: 800 }),
  );
  assert.deepEqual(
    [startDateCutoffBreakdown.items[0].total, startDateCutoffBreakdown.items[0].units],
    [800, 1],
  );
});

test("lists dated incentives as separately named earnings lines", () => {
  const breakdown = summarizePayrollEarningsBreakdown(
    {},
    { startDate: "2026-10-01", endDate: "2026-10-10" },
    () => null,
    [
      { id: "i1", name: "Performance bonus", amount: 250, date: "2026-10-10" },
      { id: "i2", name: "Referral", amount: 150, date: "2026-10-11" },
    ],
  );
  assert.deepEqual(breakdown.items, [{
    id: "incentive-i1",
    label: "Performance bonus",
    date: "2026-10-10",
    unit: "item",
    units: 1,
    rate: 250,
    total: 250,
  }]);
});

test("groups same-name incentives on the same date and combines their totals", () => {
  const grouped = groupIncentiveEarningsItems([
    { id: "incentive-1", label: "X-ray", date: "2026-10-10", total: 150 },
    { id: "incentive-2", label: "X-ray", date: "2026-10-10", total: 150 },
    { id: "incentive-3", label: "X-ray", date: "2026-10-11", total: 75 },
    { id: "incentive-4", label: "CBC", date: "2026-10-10", total: 300 },
  ]);
  assert.deepEqual(grouped, [
    {
      id: "2026-10-10\u0000x-ray",
      label: "X-ray",
      count: 2,
      total: 300,
    },
    {
      id: "2026-10-11\u0000x-ray",
      label: "X-ray",
      count: 1,
      total: 75,
    },
    {
      id: "2026-10-10\u0000cbc",
      label: "CBC",
      count: 1,
      total: 300,
    },
  ]);
});
