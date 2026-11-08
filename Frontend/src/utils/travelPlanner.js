const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEFAULT_CATEGORIES = [
  "Flights",
  "Accommodation",
  "Food and drinks",
  "Transportation",
  "Activities and entertainment",
  "Shopping",
  "Travel documents",
  "Other expenses",
];

export const travelExpenseCategories = DEFAULT_CATEGORIES;

export function isValidTravelDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function normalizeTravelPlans(plans) {
  if (!Array.isArray(plans)) return [];
  return plans
    .filter((plan) =>
      plan &&
      typeof plan === "object" &&
      !Array.isArray(plan) &&
      typeof plan.id === "string" &&
      plan.id.length > 0 &&
      typeof plan.name === "string" &&
      typeof plan.destination === "string" &&
      isValidTravelDate(plan.startDate) &&
      isValidTravelDate(plan.endDate) &&
      plan.startDate <= plan.endDate &&
      Number.isFinite(Number(plan.budget)) &&
      Number(plan.budget) > 0 &&
      /^[A-Z]{3}$/.test(plan.currency || "") &&
      Array.isArray(plan.expenses),
    )
    .map((plan) => ({
      ...plan,
      budget: Number(plan.budget),
      notes: typeof plan.notes === "string" ? plan.notes : "",
      completedAt: typeof plan.completedAt === "string" ? plan.completedAt : null,
      expenses: plan.expenses
        .filter((expense) =>
          expense &&
          typeof expense === "object" &&
          !Array.isArray(expense) &&
          typeof expense.id === "string" &&
          expense.id.length > 0 &&
          typeof expense.name === "string" &&
          typeof expense.category === "string" &&
          isValidTravelDate(expense.date) &&
          Number.isFinite(Number(expense.amount)) &&
          Number(expense.amount) > 0,
        )
        .map((expense) => ({
          ...expense,
          amount: Number(expense.amount),
          paidBy: typeof expense.paidBy === "string" ? expense.paidBy : "",
          forPeople: normalizeTravelPeople(expense.forPeople),
          splitEqually: expense.splitEqually === true,
          method: typeof expense.method === "string"
            ? expense.method
            : "",
          notes: typeof expense.notes === "string" ? expense.notes : "",
        })),
    }));
}

export function removeTravelPlan(plans, tripId) {
  if (!Array.isArray(plans) || !plans.some((plan) => plan.id === tripId)) {
    throw new Error("The travel plan could not be found.");
  }
  return plans.filter((plan) => plan.id !== tripId);
}

export function validateTravelPlan(plan) {
  if (!plan || typeof plan.name !== "string" || !plan.name.trim()) {
    return "Enter a trip name.";
  }
  if (plan.name.trim().length > 100) return "Trip names must be 100 characters or fewer.";
  if (typeof plan.destination !== "string" || !plan.destination.trim()) {
    return "Enter a destination.";
  }
  if (plan.destination.trim().length > 100) return "Destinations must be 100 characters or fewer.";
  if (!isValidTravelDate(plan.startDate) || !isValidTravelDate(plan.endDate)) {
    return "Choose valid start and end dates.";
  }
  if (plan.startDate > plan.endDate) return "The end date must be on or after the start date.";
  if (!Number.isFinite(Number(plan.budget)) || Number(plan.budget) <= 0) {
    return "Enter a budget greater than zero.";
  }
  if (plan.notes != null && (
    typeof plan.notes !== "string" || plan.notes.length > 1000
  )) {
    return "Travel notes must be 1,000 characters or fewer.";
  }
  if (!/^[A-Z]{3}$/.test(plan.currency || "")) return "Choose a valid currency.";
  return "";
}

export function validateTravelExpense(expense) {
  if (!expense || typeof expense.name !== "string" || !expense.name.trim()) {
    return "Enter an expense description.";
  }
  if (expense.name.trim().length > 100) {
    return "Expense descriptions must be 100 characters or fewer.";
  }
  if (expense.paidBy != null && typeof expense.paidBy !== "string") {
    return "Paid By must be text.";
  }
  if (typeof expense.paidBy === "string" && expense.paidBy.trim().length > 100) {
    return "Paid By must be 100 characters or fewer.";
  }
  if (expense.forPeople != null && !Array.isArray(expense.forPeople)) {
    return "Expense For must be a list of names.";
  }
  const forPeople = Array.isArray(expense.forPeople) ? expense.forPeople : [];
  if (
    forPeople.some((person) =>
      typeof person !== "string" || !person.trim() || person.trim().length > 100
    )
  ) {
    return "Expense For names must be 100 characters or fewer.";
  }
  const uniquePeople = new Set(forPeople.map((person) => person.trim().toLocaleLowerCase()));
  if (uniquePeople.size !== forPeople.length) {
    return "Remove duplicate names from Expense For.";
  }
  if (typeof expense.category !== "string" || !expense.category.trim()) {
    return "Choose or enter a category.";
  }
  if (expense.category.trim().length > 60) return "Categories must be 60 characters or fewer.";
  if (!isValidTravelDate(expense.date)) return "Choose a valid expense date.";
  if (!Number.isFinite(Number(expense.amount)) || Number(expense.amount) <= 0) {
    return "Enter an amount greater than zero.";
  }
  if (expense.notes != null && (
    typeof expense.notes !== "string" || expense.notes.length > 500
  )) {
    return "Expense notes must be 500 characters or fewer.";
  }
  if (expense.method != null && (
    typeof expense.method !== "string" || expense.method.length > 40
  )) {
    return "Payment methods must be 40 characters or fewer.";
  }
  return "";
}

