import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePayrollDeductions,
  estimateEmployeeContributions,
} from "./payrollDeductions.js";

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
