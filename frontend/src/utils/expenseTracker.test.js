import test from "node:test";
import assert from "node:assert/strict";
import {
  getBudgetUtilization,
  getExpenseDate,
  getExpensesForMonth,
  getExpensesForPeriod,
  normalizeExpenseRecords,
} from "./expenseTracker.js";

test("expense totals can be scoped to the selected month", () => {
  const expenses = [
    { id: 1, date: "2026-11-02", amount: 120 },
    { id: 2, date: "2026-10-31", amount: 80 },
    { id: 3, date: "2026-11-30", amount: 30 },
  ];

  assert.deepEqual(getExpensesForMonth(expenses, "2026-11"), [
    expenses[0],
    expenses[2],
  ]);
  assert.deepEqual(getExpensesForMonth(expenses, "2026-10"), [expenses[1]]);
});

test("legacy expenses use their timestamp in the Manila time zone", () => {
  const expense = { id: Date.UTC(2026, 9, 31, 16, 30), amount: 50 };

  assert.equal(getExpenseDate(expense), "2026-11-01");
  assert.deepEqual(getExpensesForMonth([expense], "2026-11"), [expense]);
  assert.deepEqual(getExpensesForMonth([expense], "2026-10"), []);
});

test("expense normalization keeps duplicate legacy rows while assigning unique IDs", () => {
  const normalized = normalizeExpenseRecords([
    { id: 123, name: "First", amount: 10 },
    { id: 123, name: "Second", amount: 20 },
    { name: "Older expense", amount: 30 },
    { id: "legacy-expense-2", name: "Existing key", amount: 40 },
  ]);

  assert.equal(normalized.length, 4);
  assert.equal(normalized[0].id, 123);
  assert.equal(normalized[1].id, "legacy-expense-1");
  assert.equal(normalized[2].id, "legacy-expense-2-1");
  assert.equal(normalized[3].id, "legacy-expense-2");
});

test("expenses can be scoped to inclusive cutoff dates", () => {
  const expenses = [
    { id: 1, date: "2026-10-25", amount: 80 },
    { id: 2, date: "2026-10-26", amount: 120 },
    { id: 3, date: "2026-11-10", amount: 30 },
    { id: 4, date: "2026-11-11", amount: 50 },
  ];

  assert.deepEqual(
    getExpensesForPeriod(expenses, {
      startDate: "2026-10-26",
      endDate: "2026-11-10",
    }),
    [expenses[1], expenses[2]],
  );
  assert.deepEqual(
    getExpensesForPeriod(expenses, {
      startDate: "2026-11-11",
      endDate: "2026-10-26",
    }),
    [],
  );
});

test("invalid dates and invalid month selectors are excluded safely", () => {
  assert.equal(getExpenseDate({ id: 1, date: "2026-02-30" }), null);
  assert.deepEqual(getExpensesForMonth([{ id: 1, date: "2026-02-30" }], "2026-02"), []);
  assert.deepEqual(getExpensesForMonth([{ id: 1, date: "2026-11-02" }], "2026-13"), []);
  assert.deepEqual(getExpensesForPeriod([{ id: 1, date: "2026-11-02" }], {
    startDate: "2026-02-30",
    endDate: "2026-11-30",
  }), []);
});

test("budget utilization shows overspending without breaking the progress scale", () => {
  assert.deepEqual(getBudgetUtilization(1000, 1250), {
    remaining: -250,
    percentage: 125,
  });
  assert.deepEqual(getBudgetUtilization(0, 100), {
    remaining: -100,
    percentage: 0,
  });
});