export function getTravelPlanStatus(plan, today) {
  if (plan?.completedAt || plan?.endDate < today) return "Completed";
  if (plan?.startDate > today) return "Upcoming";
  return "Ongoing";
}

export function getTravelPlanTotals(plan) {
  const spent = (Array.isArray(plan?.expenses) ? plan.expenses : []).reduce(
    (total, expense) => {
      const amount = Number(expense?.amount);
      return total + (Number.isFinite(amount) && amount > 0 ? amount : 0);
    },
    0,
  );
  const budget = Number(plan?.budget);
  const safeBudget = Number.isFinite(budget) && budget > 0 ? budget : 0;
  return {
    spent,
    budget: safeBudget,
    remaining: safeBudget - spent,
    percentage: safeBudget > 0 ? (spent / safeBudget) * 100 : 0,
  };
}

export function getTravelBudgetStatus(percentage) {
  if (percentage > 100) return "Overspent";
  if (percentage >= 90) return "Near budget limit";
  if (percentage >= 75) return "Approaching budget limit";
  return "Within budget";
}

export function getTravelDaysInclusive(startDate, endDate) {
  if (!isValidTravelDate(startDate) || !isValidTravelDate(endDate) || startDate > endDate) {
    return 0;
  }
  return (
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) /
      DAY_MILLISECONDS +
    1
  );
}

export function getTravelCategoryTotals(expenses) {
  return (Array.isArray(expenses) ? expenses : []).reduce((totals, expense) => {
    const category = typeof expense?.category === "string" ? expense.category : "";
    const amount = Number(expense?.amount);
    if (category && Number.isFinite(amount) && amount > 0) {
      totals[category] = (totals[category] || 0) + amount;
    }
    return totals;
  }, {});
}

export function normalizeTravelPeople(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .filter((person) => typeof person === "string")
    .map((person) => person.trim())
    .filter((person) => {
      const key = person.toLocaleLowerCase();
      if (!person || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getTravelExpenseAllocations(expense) {
  const people = normalizeTravelPeople(expense?.forPeople);
  if (people.length === 0) return {};
  const amount = Number(expense.amount);
  if (!Number.isFinite(amount) || amount <= 0) return {};
  if (people.length === 1) return { [people[0]]: amount };
  if (expense.splitEqually !== true) return {};
  const cents = Math.round(amount * 100);
  const baseCents = Math.floor(cents / people.length);
  const remainingCents = cents - baseCents * people.length;
  return Object.fromEntries(people.map((person, index) => [
    person,
    (baseCents + (index < remainingCents ? 1 : 0)) / 100,
  ]));
}

export function getTravelPeopleReport(expenses) {
  const report = new Map();
  const getPerson = (name) => {
    const key = name.toLocaleLowerCase();
    if (!report.has(key)) {
      report.set(key, {
        name,
        paid: 0,
        paidExpenseCount: 0,
        forExpenseCount: 0,
        allocated: 0,
        allocatedExpenseCount: 0,
      });
    }
    return report.get(key);
  };
  let sharedExpenseCount = 0;
  let unallocatedSharedTotal = 0;
  for (const expense of Array.isArray(expenses) ? expenses : []) {
    const amount = Number(expense?.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const payer = typeof expense.paidBy === "string" ? expense.paidBy.trim() : "";
    const people = normalizeTravelPeople(expense.forPeople);
    if (payer) {
      const existing = getPerson(payer);
      existing.paid += amount;
      existing.paidExpenseCount += 1;
    }
    if (people.length > 1) {
      sharedExpenseCount += 1;
      if (expense.splitEqually !== true) unallocatedSharedTotal += amount;
    }
    for (const person of people) {
      const existing = getPerson(person);
      existing.forExpenseCount += 1;
      const allocation = getTravelExpenseAllocations(expense)[person];
      if (Number.isFinite(allocation)) {
        existing.allocated += allocation;
        existing.allocatedExpenseCount += 1;
      }
    }
  }
  return {
    people: [...report.values()].sort((left, right) => left.name.localeCompare(right.name)),
    sharedExpenseCount,
    unallocatedSharedTotal,
  };
}

export function appendTravelExpense(plans, tripId, expense) {
  const trip = plans.find((plan) => plan.id === tripId);
  if (!trip) throw new Error("The travel plan could not be found.");
  if (trip.expenses.some((item) => item.id === expense.id)) {
    throw new Error("A travel expense with this identifier already exists.");
  }
  return plans.map((plan) =>
    plan.id === tripId ? { ...plan, expenses: [...plan.expenses, expense] } : plan,
  );
}

export function replaceTravelExpense(plans, tripId, expenseId, updatedExpense) {
  const trip = plans.find((plan) => plan.id === tripId);
  if (!trip || !trip.expenses.some((item) => item.id === expenseId)) {
    throw new Error("The travel expense could not be found.");
  }
  return plans.map((plan) =>
    plan.id === tripId
      ? {
          ...plan,
          expenses: plan.expenses.map((item) =>
            item.id === expenseId ? { ...item, ...updatedExpense, id: expenseId } : item,
          ),
        }
      : plan,
  );
}

export function removeTravelExpense(plans, tripId, expenseId) {
  const trip = plans.find((plan) => plan.id === tripId);
  if (!trip || !trip.expenses.some((item) => item.id === expenseId)) {
    throw new Error("The travel expense could not be found.");
  }
  return plans.map((plan) =>
    plan.id === tripId
      ? { ...plan, expenses: plan.expenses.filter((item) => item.id !== expenseId) }
      : plan,
  );
}

export function formatTravelCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}
