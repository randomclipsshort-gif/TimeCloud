const DAY_MINUTES = 24 * 60;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return { year, month, day, ordinal: Math.floor(date.getTime() / DAY_MILLISECONDS) };
}

function dateKeyFromParts(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(dateKey, amount) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  const date = new Date(parsed.ordinal * DAY_MILLISECONDS);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function periodFromParts(year, month, cutoffDay) {
  const endDate = dateKeyFromParts(year, month, cutoffDay);
  const startDate = cutoffDay === 10
    ? dateKeyFromParts(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1, 26)
    : dateKeyFromParts(year, month, 11);
  return { startDate, endDate };
}

export function isValidPayrollPeriodEndDate(value) {
  const parsed = parseDateKey(value);
  return Boolean(parsed && (parsed.day === 10 || parsed.day === 25));
}

export function isPayrollPeriodEarningsAvailable(vaultStatus) {
  return ["unlocked", "uninitialized"].includes(vaultStatus);
}

export function getPayrollPeriodForEndDate(endDate) {
  if (!isValidPayrollPeriodEndDate(endDate)) return null;
  const { year, month, day } = parseDateKey(endDate);
  return periodFromParts(year, month, day);
}

export function getPayrollPeriodForMonth(monthValue, cutoffDay) {
  if (
    typeof monthValue !== "string" ||
    !/^\d{4}-\d{2}$/.test(monthValue) ||
    ![10, 25].includes(Number(cutoffDay))
  ) return null;
  const [year, month] = monthValue.split("-").map(Number);
  const date = parseDateKey(dateKeyFromParts(year, month, 1));
  if (!date) return null;
  return periodFromParts(year, month, Number(cutoffDay));
}

export function getPayrollPeriodForDate(dateKey) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  if (parsed.day <= 10) {
    return periodFromParts(parsed.year, parsed.month, 10);
  }
  if (parsed.day <= 25) {
    return periodFromParts(parsed.year, parsed.month, 25);
  }
  const nextMonth = parsed.month === 12 ? 1 : parsed.month + 1;
  const nextYear = parsed.month === 12 ? parsed.year + 1 : parsed.year;
  return periodFromParts(nextYear, nextMonth, 10);
}

export function getPreviousPayrollPeriod(period) {
  const previousDate = period && addDays(period.startDate, -1);
  return previousDate ? getPayrollPeriodForDate(previousDate) : null;
}

export function getNextPayrollPeriod(period) {
  const nextDate = period && addDays(period.endDate, 1);
  return nextDate ? getPayrollPeriodForDate(nextDate) : null;
}

export function formatPayrollPeriod(period) {
  if (!period || !parseDateKey(period.startDate) || !parseDateKey(period.endDate)) return "";
  const start = parseDateKey(period.startDate);
  const end = parseDateKey(period.endDate);
  const startMonth = MONTH_NAMES[start.month - 1].slice(0, 3);
  const endMonth = MONTH_NAMES[end.month - 1].slice(0, 3);
  if (start.year === end.year && start.month === end.month) {
    return `${startMonth} ${start.day}–${end.day}, ${end.year}`;
  }
  return `${startMonth} ${start.day}, ${start.year}–${endMonth} ${end.day}, ${end.year}`;
}

function parseTimeMinutes(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour < 1)) return null;
  if (meridiem) hour = (hour % 12) + (meridiem === "PM" ? 12 : 0);
  return hour * 60 + minute;
}

function getAttendanceInterval(dateKey, record) {
  if (!record || record.clockedIn) return null;
  const parsedDate = parseDateKey(dateKey);
  const start = parseTimeMinutes(record.workStartTime || record.in);
  const endOfDay = parseTimeMinutes(record.workEndTime || record.out);
  if (!parsedDate || start === null || endOfDay === null || start === endOfDay) return null;
  const end = endOfDay <= start ? endOfDay + DAY_MINUTES : endOfDay;
  if (end <= start || end - start > DAY_MINUTES) return null;
  return {
    start: parsedDate.ordinal * DAY_MINUTES + start,
    end: parsedDate.ordinal * DAY_MINUTES + end,
  };
}

function getAmount(value) {
  const amount = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

export function summarizePayrollPeriod(
  attendance,
  period,
  getEarningsForRecord = (record) => getAmount(record.est),
) {
  const parsedStart = period && parseDateKey(period.startDate);
  const parsedEnd = period && parseDateKey(period.endDate);
  if (!parsedStart || !parsedEnd || parsedStart.ordinal > parsedEnd.ordinal) {
    return {
      eligibleWorkdays: 0,
      regularHours: 0,
      overtimeHours: 0,
      recordedEarnings: 0,
      incompleteClockOuts: 0,
    };
  }

  let eligibleWorkdays = 0;
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let recordedEarnings = 0;
  let incompleteClockOuts = 0;

  for (const [dateKey, record] of Object.entries(attendance || {})) {
    const parsedDate = parseDateKey(dateKey);
    if (!parsedDate || !record || typeof record !== "object") continue;
    const dateIsInPeriod =
      parsedDate.ordinal >= parsedStart.ordinal &&
      parsedDate.ordinal <= parsedEnd.ordinal;

    if (record.clockedIn) {
      if (dateIsInPeriod) incompleteClockOuts += 1;
      continue;
    }

    if (record.type === "Leave") {
      if (dateIsInPeriod) recordedEarnings += getAmount(record.est);
      continue;
    }
    if (["Absent", "Rest Day", "Unassigned"].includes(record.type)) continue;

    const interval = getAttendanceInterval(dateKey, record);
    if (!interval) continue;
    const workedMinutes = interval.end - interval.start;
    if (!dateIsInPeriod) continue;

    const claimedOvertimeMinutes = Number(record.overtimeMinutes);
    const recordOvertimeMinutes = Number.isFinite(claimedOvertimeMinutes)
      ? Math.min(Math.max(claimedOvertimeMinutes, 0), workedMinutes)
      : 0;
    const regularEnd = interval.end - recordOvertimeMinutes;
    regularMinutes += regularEnd - interval.start;
    overtimeMinutes += interval.end - regularEnd;
    eligibleWorkdays += 1;
    recordedEarnings += getAmount(getEarningsForRecord(record, dateKey));
  }

  return {
    eligibleWorkdays,
    regularHours: regularMinutes / 60,
    overtimeHours: overtimeMinutes / 60,
    recordedEarnings,
    incompleteClockOuts,
  };
}
