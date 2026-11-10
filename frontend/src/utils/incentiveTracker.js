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

function isValidIncentive(incentive) {
  return incentive &&
    typeof incentive.id === "string" &&
    incentive.id.length > 0 &&
    typeof incentive.name === "string" &&
    incentive.name.trim().length > 0 &&
    isValidDateKey(incentive.date) &&
    Number.isFinite(Number(incentive.amount)) &&
    Number(incentive.amount) > 0;
}

export function getIncentivesForPeriod(incentives, period) {
  if (
    !Array.isArray(incentives) ||
    !isValidDateKey(period?.startDate) ||
    !isValidDateKey(period?.endDate) ||
    period.startDate > period.endDate
  ) return [];
  return incentives.filter((incentive) =>
    isValidIncentive(incentive) &&
    incentive.date >= period.startDate &&
    incentive.date <= period.endDate,
  );
}

export function getIncentivesForDate(incentives, date) {
  if (!Array.isArray(incentives) || !isValidDateKey(date)) return [];
  return incentives.filter((incentive) =>
    isValidIncentive(incentive) && incentive.date === date,
  );
}

export function getIncentiveTotal(incentives) {
  if (!Array.isArray(incentives)) return 0;
  const total = incentives.reduce(
    (sum, incentive) =>
      sum + (isValidIncentive(incentive) ? Number(incentive.amount) : 0),
    0,
  );
  return Math.round((total + Number.EPSILON) * 100) / 100;
}
