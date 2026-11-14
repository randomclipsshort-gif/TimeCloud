import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPayrollSettingsHistory,
  calculateAttendancePayroll,
  getEstimatedAttendanceEarnings,
  getPayrollSettingsForDate,
} from "./payrollCalculation.js";
import {
  calculateCutoffPayrollDeductions,
  getPayrollDeductionSettingsDefaults,
  sumCutoffPayrollDeductions,
} from "./payrollDeductions.js";
import { summarizePayrollEarningsBreakdown } from "./payrollEarningsBreakdown.js";
import {
  appendPayslipSnapshot,
  createPayslipSnapshot,
} from "./payrollHistory.js";
import {
  getPayrollPeriodForDate,
  summarizePayrollPeriod,
} from "./payrollPeriods.js";
import { calculateHolidayPay } from "./holidayPay.js";

const unconfiguredSettings = {
  dailyWage: "",
  dailyAllowance: "0",
  overtimeMultiplier: "1.25",
  nightDifferential: "10",
};
const configuredSettings = {
  ...unconfiguredSettings,
  dailyWage: "1000",
};
const nightShift = {
  type: "Regular",
  shift: "Night",
  hasAssignedShift: true,
  shiftStartTime: "22:00",
  shiftEndTime: "06:00",
  workStartTime: "22:00",
  workEndTime: "06:00",
  base: "P0.00",
  ot: "P0.00",
  penalty: "P0.00",
  est: "P0.00 PHP",
  overtimeAmount: 0,
  overtimeMinutes: 0,
};

test("first payroll setup backfills pending shifts without changing source attendance", () => {
  const attendance = {
    "2026-10-05": { ...nightShift },
    "2026-10-06": {
      ...nightShift,
      shift: "Day",
      shiftStartTime: "08:00",
      shiftEndTime: "16:00",
      workStartTime: "08:00",
      workEndTime: "16:00",
    },
  };
  const pending = calculateAttendancePayroll({
    record: attendance["2026-10-05"],
    date: "2026-10-05",
    settings: unconfiguredSettings,
  });
  assert.equal(pending.status, "pending");
  assert.match(pending.reasons.join(" "), /daily wage/i);
  assert.equal(attendance["2026-10-05"].base, "P0.00");
  assert.equal(attendance["2026-10-05"].est, "P0.00 PHP");

  const history = buildPayrollSettingsHistory({
    currentSettings: unconfiguredSettings,
    nextSettings: configuredSettings,
    effectiveDate: "2026-11-12",
    attendance,
  });
  assert.equal(history.length, 1);
  assert.equal(history[0].effectiveDate, "2026-10-05");

  const settingsForNightShift = getPayrollSettingsForDate(
    history,
    configuredSettings,
    "2026-10-05",
  );
  const nightResult = calculateAttendancePayroll({
    record: attendance["2026-10-05"],
    date: "2026-10-05",
    settings: settingsForNightShift,
  });
  assert.equal(nightResult.status, "ready");
  assert.equal(nightResult.dailyWage, 1000);
  assert.equal(nightResult.nightDifferentialPay, 100);
  assert.equal(nightResult.earnings, 1100);

  const period = getPayrollPeriodForDate("2026-10-05");
  const getEarnings = (record, date) =>
    calculateAttendancePayroll({
      record,
      date,
      settings: getPayrollSettingsForDate(history, configuredSettings, date),
    }).earnings;
  const summary = summarizePayrollPeriod(attendance, period, getEarnings);
  assert.equal(summary.recordedEarnings, 2100);
  const breakdown = summarizePayrollEarningsBreakdown(
    attendance,
    period,
    (record, date) =>
      calculateAttendancePayroll({
        record,
        date,
        settings: getPayrollSettingsForDate(history, configuredSettings, date),
      }).breakdown,
  );
  assert.equal(
    breakdown.items.find((item) => item.id === "shiftDifferentials").total,
    100,
  );

  const deductionSettings = getPayrollDeductionSettingsDefaults(
    settingsForNightShift,
  );
  const deductions = calculateCutoffPayrollDeductions({
    period,
    mode: deductionSettings.payrollDeductionMode,
    monthlyGrossPay: summary.recordedEarnings,
    settings: deductionSettings,
  });
  const snapshot = createPayslipSnapshot({
    employeeId: "new-user",
    employeeName: "Example Employee",
    period,
    generatedAt: "2026-10-11T00:00:00.000Z",
    summary,
    earningsBreakdown: breakdown,
    deductions,
    netPay: summary.recordedEarnings - deductions.total,
    settings: settingsForNightShift,
  });
  assert.equal(snapshot.summary.recordedEarnings, 2100);
  assert.equal(snapshot.earningsBreakdown.items.reduce(
    (total, item) => total + item.total,
    0,
  ), 2100);
  assert.equal(snapshot.deductions.total, 271);
  assert.equal(snapshot.netPay, 1829);
  assert.deepEqual(appendPayslipSnapshot([], snapshot), [snapshot]);

  const persistedData = {
    settings: {
      ...configuredSettings,
      payrollSettingsHistory: history,
    },
    attendance,
    payslips: [snapshot],
  };
  const reloadedSummary = summarizePayrollPeriod(
    persistedData.attendance,
    period,
    (record, date) =>
      calculateAttendancePayroll({
        record,
        date,
        settings: getPayrollSettingsForDate(
          persistedData.settings.payrollSettingsHistory,
          persistedData.settings,
          date,
        ),
      }).earnings,
  );
  assert.equal(reloadedSummary.recordedEarnings, 2100);
  assert.equal(persistedData.payslips[0].netPay, 1829);

  const reloadResult = calculateAttendancePayroll({
    record: attendance["2026-10-05"],
    date: "2026-10-05",
    settings: getPayrollSettingsForDate(
      history,
      configuredSettings,
      "2026-10-05",
    ),
  });
  assert.deepEqual(reloadResult, nightResult);
});

