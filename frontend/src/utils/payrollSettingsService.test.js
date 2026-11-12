import test from "node:test";
import assert from "node:assert/strict";
import {
  loadWorkspace,
  savePrivateFinancialData,
} from "../lib/workspace.js";
import {
  mergeLocalPrivateAttendance,
  mergePrivateFinancialData,
  serializeWorkspaceForCloud,
} from "../lib/privateFinancialData.js";
import {
  calculateCutoffPayrollDeductions,
  getPayrollDeductionSettingsDefaults,
} from "./payrollDeductions.js";
import {
  getEstimatedAttendanceEarnings,
  getPayrollSettingsForDate,
} from "./payrollCalculation.js";
import { getPayrollPeriodForDate, summarizePayrollPeriod } from "./payrollPeriods.js";
import { summarizePayrollEarningsBreakdown } from "./payrollEarningsBreakdown.js";
import {
  appendPayslipSnapshot,
  createPayslipSnapshot,
} from "./payrollHistory.js";
import {
  createPayrollSettingsUpdate,
  recalculatePrivateAttendance,
} from "./payrollSettingsService.js";

const unconfiguredSettings = {
  dailyWage: "",
  dailyAllowance: "0",
  overtimeMultiplier: "1.25",
  nightDifferential: "10",
  payrollSettingsHistory: [],
};
const configuredSettings = {
  ...unconfiguredSettings,
  dailyWage: "1000",
  employeeIncentives: [{
    id: "incentive-1",
    name: "Performance bonus",
    amount: 250,
    date: "2026-10-05",
  }],
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

function installPrivateFinancialApiMock(t, cloudWorkspace) {
  const originalFetch = globalThis.fetch;
  const requests = [];
  let privateData = null;
  let privateRevision = 0;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input), "http://localhost");
    const method = options.method || "GET";
    requests.push({
      path: url.pathname,
      method,
      body: options.body ? JSON.parse(options.body) : null,
    });

    let data;
    if (url.pathname === "/api/session") {
      data = { user: { id: "new-user" } };
    } else if (url.pathname === "/api/workspace" && method === "GET") {
      data = {
        data: cloudWorkspace,
        revision: 1,
        punchRows: [],
        attendancePunchLoadError: null,
      };
    } else if (
      url.pathname === "/api/private-financial-data" &&
      method === "GET"
    ) {
      data = {
        data: privateData,
        revision: privateRevision,
        legacyVault: null,
      };
    } else if (
      url.pathname === "/api/private-financial-data" &&
      method === "PUT"
    ) {
      const request = requests[requests.length - 1].body;
      if (request.expectedUserId !== "new-user") {
        return new Response(JSON.stringify({
          error: { code: "UNAUTHORIZED", message: "Unexpected owner." },
        }), { status: 401 });
      }
      if (request.expectedRevision !== privateRevision) {
        return new Response(JSON.stringify({
          error: { code: "REVISION_CONFLICT", message: "Unexpected revision." },
        }), { status: 409 });
      }
      privateData = request.data;
      privateRevision += 1;
      data = { revision: privateRevision };
    } else {
      throw new Error(`Unexpected mocked API request: ${method} ${url.pathname}`);
    }

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  return {
    requests,
    getPrivateData: () => privateData,
  };
}

function calculateForSettings(attendance, settings, date) {
  return getPayrollSettingsForDate(
    settings.payrollSettingsHistory,
    settings,
    date,
  );
}

