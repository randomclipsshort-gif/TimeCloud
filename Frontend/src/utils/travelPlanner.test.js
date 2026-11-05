import test from "node:test";
import assert from "node:assert/strict";
import {
  appendTravelExpense,
  formatTravelCurrency,
  getTravelExpenseAllocations,
  getTravelBudgetStatus,
  getTravelCategoryTotals,
  getTravelPeopleReport,
  getTravelDaysInclusive,
  getTravelPlanStatus,
  getTravelPlanTotals,
  normalizeTravelPlans,
  removeTravelExpense,
  replaceTravelExpense,
  validateTravelExpense,
  validateTravelPlan,
} from "./travelPlanner.js";

const plan = {
  id: "trip-1",
  name: "Japan Trip",
  destination: "Japan",
  startDate: "2026-11-01",
  endDate: "2026-11-05",
  budget: 25000,
  currency: "PHP",
  expenses: [
    { id: "flight", category: "Flights", amount: 8000 },
    { id: "hotel", category: "Accommodation", amount: 6000 },
    { id: "food", category: "Food and drinks", amount: 3500 },
    { id: "transport", category: "Transportation", amount: 2000 },
    { id: "shopping", category: "Shopping", amount: 2000 },
  ],
};

test("travel totals calculate spent, remaining, and budget usage", () => {
  assert.deepEqual(getTravelPlanTotals(plan), {
    spent: 21500,
    budget: 25000,
    remaining: 3500,
    percentage: 86,
  });
  assert.equal(getTravelBudgetStatus(74.99), "Within budget");
  assert.equal(getTravelBudgetStatus(75), "Approaching budget limit");
  assert.equal(getTravelBudgetStatus(89.99), "Approaching budget limit");
  assert.equal(getTravelBudgetStatus(90), "Near budget limit");
  assert.equal(getTravelBudgetStatus(100), "Near budget limit");
  assert.equal(getTravelBudgetStatus(108), "Overspent");
  const overspent = getTravelPlanTotals({
    ...plan,
    expenses: [{ id: "over", amount: 27000 }],
  });
  assert.equal(overspent.remaining, -2000);
  assert.equal(overspent.percentage, 108);
});

test("travel plans are validated and completed plans stay historical", () => {
  assert.equal(validateTravelPlan(plan), "");
  assert.match(validateTravelPlan({ ...plan, endDate: "2026-10-31" }), /on or after/);
  assert.equal(getTravelPlanStatus(plan, "2026-10-31"), "Upcoming");
  assert.equal(getTravelPlanStatus(plan, "2026-11-03"), "Ongoing");
  assert.equal(getTravelPlanStatus(plan, "2026-11-06"), "Completed");
  assert.equal(getTravelPlanStatus({ ...plan, completedAt: "2026-11-04" }, "2026-11-04"), "Completed");
});

test("travel expense history preserves distinct expenses and validates values", () => {
  const expenses = [
    { id: "one", name: "Lunch", category: "Food", date: "2026-11-02", amount: 100, paidBy: "John", forPeople: ["John"] },
    { id: "two", name: "Lunch", category: "Food", date: "2026-11-02", amount: 200, paidBy: "John", forPeople: ["Mary", "Alex"] },
  ];
  assert.equal(normalizeTravelPlans([{ ...plan, expenses }])[0].expenses.length, 2);
  assert.equal(validateTravelExpense(expenses[0]), "");
  assert.equal(
    validateTravelExpense({ ...expenses[0], forPeople: [] }),
    "",
  );
  assert.equal(
    validateTravelExpense({ ...expenses[0], paidBy: "" }),
    "",
  );
  assert.match(validateTravelExpense({ ...expenses[0], amount: 0 }), /greater than zero/);
  assert.deepEqual(getTravelCategoryTotals(expenses), { Food: 300 });
  assert.deepEqual(getTravelExpenseAllocations(expenses[0]), { John: 100 });
  assert.deepEqual(getTravelExpenseAllocations(expenses[1]), {});
  assert.deepEqual(getTravelPeopleReport(expenses), {
    people: [
      { name: "Alex", paid: 0, paidExpenseCount: 0, forExpenseCount: 1, allocated: 0, allocatedExpenseCount: 0 },
      { name: "John", paid: 300, paidExpenseCount: 2, forExpenseCount: 1, allocated: 100, allocatedExpenseCount: 1 },
      { name: "Mary", paid: 0, paidExpenseCount: 0, forExpenseCount: 1, allocated: 0, allocatedExpenseCount: 0 },
    ],
    sharedExpenseCount: 1,
    unallocatedSharedTotal: 200,
  });
});

test("legacy travel expenses remain intact with empty payer and owner fields", () => {
  const legacyExpense = {
    id: "legacy",
    name: "Hotel",
    category: "Accommodation",
    date: "2026-11-02",
    amount: 8000,
    method: "Card",
    notes: "Existing record",
  };
  const [normalized] = normalizeTravelPlans([
    { ...plan, expenses: [legacyExpense] },
  ]);
  assert.equal(normalized.expenses.length, 1);
  assert.equal(normalized.expenses[0].paidBy, "");
  assert.deepEqual(normalized.expenses[0].forPeople, []);
  assert.equal(normalized.expenses[0].amount, 8000);
  assert.equal(normalized.expenses[0].notes, "Existing record");
});

test("shared expense allocations split amount once with cent precision", () => {
  const shared = {
    id: "dinner",
    amount: 3000,
    paidBy: "John",
    forPeople: ["John", "Mary", "Alex"],
    splitEqually: true,
  };
  assert.deepEqual(getTravelExpenseAllocations(shared), {
    John: 1000,
    Mary: 1000,
    Alex: 1000,
  });
  assert.deepEqual(
    getTravelExpenseAllocations({ ...shared, amount: 10, forPeople: ["John", "Mary", "Alex"] }),
    { John: 3.34, Mary: 3.33, Alex: 3.33 },
  );
  assert.equal(getTravelPlanTotals({ ...plan, expenses: [shared] }).spent, 3000);
});

test("adding travel expenses appends without overwriting and edits/deletes only the target", () => {
  const first = { id: "one", name: "Lunch", category: "Food", date: "2026-11-02", amount: 100, method: "Cash" };
  const second = { id: "two", name: "Lunch", category: "Food", date: "2026-11-02", amount: 200, method: "Cash" };
  const plans = [{ ...plan, expenses: [first] }];
  const afterAdd = appendTravelExpense(plans, plan.id, second);

  assert.equal(afterAdd[0].expenses.length, 2);
  assert.equal(afterAdd[0].expenses[1].id, "two");
  assert.throws(() => appendTravelExpense(afterAdd, plan.id, second), /already exists/);

  const afterEdit = replaceTravelExpense(afterAdd, plan.id, "one", { amount: 150 });
  assert.deepEqual(afterEdit[0].expenses.map((expense) => expense.amount), [150, 200]);
  const afterDelete = removeTravelExpense(afterEdit, plan.id, "two");
  assert.deepEqual(afterDelete[0].expenses.map((expense) => expense.id), ["one"]);
  assert.equal(plans[0].expenses.length, 1);
});

test("travel ranges count inclusive days and format supported currencies", () => {
  assert.equal(getTravelDaysInclusive("2026-11-01", "2026-11-05"), 5);
  assert.equal(getTravelDaysInclusive("2024-02-28", "2024-03-01"), 3);
  assert.equal(getTravelDaysInclusive("2026-11-05", "2026-11-01"), 0);
  assert.equal(formatTravelCurrency(25000, "PHP"), "₱25,000.00");
});
