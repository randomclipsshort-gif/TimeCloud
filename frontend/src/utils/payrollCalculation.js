import {
  calculateHolidayPay,
  getAttendanceHours,
} from "./holidayPay.js";
import { getHolidayClassification } from "./holidayUtils.js";
import {
  getPayrollDeductionSettingsDefaults,
  payrollDeductionSettingKeys,
} from "./payrollDeductions.js";

const DAY_MINUTES = 24 * 60;
const payrollRateSettingKeys = [
  "dailyWage",
  "dailyAllowance",
  "overtimeMultiplier",
  "nightDifferential",
  ...payrollDeductionSettingKeys,
];

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

function getAmount(value) {
  const amount = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
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

function getNightShiftMinutes(startTime, endTime) {
  const start = parseTimeMinutes(startTime);
  const endOfDay = parseTimeMinutes(endTime);
  if (start === null || endOfDay === null) return 0;
  const end = endOfDay <= start ? endOfDay + DAY_MINUTES : endOfDay;
  let nightMinutes = 0;
  for (let day = Math.floor(start / DAY_MINUTES) - 1; day <= Math.floor(end / DAY_MINUTES); day += 1) {
    const nightStart = day * DAY_MINUTES + 22 * 60;
    const nightEnd = day * DAY_MINUTES + 30 * 60;
    nightMinutes += Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
  }
  return nightMinutes;
}

function getScheduledMinutes(record) {
  const start = parseTimeMinutes(record?.shiftStartTime);
  const endOfDay = parseTimeMinutes(record?.shiftEndTime);
  if (start === null || endOfDay === null || start === endOfDay) return null;
  const end = endOfDay <= start ? endOfDay + DAY_MINUTES : endOfDay;
  return end > start && end - start <= DAY_MINUTES ? end - start : null;
}

function getDailyWage(settings) {
  const amount = Number(settings?.dailyWage);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function getSettingsSnapshot(settings = {}) {
  const deductions = getPayrollDeductionSettingsDefaults(settings);
  return Object.fromEntries(payrollRateSettingKeys.map((key) => [
    key,
    key in deductions ? deductions[key] : settings[key] ?? "",
  ]));
}

export function getPayrollSettingsForDate(history, currentSettings, date) {
  const versions = Array.isArray(history)
    ? history.filter((version) =>
        isValidDateKey(version?.effectiveDate) &&
        version.settings &&
        typeof version.settings === "object" &&
        !Array.isArray(version.settings),
      )
    : [];
  if (versions.length === 0) return getSettingsSnapshot(currentSettings);
  if (!isValidDateKey(date)) return getSettingsSnapshot({});

  const orderedVersions = versions.sort((left, right) =>
    left.effectiveDate.localeCompare(right.effectiveDate),
  );
  // The first saved version is the baseline for pending first-setup backfill.
  const version =
    orderedVersions
      .filter((candidate) => candidate.effectiveDate <= date)
      .at(-1) || orderedVersions[0];
  return version ? getSettingsSnapshot(version.settings) : getSettingsSnapshot({});
}

export function buildPayrollSettingsHistory({
  history = [],
  currentSettings = {},
  nextSettings = {},
  effectiveDate,
  attendance = {},
}) {
  if (!isValidDateKey(effectiveDate)) {
    throw new Error("Choose a valid payroll settings effective date.");
  }

  const versions = Array.isArray(history)
    ? history.filter((version) =>
        isValidDateKey(version?.effectiveDate) &&
        version.settings &&
        typeof version.settings === "object" &&
        !Array.isArray(version.settings),
      ).map((version) => ({
        effectiveDate: version.effectiveDate,
        settings: getSettingsSnapshot(version.settings),
      }))
    : [];
  const sourceDates = Object.keys(attendance)
    .filter(isValidDateKey)
    .sort();
  const currentHasWage = getDailyWage(currentSettings) !== null;
  const nextHasWage = getDailyWage(nextSettings) !== null;
  const historyHasWage = versions.some(
    (version) => getDailyWage(version.settings) !== null,
  );

  if (versions.length === 0 && currentHasWage) {
    versions.push({
      effectiveDate: sourceDates[0] || effectiveDate,
      settings: getSettingsSnapshot(currentSettings),
    });
  }

  let nextEffectiveDate = effectiveDate;
  if (!currentHasWage && nextHasWage && !historyHasWage) {
    versions.length = 0;
  }
  if (!currentHasWage && nextHasWage && !historyHasWage && sourceDates.length > 0) {
    nextEffectiveDate = sourceDates[0];
  }

  const nextVersion = {
    effectiveDate: nextEffectiveDate,
    settings: getSettingsSnapshot(nextSettings),
  };
  const retainedVersions = versions.filter(
    (version) => version.effectiveDate !== nextEffectiveDate,
  );
  retainedVersions.push(nextVersion);
  return retainedVersions.sort((left, right) =>
    left.effectiveDate.localeCompare(right.effectiveDate),
  );
}

function getIncompleteResult(reasons) {
  return {
    status: "pending",
    reasons,
    breakdown: null,
    earnings: null,
    dailyWage: null,
    nightDifferentialPay: null,
    overtimePay: null,
  };
}

export function getEstimatedAttendanceEarnings(
  calculation,
  incentiveTotal = 0,
) {
  if (calculation?.status === "pending") return null;

  const incentives = Number(incentiveTotal);
  const validIncentives = Number.isFinite(incentives) ? incentives : 0;
  if (
    calculation?.status === "ready" &&
    Number.isFinite(calculation.earnings)
  ) {
    return calculation.earnings + validIncentives;
  }
  return validIncentives > 0 ? validIncentives : null;
}

export function calculateAttendancePayroll({
  record,
  date,
  settings,
  holiday = null,
  holidayEligibilityConfirmed = false,
}) {
  if (!record || typeof record !== "object") {
    return getIncompleteResult(["Attendance record is unavailable."]);
  }

  const type = record.type;
  if (
    ["Unassigned", "Company Break"].includes(type) ||
    (["Absent", "Rest Day"].includes(type) && !holiday)
  ) {
    return {
      status: "not-applicable",
      reasons: [],
      breakdown: null,
      earnings: 0,
      dailyWage: null,
      nightDifferentialPay: 0,
      overtimePay: 0,
    };
  }

  if (record.clockedIn) {
    return getIncompleteResult(["Clock out before calculating payroll."]);
  }

  const dailyWage = getDailyWage(settings);
  const reasons = [];
  if (dailyWage === null) reasons.push("Configure a daily wage in Settings.");

  if (type === "Leave") {
    if (reasons.length) return getIncompleteResult(reasons);
    const leaveAmount = dailyWage;
    const category = record.leaveCode === "SL" ? "paidSickLeave" : "otherPaidLeave";
    return {
      status: "ready",
      reasons: [],
      breakdown: { [category]: leaveAmount },
      earnings: leaveAmount,
      dailyWage,
      nightDifferentialPay: 0,
      overtimePay: 0,
    };
  }

  const allowanceAmount = Number(settings?.dailyAllowance);
  const hasAllowanceValue =
    typeof settings?.dailyAllowance === "string"
      ? settings.dailyAllowance.trim() !== ""
      : settings?.dailyAllowance !== undefined &&
        settings?.dailyAllowance !== null;
  const hasDailyAllowance =
    hasAllowanceValue &&
    Number.isFinite(allowanceAmount) &&
    allowanceAmount >= 0;
  if (!hasDailyAllowance) reasons.push("Configure a valid daily allowance.");

  const hasAssignedShift =
    record.type === "Rest Day" ||
    record.hasAssignedShift === true ||
    Boolean(record.shiftStartTime && record.shiftEndTime);
  const isEligibleWork = hasAssignedShift &&
    (["Regular", "Official Business"].includes(type) || Boolean(holiday));
  if (!isEligibleWork) {
    return {
      status: "not-applicable",
      reasons: [],
      breakdown: null,
      earnings: 0,
      dailyWage,
      nightDifferentialPay: 0,
      overtimePay: 0,
    };
  }
  const basePay = dailyWage === null
    ? null
    : record.isHalfDay || record.shift === "Half-day"
      ? dailyWage / 2
      : dailyWage;
  const hasNightDifferential =
    typeof settings?.nightDifferential === "string"
      ? settings.nightDifferential.trim() !== ""
      : settings?.nightDifferential !== undefined &&
        settings?.nightDifferential !== null;
  const rate = Number(settings?.nightDifferential);
  const nightHours = getNightShiftMinutes(
    record.workStartTime,
    record.workEndTime,
  ) / 60;
  const validNightDifferential =
    hasNightDifferential && Number.isFinite(rate) && rate >= 0;
  const nightDifferentialPay = nightHours === 0
    ? 0
    : basePay !== null && validNightDifferential
      ? (basePay / 8) * nightHours * (rate / 100)
      : null;
  if (nightHours > 0 && nightDifferentialPay === null) {
    reasons.push("Configure a valid night differential rate.");
  }

  const overtimeMinutes = Math.max(0, Number(record.overtimeMinutes) || 0);
  const overtimeMultiplier = Number(settings?.overtimeMultiplier);
  let overtimePay = getAmount(record.overtimeAmount);
  const scheduledMinutes = getScheduledMinutes(record);
  if (overtimeMinutes > 0 && scheduledMinutes) {
    if (!Number.isFinite(overtimeMultiplier) || overtimeMultiplier <= 0) {
      reasons.push("Configure a valid overtime multiplier.");
    } else if (basePay !== null) {
      overtimePay =
        (basePay / (scheduledMinutes / 60)) *
        (overtimeMinutes / 60) *
        overtimeMultiplier;
    }
  }
  if (reasons.length) return getIncompleteResult(reasons);

  const timingValues = {
    lateMinutes: Number.isFinite(Number(record.lateMinutes))
      ? Number(record.lateMinutes)
      : 0,
    undertimeMinutes: Number.isFinite(Number(record.undertimeMinutes))
      ? Number(record.undertimeMinutes)
      : 0,
  };
  if (holiday) {
    const holidayPay = calculateHolidayPay({
      holiday: {
        ...holiday,
        classification: getHolidayClassification(holiday),
      },
      dailyWage,
      hoursWorked: getAttendanceHours(record) || 0,
      hasSchedule: hasAssignedShift,
      isRestDay: record.type === "Rest Day",
      eligibilityKnown: holidayEligibilityConfirmed,
      worked: !record.clockedIn && Boolean(record.workStartTime && record.workEndTime),
      unworked: record.holidayUnworked || record.type === "Absent",
      overtimeMultiplier,
    });
    if (holidayPay.amount == null) {
      return getIncompleteResult([holidayPay.message]);
    }
    const holidayEarningsKey =
      getHolidayClassification(holiday) === "Regular Holiday"
        ? "regularHoliday"
        : getHolidayClassification(holiday) === "Special Non-Working Day"
          ? "specialHoliday"
          : "basicPay";
    const holidayOvertimePay =
      (Number(holidayPay.overtimePay) || 0) + overtimePay;
    const breakdown = {
      ...timingValues,
      [holidayEarningsKey]: Number.isFinite(holidayPay.regularPay)
        ? holidayPay.regularPay
        : Math.max(0, holidayPay.amount - (holidayPay.overtimePay || 0)),
      allowance: allowanceAmount,
      shiftDifferentials: nightDifferentialPay,
      overtime: holidayOvertimePay,
      overtimeMinutes: Math.max(
        overtimeMinutes,
        (Number(holidayPay.overtimeHours) || 0) * 60,
      ),
      overtimeHours: Number(holidayPay.overtimeHours) || 0,
    };
    return {
      status: "ready",
      reasons: [],
      breakdown,
      earnings: [
        "basicPay",
        "allowance",
        "shiftDifferentials",
        "regularHoliday",
        "specialHoliday",
        "overtime",
      ].reduce(
        (total, key) => total + (Number(breakdown[key]) || 0),
        0,
      ),
      dailyWage: basePay,
      nightDifferentialPay,
      overtimePay: holidayOvertimePay,
    };
  }

  const breakdown = {
    ...timingValues,
    basicPay: Math.max(0, (basePay || 0) + getAmount(record.penalty)),
    allowance: allowanceAmount,
    shiftDifferentials: nightDifferentialPay,
    overtime: overtimePay,
    overtimeMinutes,
  };
  return {
    status: "ready",
    reasons: [],
    breakdown,
    earnings:
      breakdown.basicPay +
      breakdown.allowance +
      breakdown.shiftDifferentials +
      breakdown.overtime,
    dailyWage: basePay,
    nightDifferentialPay,
    overtimePay,
  };
}