test("later rate changes apply by effective date and recalculate overtime and night work", () => {
  const oldSettings = { ...configuredSettings, dailyWage: "800" };
  const oldHistory = [{
    effectiveDate: "2026-10-01",
    settings: oldSettings,
  }];
  const attendance = {
    "2026-10-04": { ...nightShift, base: "P800.00", est: "P800.00 PHP" },
    "2026-10-07": {
      ...nightShift,
      base: "P800.00",
      est: "P800.00 PHP",
      overtimeMinutes: 120,
    },
  };
  const changedSettings = {
    ...configuredSettings,
    dailyWage: "1000",
    overtimeMultiplier: "1.5",
    nightDifferential: "15",
  };
  const changedHistory = buildPayrollSettingsHistory({
    history: oldHistory,
    currentSettings: oldSettings,
    nextSettings: changedSettings,
    effectiveDate: "2026-10-07",
    attendance,
  });

  const before = calculateAttendancePayroll({
    record: attendance["2026-10-04"],
    date: "2026-10-04",
    settings: getPayrollSettingsForDate(changedHistory, changedSettings, "2026-10-04"),
  });
  const after = calculateAttendancePayroll({
    record: attendance["2026-10-07"],
    date: "2026-10-07",
    settings: getPayrollSettingsForDate(changedHistory, changedSettings, "2026-10-07"),
  });
  assert.equal(before.dailyWage, 800);
  assert.equal(before.nightDifferentialPay, 80);
  assert.equal(after.dailyWage, 1000);
  assert.equal(after.nightDifferentialPay, 150);
  assert.equal(after.overtimePay, 375);
  assert.equal(after.earnings, 1525);
  assert.equal(attendance["2026-10-07"].base, "P800.00");
  assert.equal(attendance["2026-10-07"].est, "P800.00 PHP");
});

