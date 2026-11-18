import test from "node:test";
import assert from "node:assert/strict";
import { switchPayrollBasis } from "./payrollSettingsBasis.js";

test("daily rate survives switching to monthly basis and back", () => {
  const dailySettings = {
    payrollBasis: "daily",
    dailyWage: "645",
    monthlySalary: "645",
    workingDaysFactor: "26",
  };

  const monthlySettings = switchPayrollBasis(dailySettings, "monthly");
  assert.equal(monthlySettings.monthlySalary, "16770");

  const restoredSettings = switchPayrollBasis(monthlySettings, "daily");
  assert.equal(restoredSettings.dailyWage, "645");
});
