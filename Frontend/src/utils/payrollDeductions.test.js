import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCutoffPayrollDeductions,
  calculatePayrollDeductions,
  estimateEmployeeContributions,
  getPayrollDeductionSettingsDefaults,
  sumCutoffPayrollDeductions,
} from "./payrollDeductions.js";

const cutoff10 = { startDate: "2026-09-26", endDate: "2026-10-10" };
const cutoff25 = { startDate: "2026-10-11", endDate: "2026-10-25" };

test("estimates monthly employee contributions from gross pay", () => {
  assert.deepEqual(estimateEmployeeContributions(30_000), {
    sss: 1_500,
    philHealth: 750,
    pagIbig: 200,
    total: 2_450,
  });
});

test("caps contribution bases at their configured ceilings", () => {
  assert.deepEqual(estimateEmployeeContributions(120_000), {
    sss: 1_750,
    philHealth: 2_500,
    pagIbig: 200,
    total: 4_450,
  });
});

test("manual per-paycheck contributions are doubled for semi-monthly pay", () => {
  assert.deepEqual(calculatePayrollDeductions({
    mode: "manual",
    monthlyGrossPay: 30_000,
    manualPerPaycheck: {
      sss: "100.25",
      philHealth: "200",
      pagIbig: "50",
    },
    paychecksPerMonth: 2,
  }), {
    sss: 200.5,
    philHealth: 400,
    pagIbig: 100,
    total: 700.5,
  });
});

test("zero and invalid gross pay do not produce deductions", () => {
  assert.deepEqual(estimateEmployeeContributions(0), {
    sss: 0,
    philHealth: 0,
    pagIbig: 0,
    total: 0,
  });
  assert.deepEqual(estimateEmployeeContributions("not a number"), {
    sss: 0,
    philHealth: 0,
    pagIbig: 0,
    total: 0,
  });
});

test("monthly split amounts divide across the 10th and 25th cutoffs", () => {
  const settings = {
    payrollDeductionMode: "manual",
    sssFrequency: "split_monthly",
    philHealthFrequency: "split_monthly",
    pagIbigFrequency: "split_monthly",
    manualSssPerPaycheck: "1000",
    manualPhilHealthPerPaycheck: "0",
    manualPagIbigPerPaycheck: "0",
  };
  const first = calculateCutoffPayrollDeductions({
    period: cutoff10,
    mode: "manual",
    settings,
  });
  const second = calculateCutoffPayrollDeductions({
    period: cutoff25,
    mode: "manual",
    settings,
  });

  assert.equal(first.items.find((item) => item.id === "sss").amount, 500);
  assert.equal(second.items.find((item) => item.id === "sss").amount, 500);
  assert.equal(sumCutoffPayrollDeductions(first, second).sss, 1000);
});

test("monthly deductions apply once only on their configured cutoff", () => {
  const settings = {
    payrollDeductionMode: "manual",
    sssFrequency: "monthly",
    sssMonthlyCutoff: "25",
    manualSssPerPaycheck: "1000",
  };
  const first = calculateCutoffPayrollDeductions({
    period: cutoff10,
    mode: "manual",
    settings,
  });
  const second = calculateCutoffPayrollDeductions({
    period: cutoff25,
    mode: "manual",
    settings,
  });

  assert.equal(first.total, 0);
  assert.equal(second.total, 1000);
  assert.equal(sumCutoffPayrollDeductions(first, second).total, 1000);
});

test("every-cutoff amounts are charged once on each cutoff", () => {
  const settings = {
    payrollDeductionMode: "manual",
    sssFrequency: "every_cutoff",
    manualSssPerPaycheck: "300",
  };
  const first = calculateCutoffPayrollDeductions({
    period: cutoff10,
    mode: "manual",
    settings,
  });
  const second = calculateCutoffPayrollDeductions({
    period: cutoff25,
    mode: "manual",
    settings,
  });

  assert.equal(first.total, 300);
  assert.equal(second.total, 300);
  assert.equal(sumCutoffPayrollDeductions(first, second).total, 600);
});

test("custom cutoff amounts can differ and only employee contributions affect totals", () => {
  const calculation = calculateCutoffPayrollDeductions({
    period: cutoff10,
    mode: "manual",
    settings: {
      sssFrequency: "custom",
      sssFirstCutoffAmount: "125.25",
      sssSecondCutoffAmount: "275.50",
      philHealthFrequency: "custom",
      philHealthFirstCutoffAmount: "0",
      philHealthSecondCutoffAmount: "75",
    },
  });

  assert.equal(calculation.total, 125.25);
  assert.equal(calculation.employeeContributionTotal, 125.25);
  assert.ok(calculation.items.every((item) => item.employeePaid));
  assert.equal(calculation.items.find((item) => item.id === "sss").amount, 125.25);
  assert.equal(calculation.items.find((item) => item.id === "philHealth").amount, 0);
});

test("invalid settings are safely zeroed and old manual amounts remain per cutoff", () => {
  const settings = getPayrollDeductionSettingsDefaults({
    payrollDeductionMode: "manual",
    manualSssPerPaycheck: "-1",
    sssFrequency: "not-a-frequency",
  });
  const calculation = calculateCutoffPayrollDeductions({
    period: cutoff10,
    mode: settings.payrollDeductionMode,
    settings,
  });

  assert.equal(settings.sssFrequency, "every_cutoff");
  assert.equal(calculation.total, 0);
  assert.equal(calculateCutoffPayrollDeductions({
    period: { startDate: "2026-10-01", endDate: "2026-10-11" },
    mode: "manual",
    settings,
  }).total, 0);
});

test("switching cutoff periods recalculates without stale or duplicated amounts", () => {
  const settings = {
    payrollDeductionMode: "manual",
    sssFrequency: "custom",
    sssFirstCutoffAmount: "150",
    sssSecondCutoffAmount: "350",
  };
  const first = calculateCutoffPayrollDeductions({
    period: cutoff10,
    mode: "manual",
    settings,
  });
  const second = calculateCutoffPayrollDeductions({
    period: cutoff25,
    mode: "manual",
    settings,
  });

  assert.equal(first.total, 150);
  assert.equal(second.total, 350);
  assert.equal(calculateCutoffPayrollDeductions({
    period: cutoff10,
    mode: "manual",
    settings,
  }).total, 150);
  assert.equal(sumCutoffPayrollDeductions(first, first).total, 300);
});

test("automatic estimates use per-contribution frequencies without adding employer shares", () => {
  const monthlyEstimate = estimateEmployeeContributions(30_000);
  const settings = getPayrollDeductionSettingsDefaults({});
  const first = calculateCutoffPayrollDeductions({
    period: cutoff10,
    mode: "automatic",
    monthlyGrossPay: 30_000,
    settings,
  });
  const second = calculateCutoffPayrollDeductions({
    period: cutoff25,
    mode: "automatic",
    monthlyGrossPay: 30_000,
    settings,
  });

  assert.equal(first.total + second.total, monthlyEstimate.total);
  assert.equal(first.employeeContributionTotal, first.total);
  assert.equal(sumCutoffPayrollDeductions(first, second).total, monthlyEstimate.total);
});