test("assigned shift snapshots drive paid hours and keep potential overtime unapproved", () => {
  const midShift = {
    type: "Regular",
    hasAssignedShift: true,
    shift: "Mid Shift",
    shiftStartTime: "12:00",
    shiftEndTime: "21:00",
    assignedShiftSnapshot: {
      name: "Mid Shift",
      startTime: "12:00",
      endTime: "21:00",
      breakDurationMinutes: 60,
      breakType: "unpaid",
      expectedPaidMinutes: 480,
    },
    workStartTime: "12:00",
    workEndTime: "21:00",
    overtimeMinutes: 0,
    base: "P1000.00",
    penalty: "P0.00",
  };
  const calculate = (record) =>
    calculateAttendancePayroll({
      record,
      date: "2026-10-05",
      settings: configuredSettings,
    });

  const unpaidBreak = calculate(midShift);
  assert.equal(unpaidBreak.hours.expectedPaidMinutes, 480);
  assert.equal(unpaidBreak.hours.actualPaidMinutes, 480);
  assert.equal(unpaidBreak.hours.potentialOvertimeMinutes, 0);

  const paidBreakRecord = {
    ...midShift,
    assignedShiftSnapshot: {
      ...midShift.assignedShiftSnapshot,
      breakType: "paid",
      expectedPaidMinutes: 540,
    },
  };
  const paidBreak = calculate(paidBreakRecord);
  assert.equal(paidBreak.hours.expectedPaidMinutes, 540);
  assert.equal(paidBreak.hours.actualPaidMinutes, 540);
  assert.equal(paidBreak.hours.potentialOvertimeMinutes, 0);

  const overtime = calculate({ ...midShift, workEndTime: "22:00" });
  assert.equal(overtime.hours.potentialOvertimeMinutes, 60);
  assert.equal(overtime.hours.approvedOvertimeMinutes, 0);
  assert.equal(overtime.breakdown.overtimeMinutes, 0);
  assert.equal(overtime.breakdown.overtime, 0);
  assert.equal(overtime.earnings, 1000);

  const earlyArrival = calculate({
    ...midShift,
    workStartTime: "11:30",
  });
  assert.equal(earlyArrival.hours.actualPaidMinutes, 510);
  assert.equal(earlyArrival.hours.potentialOvertimeMinutes, 0);
});

test("distinct morning, night, and overnight snapshots use their own break settings", () => {
  const records = [
    {
      employeeId: "morning-worker",
      shift: "Morning",
      shiftStartTime: "06:00",
      shiftEndTime: "15:00",
      workStartTime: "06:00",
      workEndTime: "15:00",
      assignedShiftSnapshot: {
        name: "Morning",
        startTime: "06:00",
        endTime: "15:00",
        breakDurationMinutes: 30,
        breakType: "unpaid",
      },
    },
    {
      employeeId: "night-worker",
      shift: "Night",
      shiftStartTime: "22:00",
      shiftEndTime: "07:00",
      workStartTime: "22:00",
      workEndTime: "07:00",
      assignedShiftSnapshot: {
        name: "Night",
        startTime: "22:00",
        endTime: "07:00",
        breakDurationMinutes: 75,
        breakType: "unpaid",
      },
    },
    {
      employeeId: "overnight-worker",
      shift: "Overnight",
      shiftStartTime: "22:00",
      shiftEndTime: "07:00",
      workStartTime: "22:00",
      workEndTime: "08:00",
      assignedShiftSnapshot: {
        name: "Overnight",
        startTime: "22:00",
        endTime: "07:00",
        breakDurationMinutes: 45,
        breakType: "unpaid",
      },
    },
  ].map((record) => ({
    ...nightShift,
    ...record,
    type: "Regular",
    hasAssignedShift: true,
  }));
  const calculations = records.map((record) =>
    calculateAttendancePayroll({
      record,
      date: "2026-10-05",
      settings: configuredSettings,
    }),
  );

  assert.deepEqual(
    calculations.map(({ hours }) => [
      hours.expectedPaidMinutes,
      hours.actualPaidMinutes,
      hours.potentialOvertimeMinutes,
    ]),
    [
      [510, 510, 0],
      [465, 465, 0],
      [495, 555, 60],
    ],
  );
});

