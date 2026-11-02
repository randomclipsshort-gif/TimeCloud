function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function getLegacyExpenseDate(id) {
  const timestampText = typeof id === "number"
    ? String(id)
    : typeof id === "string" ? id.match(/^\d{13}/)?.[0] : null;
  const timestamp = Number(timestampText);
  if (!Number.isFinite(timestamp) || timestamp < 946684800000 || timestamp > 4102444800000) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getExpenseDate(expense) {
  if (isValidDateKey(expense?.date)) return expense.date;
  return getLegacyExpenseDate(expense?.id);
}

export function getExpensesForMonth(expenses, month) {
  if (!Array.isArray(expenses) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")) {
    return [];
  }
  return expenses.filter((expense) => getExpenseDate(expense)?.startsWith(`${month}-`));
}

export function getExpensesForPeriod(expenses, period) {
  if (
    !Array.isArray(expenses) ||
    !isValidDateKey(period?.startDate) ||
    !isValidDateKey(period?.endDate) ||
    period.startDate > period.endDate
  ) {
    return [];
  }
  return expenses.filter((expense) => {
    const date = getExpenseDate(expense);
    return date && date >= period.startDate && date <= period.endDate;
  });
}

export function getBudgetUtilization(netEarnings, totalExpenses) {
  const net = Number(netEarnings);
  const expenses = Number(totalExpenses);
  const safeNet = Number.isFinite(net) ? net : 0;
  const safeExpenses = Number.isFinite(expenses) ? expenses : 0;
  return {
    remaining: safeNet - safeExpenses,
    percentage: safeNet > 0 ? Math.max((safeExpenses / safeNet) * 100, 0) : 0,
  };
}
