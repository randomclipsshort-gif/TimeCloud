const DAY_MINUTES = 24 * 60;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

const categoryDefinitions = [
  { id: "basicPay", label: "Basic Pay", unit: "days" },
  { id: "allowance", label: "Allowance", unit: "days" },
  { id: "shiftDifferentials", label: "Shift Differentials", unit: "days" },
  { id: "regularHoliday", label: "Holiday reg", unit: "days" },
  { id: "specialHoliday", label: "Holiday non-special", unit: "days" },
  { id: "overtime", label: "Overtime Pay", unit: "hours" },
  { id: "paidSickLeave", label: "Paid Sick Leave", unit: "days" },
  { id: "otherPaidLeave", label: "Other Paid Leave", unit: "days" },
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
  return Math.floor(date.getTime() / DAY_MILLISECONDS);
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
  const dateOrdinal = parseDateKey(dateKey);
  const start = parseTimeMinutes(record.workStartTime || record.in);
  const endOfDay = parseTimeMinutes(record.workEndTime || record.out);
  if (dateOrdinal === null || start === null || endOfDay === null || start === endOfDay) return null;
  const end = endOfDay <= start ? endOfDay + DAY_MINUTES : endOfDay;
  if (end <= start || end - start > DAY_MINUTES) return null;
  return {
    start: dateOrdinal * DAY_MINUTES + start,
    end: dateOrdinal * DAY_MINUTES + end,
    dateOrdinal,
  };
}

function emptyBreakdown() {
  return {
    items: [],
    lateMinutes: 0,
    undertimeMinutes: 0,
    totalAdjustments: 0,
  };
}

function formatRate(total, units) {
  return units > 0 ? total / units : 0;
}

export function summarizePayrollEarningsBreakdown(
  attendance,
  period,
  getRecordBreakdown,
) {
  const startOrdinal = period && parseDateKey(period.startDate);
  const endOrdinal = period && parseDateKey(period.endDate);
  if (
    startOrdinal === null ||
    startOrdinal === undefined ||
    endOrdinal === null ||
    endOrdinal === undefined ||
    startOrdinal > endOrdinal
  ) return emptyBreakdown();

  const rangeStart = startOrdinal * DAY_MINUTES;
  const rangeEnd = (endOrdinal + 1) * DAY_MINUTES;
  const categories = new Map(categoryDefinitions.map(({ id }) => [id, {
    total: 0,
    units: 0,
  }]));
  let lateMinutes = 0;
  let undertimeMinutes = 0;

  for (const [dateKey, record] of Object.entries(attendance || {})) {
    if (!record || typeof record !== "object") continue;
    const dateOrdinal = parseDateKey(dateKey);
    if (dateOrdinal === null) continue;

    const values = getRecordBreakdown(record, dateKey);
    if (!values || typeof values !== "object") continue;

    if (record.type === "Leave") {
      if (dateOrdinal < startOrdinal || dateOrdinal > endOrdinal) continue;
      const category = record.leaveCode === "SL" ? "paidSickLeave" : "otherPaidLeave";
      const amount = Number(values[category]);
      if (Number.isFinite(amount) && amount > 0) {
        const aggregate = categories.get(category);
        aggregate.total += amount;
        aggregate.units += 1;
      }
      continue;
    }

    const interval = getAttendanceInterval(dateKey, record);
    if (!interval) continue;
    const totalMinutes = interval.end - interval.start;
    const overlap = Math.max(
      0,
      Math.min(interval.end, rangeEnd) - Math.max(interval.start, rangeStart),
    );
    if (overlap <= 0) continue;
    const ratio = overlap / totalMinutes;
    if (interval.dateOrdinal >= startOrdinal && interval.dateOrdinal <= endOrdinal) {
      lateMinutes += Number.isFinite(Number(values.lateMinutes))
        ? Math.max(0, Number(values.lateMinutes))
        : 0;
      undertimeMinutes += Number.isFinite(Number(values.undertimeMinutes))
        ? Math.max(0, Number(values.undertimeMinutes))
        : 0;
    }
    for (const { id, unit } of categoryDefinitions) {
      const amount = Number(values[id]);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const aggregate = categories.get(id);
      aggregate.total += amount * ratio;
      if (unit === "hours") {
        const minutes = Number(values.overtimeMinutes);
        const hours = Number.isFinite(minutes) && minutes > 0
          ? minutes / 60
          : Number(values.overtimeHours) || 0;
        aggregate.units += hours * ratio;
      } else {
        aggregate.units += ratio;
      }
    }
  }

  const items = categoryDefinitions
    .map(({ id, label, unit }) => {
      const { total, units } = categories.get(id);
      const roundedTotal = Math.round((total + Number.EPSILON) * 100) / 100;
      return {
        id,
        label,
        unit,
        units,
        rate: formatRate(roundedTotal, units),
        total: roundedTotal,
      };
    })
    .filter((item) => item.total > 0);

  if (lateMinutes > 0 || undertimeMinutes > 0) {
    items.push({
      id: "lateUndertime",
      label: "Late/UT",
      unit: "minutes",
      units: lateMinutes + undertimeMinutes,
      lateMinutes,
      undertimeMinutes,
      rate: 0,
      total: 0,
      informational: true,
    });
  }

  return {
    items,
    lateMinutes,
    undertimeMinutes,
    totalAdjustments: 0,
  };
}