test("incomplete attendance has no actual or potential paid-hour totals", () => {
  const result = calculateAttendancePayroll({
    record: {
      ...nightShift,
      assignedShiftSnapshot: {
        name: "Night",
        startTime: "22:00",
        endTime: "07:00",
        breakDurationMinutes: 60,
        breakType: "unpaid",
      },
      clockedIn: true,
      workEndTime: "",
      out: "—",
    },
    date: "2026-10-05",
    settings: configuredSettings,
  });

  assert.equal(result.status, "pending");
  assert.equal(result.hours.actualPaidMinutes, null);
  assert.equal(result.hours.potentialOvertimeMinutes, null);
});

test("unscheduled manual attendance does not create scheduled payroll hours", () => {
  const result = calculateAttendancePayroll({
    record: {
      type: "Regular",
      hasAssignedShift: false,
      shiftStartTime: "",
      shiftEndTime: "",
      workStartTime: "12:00",
      workEndTime: "21:00",
      in: "12:00 PM",
      out: "09:00 PM",
    },
    date: "2026-11-25",
    settings: configuredSettings,
  });

  assert.equal(result.status, "not-applicable");
  assert.equal(result.hours.scheduledMinutes, null);
  assert.equal(result.hours.expectedPaidMinutes, null);
  assert.equal(result.hours.actualPaidMinutes, null);
  assert.equal(result.hours.potentialOvertimeMinutes, null);
});

test("finance and payslip totals use the same approved payroll earnings without duplicate OT", () => {
  const date = "2026-10-05";
  const attendance = {
    [date]: {
      type: "Regular",
      shift: "Mid Shift",
      hasAssignedShift: true,
      shiftStartTime: "12:00",
      shiftEndTime: "21:00",
      assignedShiftSnapshot: {
        name: "Mid Shift",
        startTime: "12:00",
        endTime: "21:00",
        breakDurationMinutes: 60,
        breakType: "unpaid",
      },
      workStartTime: "12:00",
      workEndTime: "22:00",
      overtimeMinutes: 0,
      overtimeAmount: 0,
      base: "P1000.00",
      penalty: "P0.00",
    },
  };
  const calculate = (record, recordDate) =>
    calculateAttendancePayroll({
      record,
      date: recordDate,
      settings: configuredSettings,
    });
  const payrollPeriod = getPayrollPeriodForDate(date);
  const financeSummary = summarizePayrollPeriod(
    attendance,
    payrollPeriod,
    (record, recordDate) => calculate(record, recordDate).earnings,
    [],
    (record, recordDate) => calculate(record, recordDate).hours,
  );
  const earningsBreakdown = summarizePayrollEarningsBreakdown(
    attendance,
    payrollPeriod,
    (record, recordDate) => calculate(record, recordDate).breakdown,
  );
  const payslip = createPayslipSnapshot({
    employeeId: "employee-1",
    employeeName: "Example Employee",
    period: payrollPeriod,
    generatedAt: "2026-10-11T00:00:00.000Z",
    summary: financeSummary,
    earningsBreakdown,
    deductions: {
      items: [],
      total: 0,
      employeeContributionTotal: 0,
    },
    netPay: financeSummary.recordedEarnings,
    settings: configuredSettings,
  });

  assert.equal(calculate(attendance[date], date).hours.potentialOvertimeMinutes, 60);
  assert.equal(financeSummary.regularHours, 8);
  assert.equal(financeSummary.potentialOvertimeHours, 1);
  assert.equal(financeSummary.overtimeHours, 0);
  assert.equal(financeSummary.actualPaidHours, 9);
  assert.equal(financeSummary.recordedEarnings, 1000);
  assert.equal(payslip.summary.recordedEarnings, financeSummary.recordedEarnings);
  assert.equal(
    earningsBreakdown.items.some((item) => item.id === "overtime"),
    false,
  );
  assert.equal(calculate(attendance[date], date).earnings, 1000);
});