test("settings service recalculates attendance and round-trips private payroll data through the API", async (t) => {
  const sourceAttendance = {
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
  const update = createPayrollSettingsUpdate({
    currentSettings: unconfiguredSettings,
    nextSettings: configuredSettings,
    effectiveDate: "2026-11-12",
    attendance: sourceAttendance,
  });
  assert.equal(update.settings.payrollSettingsHistory.length, 1);
  assert.equal(
    update.settings.payrollSettingsHistory[0].effectiveDate,
    "2026-10-05",
  );
  assert.equal(update.attendance["2026-10-05"].payrollCalculation.status, "ready");
  assert.equal(update.attendance["2026-10-05"].payrollCalculation.earnings, 1100);
  assert.equal(update.attendance["2026-10-05"].payrollCalculation.breakdown.shiftDifferentials, 100);
  assert.equal(update.attendance["2026-10-06"].payrollCalculation.earnings, 1000);
  assert.equal(sourceAttendance["2026-10-05"].base, "P0.00");
  assert.equal(sourceAttendance["2026-10-05"].est, "P0.00 PHP");
  assert.equal(update.attendance["2026-10-05"].base, "P0.00");
  assert.equal(update.attendance["2026-10-05"].est, "P0.00 PHP");

  const api = installPrivateFinancialApiMock(
    t,
    serializeWorkspaceForCloud({ attendance: sourceAttendance }),
  );
  const firstRevision = await savePrivateFinancialData(
    {
      settings: update.settings,
      attendance: update.attendance,
      payslips: [],
    },
    0,
    "new-user",
  );
  assert.equal(firstRevision, 1);
  const loaded = await loadWorkspace("new-user");
  assert.equal(loaded.privateFinancialData.revision, 1);
  const mergedPrivateData = mergePrivateFinancialData(
    loaded.legacyWorkspacePrivateData.data,
    loaded.privateFinancialData.data,
  );
  const reloadedAttendance = mergeLocalPrivateAttendance(
    loaded.workspace.attendance,
    mergedPrivateData.attendance,
  );

  assert.equal(reloadedAttendance["2026-10-05"].workStartTime, "22:00");
  assert.equal(reloadedAttendance["2026-10-05"].workEndTime, "06:00");
  assert.equal(reloadedAttendance["2026-10-05"].base, "P0.00");
  assert.equal(reloadedAttendance["2026-10-05"].est, "P0.00 PHP");
  assert.equal(
    reloadedAttendance["2026-10-05"].payrollCalculation.earnings,
    1100,
  );

  const getEarnings = (record) => record.payrollCalculation.earnings;
  assert.equal(
    getEstimatedAttendanceEarnings(
      { status: "ready", earnings: 1100 },
      250,
    ),
    1350,
  );
  const firstCutoff = getPayrollPeriodForDate("2026-10-10");
  const secondCutoff = getPayrollPeriodForDate("2026-10-25");
  const payslipSummary = summarizePayrollPeriod(
    reloadedAttendance,
    firstCutoff,
    getEarnings,
    mergedPrivateData.settings.employeeIncentives,
  );
  const financeFirstCutoff = summarizePayrollPeriod(
    reloadedAttendance,
    firstCutoff,
    getEarnings,
    mergedPrivateData.settings.employeeIncentives,
  );
  const financeSecondCutoff = summarizePayrollPeriod(
    reloadedAttendance,
    secondCutoff,
    getEarnings,
    mergedPrivateData.settings.employeeIncentives,
  );
  const financeMonthlyGross =
    financeFirstCutoff.recordedEarnings +
    financeSecondCutoff.recordedEarnings;
  assert.equal(payslipSummary.recordedEarnings, 2350);
  assert.equal(financeFirstCutoff.recordedEarnings, payslipSummary.recordedEarnings);

  const deductionSettings = getPayrollDeductionSettingsDefaults(
    calculateForSettings(
      reloadedAttendance,
      mergedPrivateData.settings,
      firstCutoff.endDate,
    ),
  );
  const payslipDeductions = calculateCutoffPayrollDeductions({
    period: firstCutoff,
    mode: deductionSettings.payrollDeductionMode,
    monthlyGrossPay: financeMonthlyGross,
    settings: deductionSettings,
  });
  const financeDeductions = calculateCutoffPayrollDeductions({
    period: firstCutoff,
    mode: deductionSettings.payrollDeductionMode,
    monthlyGrossPay: financeMonthlyGross,
    settings: deductionSettings,
  });
  assert.deepEqual(financeDeductions, payslipDeductions);
  assert.equal(financeMonthlyGross, 2350);

  const earningsBreakdown = summarizePayrollEarningsBreakdown(
    reloadedAttendance,
    firstCutoff,
    (record) => record.payrollCalculation.breakdown,
    mergedPrivateData.settings.employeeIncentives,
  );
  const snapshot = createPayslipSnapshot({
    employeeId: "new-user",
    employeeName: "Example Employee",
    period: firstCutoff,
    summary: payslipSummary,
    earningsBreakdown,
    deductions: payslipDeductions,
    netPay: payslipSummary.recordedEarnings - payslipDeductions.total,
    settings: deductionSettings,
  });
  const savedHistory = appendPayslipSnapshot([], snapshot);
  const secondRevision = await savePrivateFinancialData(
    {
      ...api.getPrivateData(),
      payslips: savedHistory,
    },
    loaded.privateFinancialData.revision,
    "new-user",
  );
  assert.equal(secondRevision, 2);
  const reloadedAgain = await loadWorkspace("new-user");
  assert.equal(reloadedAgain.privateFinancialData.data.payslips[0].netPay, snapshot.netPay);
  assert.equal(reloadedAgain.privateFinancialData.data.attendance["2026-10-05"].payrollCalculation.earnings, 1100);
  assert.ok(api.requests.some(({ path, method }) =>
    path === "/api/private-financial-data" && method === "PUT",
  ));
});

test("effective-dated settings updates recalculate only records on or after the date", () => {
  const oldSettings = {
    ...unconfiguredSettings,
    dailyWage: "800",
    payrollSettingsHistory: [{
      effectiveDate: "2026-10-01",
      settings: {
        ...unconfiguredSettings,
        dailyWage: "800",
      },
    }],
  };
  const sourceAttendance = {
    "2026-10-04": {
      ...nightShift,
      base: "P800.00",
      est: "P800.00 PHP",
    },
    "2026-10-07": {
      ...nightShift,
      base: "P800.00",
      est: "P800.00 PHP",
      overtimeMinutes: 120,
    },
  };
  const nextSettings = {
    ...oldSettings,
    dailyWage: "1000",
    overtimeMultiplier: "1.5",
    nightDifferential: "15",
  };
  const update = createPayrollSettingsUpdate({
    currentSettings: oldSettings,
    nextSettings,
    effectiveDate: "2026-10-07",
    attendance: sourceAttendance,
  });
  assert.equal(update.settings.payrollSettingsHistory.length, 2);
  assert.equal(update.attendance["2026-10-04"].payrollCalculation.earnings, 880);
  assert.equal(update.attendance["2026-10-07"].payrollCalculation.earnings, 1525);
  assert.equal(sourceAttendance["2026-10-07"].base, "P800.00");
  assert.equal(sourceAttendance["2026-10-07"].est, "P800.00 PHP");

  const repeatedUpdate = createPayrollSettingsUpdate({
    currentSettings: update.settings,
    nextSettings,
    effectiveDate: "2026-10-07",
    attendance: sourceAttendance,
  });
  assert.equal(repeatedUpdate.settings.payrollSettingsHistory.length, 2);
  assert.deepEqual(
    repeatedUpdate.attendance["2026-10-07"].payrollCalculation,
    update.attendance["2026-10-07"].payrollCalculation,
  );
});

test("Nov 11-14 night attendance uses first configured settings and reconciles payroll", () => {
  const nightSettings = {
    dailyWage: "645",
    dailyAllowance: "18",
    nightDifferential: "10",
    overtimeMultiplier: "1.25",
  };
  const dates = [
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
  ];
  const sourceAttendance = Object.fromEntries(
    dates.map((date) => {
      const nextDate = new Date(`${date}T00:00:00.000Z`);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      return [date, {
        ...nightShift,
        in: "10:00 PM",
        out: "06:00 AM",
        punchSource: "manual",
        manualTimeInAt: `${date}T22:00:00+08:00`,
        manualTimeOutAt: `${nextDate.toISOString().slice(0, 10)}T06:00:00+08:00`,
      }];
    }),
  );
  const setup = createPayrollSettingsUpdate({
    currentSettings: unconfiguredSettings,
    nextSettings: nightSettings,
    effectiveDate: "2026-11-13",
    attendance: sourceAttendance,
  });
  const privateAttendance = setup.attendance;
  const attendance = mergeLocalPrivateAttendance(
    sourceAttendance,
    privateAttendance,
  );
  const period = getPayrollPeriodForDate("2026-11-11");
  const getEarnings = (record) => record.payrollCalculation.earnings;
  const summary = summarizePayrollPeriod(attendance, period, getEarnings);
  const breakdown = summarizePayrollEarningsBreakdown(
    attendance,
    period,
    (record) => record.payrollCalculation.breakdown,
  );
  const items = Object.fromEntries(
    breakdown.items.map((item) => [item.id, item]),
  );

  assert.equal(setup.settings.payrollSettingsHistory[0].effectiveDate, "2026-11-11");
  assert.equal(privateAttendance["2026-11-11"].payrollCalculation.status, "ready");
  assert.equal(summary.eligibleWorkdays, 4);
  assert.equal(summary.regularHours, 32);
  assert.equal(summary.recordedEarnings, 2910);
  assert.deepEqual(
    [items.basicPay.units, items.basicPay.rate, items.basicPay.total],
    [4, 645, 2580],
  );
  assert.deepEqual(
    [items.allowance.units, items.allowance.rate, items.allowance.total],
    [4, 18, 72],
  );
  assert.deepEqual(
    [
      items.shiftDifferentials.units,
      items.shiftDifferentials.rate,
      items.shiftDifferentials.total,
    ],
    [4, 64.5, 258],
  );
  assert.equal(
    breakdown.items.reduce((total, item) => total + item.total, 0),
    summary.recordedEarnings,
  );
  assert.equal(sourceAttendance["2026-11-11"].in, "10:00 PM");
  assert.equal(sourceAttendance["2026-11-11"].manualTimeInAt, "2026-11-11T22:00:00+08:00");
  assert.equal(sourceAttendance["2026-11-11"].base, "P0.00");
});

test("past complete attendance is included while an incomplete clock-out remains excluded", () => {
  const nightSettings = {
    dailyWage: "645",
    dailyAllowance: "18",
    nightDifferential: "10",
    overtimeMultiplier: "1.25",
  };
  const attendance = {
    "2026-11-11": { ...nightShift, in: "10:00 PM", out: "06:00 AM" },
    "2026-11-12": {
      ...nightShift,
      in: "10:00 PM",
      out: "—",
      workEndTime: "",
      clockedIn: true,
    },
  };
  const privateAttendance = recalculatePrivateAttendance({
    attendance,
    settings: {
      ...nightSettings,
      payrollSettingsHistory: [{
        effectiveDate: "2026-11-12",
        settings: nightSettings,
      }],
    },
  });
  const mergedAttendance = mergeLocalPrivateAttendance(
    attendance,
    privateAttendance,
  );
  const period = getPayrollPeriodForDate("2026-11-11");
  const summary = summarizePayrollPeriod(
    mergedAttendance,
    period,
    (record) => record.payrollCalculation.earnings,
  );
  const breakdown = summarizePayrollEarningsBreakdown(
    mergedAttendance,
    period,
    (record) => record.payrollCalculation.breakdown,
  );

  assert.equal(privateAttendance["2026-11-11"].payrollCalculation.status, "ready");
  assert.equal(privateAttendance["2026-11-12"].payrollCalculation.status, "pending");
  assert.equal(summary.eligibleWorkdays, 1);
  assert.equal(summary.regularHours, 8);
  assert.equal(summary.incompleteClockOuts, 1);
  assert.equal(summary.recordedEarnings, 727.5);
  assert.equal(
    breakdown.items.reduce((total, item) => total + item.total, 0),
    727.5,
  );
});
