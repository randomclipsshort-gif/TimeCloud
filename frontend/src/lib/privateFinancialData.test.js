import test from "node:test";
import assert from "node:assert/strict";
import {
  extractPrivateFinancialSettings,
  mergeAttendancePunches,
  mergeLocalPrivateAttendance,
  serializeWorkspaceForCloud,
} from "./privateFinancialData.js";

test("cloud workspace serialization excludes salary and earnings fields", () => {
  const workspace = {
    dailyWage: "2500",
    dailyAllowance: "100",
    overtimeMultiplier: "1.5",
    nightDifferential: "10",
    annualBonus: "5000",
    employeeIncentives: [
      { id: "incentive-1", name: "Performance bonus", amount: 500, date: "2026-10-10" },
    ],
    leaveBalances: { VL: 4 },
    shiftTemplates: [{ id: "morning", startTime: "06:00", hourlyRate: 42 }],
    attendance: {
      "2026-10-28": {
        type: "Regular",
        shift: "Morning",
        shiftStartTime: "06:00",
        base: "P2500.00",
        wageRate: "100%",
        ot: "P0.00",
        penalty: "P0.00",
        est: "P2500.00 PHP",
        overtimeAmount: 50,
        overtimeMinutes: 30,
        bonusAmount: 200,
      },
    },
  };

  const cloudWorkspace = serializeWorkspaceForCloud(workspace);

  assert.deepEqual(Object.keys(cloudWorkspace).sort(), [
    "attendance",
    "leaveBalances",
    "shiftTemplates",
  ]);
  assert.equal(cloudWorkspace.employeeIncentives, undefined);
  assert.deepEqual(cloudWorkspace.attendance["2026-10-28"], {
    type: "Regular",
    shift: "Morning",
    shiftStartTime: "06:00",
    overtimeMinutes: 30,
  });
  assert.deepEqual(cloudWorkspace.shiftTemplates, [{
    id: "morning",
    startTime: "06:00",
  }]);
});

test("travel plans and their separate expense history remain in cloud workspace data", () => {
  const travelPlans = [{
    id: "trip-1",
    name: "Japan Trip",
    destination: "Japan",
    startDate: "2026-11-01",
    endDate: "2026-11-05",
    budget: 25000,
    currency: "PHP",
    completedAt: null,
    expenses: [{
      id: "trip-expense-1",
      name: "Flight",
      category: "Flights",
      date: "2026-11-01",
      amount: 8000,
      paidBy: "John",
      forPeople: ["John", "Mary", "Alex"],
      method: "Credit card",
    }],
  }];
  const workspace = serializeWorkspaceForCloud({
    expenses: [{ id: "regular-1", name: "Groceries", amount: 500 }],
    travelPlans,
  });

  assert.deepEqual(workspace.travelPlans, travelPlans);
  assert.deepEqual(workspace.expenses, [
    { id: "regular-1", name: "Groceries", amount: 500 },
  ]);
});

test("payroll deduction settings stay private for encrypted vault sync", () => {
  const payrollSettings = {
    payrollDeductionMode: "manual",
    manualSssPerPaycheck: "125.50",
    manualPhilHealthPerPaycheck: "200",
    manualPagIbigPerPaycheck: "100",
    sssFrequency: "split_monthly",
    sssFirstCutoffAmount: "500",
    sssSecondCutoffAmount: "500",
    philHealthFrequency: "monthly",
    philHealthMonthlyCutoff: "25",
    pagIbigFrequency: "custom",
    pagIbigFirstCutoffAmount: "50",
    pagIbigSecondCutoffAmount: "75",
  };
  const workspaceData = serializeWorkspaceForCloud(payrollSettings);

  assert.deepEqual(extractPrivateFinancialSettings(payrollSettings), {
    dailyWage: "",
    dailyAllowance: "0",
    overtimeMultiplier: "1.25",
    nightDifferential: "10",
    ...payrollSettings,
  });
  assert.deepEqual(workspaceData, {});
});

test("employee incentive records are retained in private vault settings", () => {
  const employeeIncentives = [
    { id: "incentive-1", name: "Performance bonus", amount: 500, date: "2026-10-10" },
  ];
  assert.deepEqual(
    extractPrivateFinancialSettings({ employeeIncentives }).employeeIncentives,
    employeeIncentives,
  );
  assert.equal(
    serializeWorkspaceForCloud({ employeeIncentives }).employeeIncentives,
    undefined,
  );
});

test("private settings provide defaults for older salary vaults", () => {
  assert.deepEqual(extractPrivateFinancialSettings({}), {
    dailyWage: "",
    dailyAllowance: "0",
    overtimeMultiplier: "1.25",
    nightDifferential: "10",
    payrollDeductionMode: "automatic",
    manualSssPerPaycheck: "0",
    manualPhilHealthPerPaycheck: "0",
    manualPagIbigPerPaycheck: "0",
  });
});

test("device-only financial fields merge back into local attendance", () => {
  const attendance = mergeLocalPrivateAttendance({
    "2026-10-28": { type: "Regular", shift: "Morning" },
  }, {
    "2026-10-28": { base: "P2500.00", est: "P2500.00 PHP" },
  });

  assert.deepEqual(attendance["2026-10-28"], {
    type: "Regular",
    shift: "Morning",
    base: "P2500.00",
    est: "P2500.00 PHP",
  });
});

test("manual corrections remain visible over their original punch record", () => {
  const attendance = mergeAttendancePunches({
    "2026-10-28": { type: "Regular", punchSource: "manual", workStartTime: "08:00" },
  }, [{
    shift_date: "2026-10-28",
    attendance_record: { type: "Regular", punchSource: "ordinary", workStartTime: "06:00" },
  }]);

  assert.equal(attendance["2026-10-28"].punchSource, "manual");
  assert.equal(attendance["2026-10-28"].workStartTime, "08:00");
});