test("incomplete rates leave payroll pending instead of treating zero as final", () => {
  const nightResult = calculateAttendancePayroll({
    record: nightShift,
    date: "2026-10-05",
    settings: {
      dailyWage: "1000",
      dailyAllowance: "",
      nightDifferential: "",
      overtimeMultiplier: "",
    },
  });
  assert.equal(nightResult.status, "pending");
  assert.match(nightResult.reasons.join(" "), /allowance/i);
  assert.match(nightResult.reasons.join(" "), /night differential/i);
  assert.equal(nightResult.earnings, null);

  const dayResult = calculateAttendancePayroll({
    record: {
      ...nightShift,
      shiftStartTime: "08:00",
      shiftEndTime: "16:00",
      workStartTime: "08:00",
      workEndTime: "16:00",
    },
    date: "2026-10-05",
    settings: {
      dailyWage: "1000",
      dailyAllowance: "0",
      nightDifferential: "",
      overtimeMultiplier: "1.25",
    },
  });
  assert.equal(dayResult.status, "ready");
  assert.equal(dayResult.earnings, 1000);
});

test("pending payroll without incentives does not show a complete estimate", () => {
  const record = { ...nightShift };
  const calculation = calculateAttendancePayroll({
    record,
    date: "2026-10-05",
    settings: unconfiguredSettings,
  });

  assert.equal(calculation.status, "pending");
  assert.equal(getEstimatedAttendanceEarnings(calculation, 0), null);
  assert.equal(record.base, "P0.00");
  assert.equal(record.est, "P0.00 PHP");
});

test("pending payroll with incentives hides the total estimate but preserves incentive source", () => {
  const record = { ...nightShift };
  const incentives = [{
    id: "incentive-1",
    name: "Performance bonus",
    amount: 250,
    date: "2026-10-05",
  }];
  const calculation = calculateAttendancePayroll({
    record,
    date: "2026-10-05",
    settings: unconfiguredSettings,
  });

  assert.equal(calculation.status, "pending");
  assert.equal(getEstimatedAttendanceEarnings(calculation, 250), null);
  assert.deepEqual(incentives, [{
    id: "incentive-1",
    name: "Performance bonus",
    amount: 250,
    date: "2026-10-05",
  }]);
  assert.equal(record.base, "P0.00");
  assert.equal(record.est, "P0.00 PHP");
});

test("holiday and both cutoff earnings use the existing payroll rules", () => {
  const attendance = {
    "2026-10-10": {
      ...nightShift,
      shift: "Day",
      shiftStartTime: "08:00",
      shiftEndTime: "16:00",
      workStartTime: "08:00",
      workEndTime: "16:00",
    },
    "2026-10-11": {
      ...nightShift,
      shift: "Day",
      shiftStartTime: "08:00",
      shiftEndTime: "16:00",
      workStartTime: "08:00",
      workEndTime: "16:00",
    },
    "2026-10-25": {
      ...nightShift,
      shift: "Day",
      shiftStartTime: "08:00",
      shiftEndTime: "16:00",
      workStartTime: "08:00",
      workEndTime: "16:00",
    },
  };
  const history = [{
    effectiveDate: "2026-10-01",
    settings: configuredSettings,
  }];
  const settingsFor = (date) =>
    getPayrollSettingsForDate(history, configuredSettings, date);
  const calculationFor = (record, date) =>
    calculateAttendancePayroll({
      record,
      date,
      settings: settingsFor(date),
      holiday: date === "2026-10-11"
        ? { date, classification: "Regular Holiday" }
        : null,
      holidayEligibilityConfirmed: true,
    });

  assert.equal(
    calculationFor(attendance["2026-10-11"], "2026-10-11").earnings,
    2000,
  );
  const unworkedHoliday = calculateAttendancePayroll({
    record: {
      ...attendance["2026-10-11"],
      type: "Absent",
      workStartTime: "",
      workEndTime: "",
      holidayUnworked: true,
    },
    date: "2026-10-11",
    settings: settingsFor("2026-10-11"),
    holiday: { date: "2026-10-11", classification: "Regular Holiday" },
    holidayEligibilityConfirmed: true,
  });
  assert.equal(unworkedHoliday.earnings, 1000);
  const unworkedHolidayAttendance = {
    "2026-10-11": {
      ...attendance["2026-10-11"],
      type: "Absent",
      workStartTime: "",
      workEndTime: "",
      holidayUnworked: true,
    },
  };
  const unworkedPeriod = getPayrollPeriodForDate("2026-10-11");
  assert.equal(
    summarizePayrollPeriod(
      unworkedHolidayAttendance,
      unworkedPeriod,
      (record, date) => calculationFor(record, date).earnings,
    ).recordedEarnings,
    1000,
  );
  assert.equal(
    summarizePayrollEarningsBreakdown(
      unworkedHolidayAttendance,
      unworkedPeriod,
      (record, date) => calculationFor(record, date).breakdown,
    ).items.find((item) => item.id === "regularHoliday").total,
    1000,
  );
  const firstCutoff = summarizePayrollPeriod(
    attendance,
    getPayrollPeriodForDate("2026-10-10"),
    (record, date) => calculationFor(record, date).earnings,
  );
  const secondCutoff = summarizePayrollPeriod(
    attendance,
    getPayrollPeriodForDate("2026-10-25"),
    (record, date) => calculationFor(record, date).earnings,
  );
  assert.equal(firstCutoff.recordedEarnings, 1000);
  assert.equal(secondCutoff.recordedEarnings, 3000);
});

test("holiday overtime excludes the scheduled one-hour break on a nine-hour shift", () => {
  const record = {
    ...nightShift,
    shift: "Day",
    shiftStartTime: "12:00",
    shiftEndTime: "21:00",
    assignedShiftSnapshot: {
      name: "Mid Shift",
      startTime: "12:00",
      endTime: "21:00",
      breakDurationMinutes: 60,
      breakType: "unpaid",
      expectedPaidMinutes: 480,
    },
    workStartTime: "12:00",
    workEndTime: "21:00",
  };
  const options = {
    record,
    date: "2026-10-11",
    settings: configuredSettings,
    holiday: { date: "2026-10-11", classification: "Regular Holiday" },
    holidayEligibilityConfirmed: true,
  };

  const scheduledShift = calculateAttendancePayroll(options);
  assert.equal(scheduledShift.breakdown.overtimeHours, 0);
  assert.equal(scheduledShift.breakdown.overtimeMinutes, 0);

  const extraHour = calculateAttendancePayroll({
    ...options,
    record: { ...record, workEndTime: "22:00" },
  });
  assert.equal(extraHour.hours.potentialOvertimeMinutes, 60);
  assert.equal(extraHour.hours.approvedOvertimeMinutes, 0);
  assert.equal(extraHour.breakdown.overtimeMinutes, 0);
  assert.equal(extraHour.breakdown.overtime, 0);
});

test("unworked special non-working holidays are ready at zero while partial attendance remains pending", () => {
  const holiday = {
    date: "2026-11-01",
    classification: "Special Non-Working Day",
  };
  const restDay = {
    ...nightShift,
    type: "Rest Day",
    shift: "Rest Day",
    workStartTime: "",
    workEndTime: "",
    in: "—",
    out: "—",
  };
  const result = calculateAttendancePayroll({
    record: restDay,
    date: holiday.date,
    settings: unconfiguredSettings,
    holiday,
  });
  assert.equal(result.status, "ready");
  assert.equal(result.earnings, 0);
  assert.equal(result.breakdown.specialHoliday, 0);
  assert.equal(getEstimatedAttendanceEarnings(result), 0);
  assert.match(result.notice, /No-work, no-pay is the general rule/i);

  const holidayPay = calculateHolidayPay({
    holiday,
    dailyWage: null,
    hoursWorked: 0,
    hasSchedule: true,
    isRestDay: true,
    worked: false,
    hasAttendanceTime: false,
  });
  assert.equal(holidayPay.amount, 0);
  assert.match(holidayPay.notice, /No-work, no-pay is the general rule/i);

  const partialAttendance = calculateAttendancePayroll({
    record: {
      ...restDay,
      type: "Regular",
      shift: "Day",
      shiftStartTime: "08:00",
      shiftEndTime: "16:00",
      workStartTime: "08:00",
      in: "08:00",
    },
    date: holiday.date,
    settings: configuredSettings,
    holiday,
  });
  assert.equal(partialAttendance.status, "pending");
  assert.match(partialAttendance.reasons.join(" "), /complete clock-in and clock-out times/i);
});

test("effective-date histories replace same-day versions and preserve snapshot amounts", () => {
  const first = buildPayrollSettingsHistory({
    nextSettings: configuredSettings,
    effectiveDate: "2026-10-01",
  });
  const updatedSettings = { ...configuredSettings, dailyWage: "1200" };
  const second = buildPayrollSettingsHistory({
    history: first,
    currentSettings: configuredSettings,
    nextSettings: updatedSettings,
    effectiveDate: "2026-10-01",
  });
  assert.equal(second.length, 1);
  assert.equal(
    getPayrollSettingsForDate(second, updatedSettings, "2026-10-01").dailyWage,
    "1200",
  );

  const period = getPayrollPeriodForDate("2026-10-10");
  const snapshot = createPayslipSnapshot({
    employeeId: "employee-1",
    employeeName: "Example Employee",
    period,
    generatedAt: "2026-10-11T00:00:00.000Z",
    summary: { recordedEarnings: 1000, regularHours: 8, overtimeHours: 0 },
    earningsBreakdown: { items: [{ id: "basicPay", total: 1000 }] },
    deductions: { items: [], total: 0, employeeContributionTotal: 0 },
    netPay: 1000,
    settings: { dailyWage: "1000" },
  });
  const saved = appendPayslipSnapshot([], snapshot);
  assert.equal(saved[0].netPay, 1000);
  assert.throws(() => appendPayslipSnapshot(saved, snapshot), /already exists/);
});

test("dates before the first settings version use its baseline without skipping later changes", () => {
  const firstSettings = { ...configuredSettings, dailyWage: "645" };
  const laterSettings = { ...configuredSettings, dailyWage: "800" };
  const history = [
    { effectiveDate: "2026-11-12", settings: firstSettings },
    { effectiveDate: "2026-11-13", settings: laterSettings },
  ];

  assert.equal(
    getPayrollSettingsForDate(
      history,
      { ...configuredSettings, dailyWage: "900" },
      "2026-11-11",
    ).dailyWage,
    "645",
  );
  assert.equal(
    getPayrollSettingsForDate(history, configuredSettings, "2026-11-12")
      .dailyWage,
    "645",
  );
  assert.equal(
    getPayrollSettingsForDate(history, configuredSettings, "2026-11-13")
      .dailyWage,
    "800",
  );
});

test("cutoff deduction totals use the existing employee contribution schedule", () => {
  const period1 = getPayrollPeriodForDate("2026-10-10");
  const period2 = getPayrollPeriodForDate("2026-10-25");
  const settings = getPayrollDeductionSettingsDefaults(configuredSettings);
  const total = sumCutoffPayrollDeductions(
    calculateCutoffPayrollDeductions({
      period: period1,
      mode: settings.payrollDeductionMode,
      monthlyGrossPay: 2100,
      settings,
    }),
    calculateCutoffPayrollDeductions({
      period: period2,
      mode: settings.payrollDeductionMode,
      monthlyGrossPay: 2100,
      settings,
    }),
  );
  assert.equal(total.total, 542);
  assert.ok(total.items.every((item) => item.employeePaid));
});