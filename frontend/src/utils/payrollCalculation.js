import {
  calculateHolidayPay,
  getAttendanceHours,
  hasAttendanceTimeData,
  holidayPayRules,
  specialNonWorkingNoPayNotice,
} from "./holidayPay.js";
import { getHolidayClassification } from "./holidayUtils.js";
import {
  getPayrollDeductionSettingsDefaults,
  payrollDeductionSettingKeys,
} from "./payrollDeductions.js";
import { getExpectedPaidMinutes } from "./shiftAssignment.js";

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
  const start = parseTimeMinutes(
    record?.assignedShiftSnapshot?.startTime || record?.shiftStartTime,
  );
  const endOfDay = parseTimeMinutes(
    record?.assignedShiftSnapshot?.endTime || record?.shiftEndTime,
  );
  if (start === null || endOfDay === null || start === endOfDay) return null;
  const end = endOfDay <= start ? endOfDay + DAY_MINUTES : endOfDay;
  return end > start && end - start <= DAY_MINUTES ? end - start : null;
}

export function getAttendanceHoursBreakdown(record) {
  const shift = record?.assignedShiftSnapshot;
  const scheduledStartTime = shift?.startTime || record?.shiftStartTime;
  const scheduledEndTime = shift?.endTime || record?.shiftEndTime;
  const scheduledStart = parseTimeMinutes(scheduledStartTime);
  const scheduledEndOfDay = parseTimeMinutes(scheduledEndTime);
  const scheduledMinutes = getScheduledMinutes(record);
  const breakDurationMinutes =
    shift?.breakDurationMinutes === null ||
    shift?.breakDurationMinutes === undefined ||
    shift?.breakDurationMinutes === ""
      ? null
      : Number(shift.breakDurationMinutes);
  const hasBreakConfiguration =
    getExpectedPaidMinutes(shift) !== null &&
    scheduledMinutes !== null;
  const expectedPaidMinutes = hasBreakConfiguration
    ? getExpectedPaidMinutes(shift)
    : null;
  const validBreakDuration =
    Number.isFinite(breakDurationMinutes) && breakDurationMinutes >= 0
      ? breakDurationMinutes
      : null;
  const actualStartOfDay = parseTimeMinutes(
    record?.workStartTime || record?.in,
  );
  const actualEndOfDay = parseTimeMinutes(record?.workEndTime || record?.out);
  let actualElapsedMinutes = null;
  let actualPaidMinutes = null;
  let earlyArrivalMinutes = 0;

  if (
    !record?.clockedIn &&
    scheduledStart !== null &&
    scheduledEndOfDay !== null &&
    actualStartOfDay !== null &&
    actualEndOfDay !== null &&
    actualStartOfDay !== actualEndOfDay
  ) {
    const overnightShift = scheduledEndOfDay <= scheduledStart;
    const actualStart =
      overnightShift && actualStartOfDay < scheduledEndOfDay
        ? actualStartOfDay + DAY_MINUTES
        : actualStartOfDay;
    const actualEnd =
      actualEndOfDay <= actualStartOfDay ||
      (overnightShift && actualStart >= DAY_MINUTES)
        ? actualEndOfDay + DAY_MINUTES
        : actualEndOfDay;
    const elapsedMinutes = actualEnd - actualStart;
    if (elapsedMinutes > 0 && elapsedMinutes <= DAY_MINUTES) {
      actualElapsedMinutes = elapsedMinutes;
      if (hasBreakConfiguration) {
        earlyArrivalMinutes = Math.max(0, scheduledStart - actualStart);
        const applicableUnpaidBreakMinutes =
          shift.breakType === "unpaid"
            ? Math.min(validBreakDuration, elapsedMinutes)
            : 0;
        actualPaidMinutes = Math.max(
          0,
          elapsedMinutes - applicableUnpaidBreakMinutes,
        );
      }
    }
  }

  const attendanceComplete = actualElapsedMinutes !== null;
  const regularMinutes =
    attendanceComplete && expectedPaidMinutes !== null
      ? Math.min(actualPaidMinutes, expectedPaidMinutes)
      : null;
  const potentialOvertimeMinutes =
    attendanceComplete && expectedPaidMinutes !== null
      ? Math.max(
          0,
          actualPaidMinutes - expectedPaidMinutes - earlyArrivalMinutes,
        )
      : null;
  const approvedOvertimeMinutes = Math.max(
    0,
    Number(record?.overtimeMinutes) || 0,
  );

  return {
    assignedShiftName:
      shift?.name ||
      record?.assignedShiftName ||
      (record?.shift === "Manual Entry Adjustment"
        ? "Assigned Shift"
        : record?.shift || "No Shift Assigned"),
    scheduledMinutes,
    breakDurationMinutes: validBreakDuration,
    breakType: ["paid", "unpaid"].includes(shift?.breakType)
      ? shift.breakType
      : null,
    expectedPaidMinutes,
    actualElapsedMinutes,
    actualPaidMinutes,
    earlyArrivalMinutes,
    regularMinutes,
    potentialOvertimeMinutes,
    approvedOvertimeMinutes,
  };
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

function getIncompleteResult(reasons, hours = null) {
  return {
    status: "pending",
    reasons,
    hours,
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

  const hours = getAttendanceHoursBreakdown(record);
  const type = record.type;
  if (
    ["Unassigned", "Company Break"].includes(type) ||
    (["Absent", "Rest Day"].includes(type) && !holiday)
  ) {
    return {
      status: "not-applicable",
      reasons: [],
      hours,
      breakdown: null,
      earnings: 0,
      dailyWage: null,
      nightDifferentialPay: 0,
      overtimePay: 0,
    };
  }

  if (record.clockedIn) {
    return getIncompleteResult(["Clock out before calculating payroll."], hours);
  }

  const dailyWage = getDailyWage(settings);
  const reasons = [];
  if (dailyWage === null) reasons.push("Configure a daily wage in Settings.");

  if (type === "Leave") {
    if (reasons.length) return getIncompleteResult(reasons, hours);
    const leaveAmount = dailyWage;
    const category = record.leaveCode === "SL" ? "paidSickLeave" : "otherPaidLeave";
    return {
      status: "ready",
      reasons: [],
      hours,
      breakdown: { [category]: leaveAmount },
      earnings: leaveAmount,
      dailyWage,
      nightDifferentialPay: 0,
      overtimePay: 0,
    };
  }

  if (
    holiday &&
    getHolidayClassification(holiday) === "Special Non-Working Day" &&
    !hasAttendanceTimeData(record)
  ) {
    return {
      status: "ready",
      reasons: [],
      hours,
      breakdown: {
        lateMinutes: 0,
        undertimeMinutes: 0,
        specialHoliday: 0,
        allowance: 0,
        shiftDifferentials: 0,
        overtime: 0,
        overtimeMinutes: 0,
        overtimeHours: 0,
      },
      earnings: 0,
      dailyWage: null,
      nightDifferentialPay: 0,
      overtimePay: 0,
      notice: specialNonWorkingNoPayNotice,
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
      hours,
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
  const expectedPaidMinutes = hours.expectedPaidMinutes;
  const overtimeBasisMinutes =
    expectedPaidMinutes ?? scheduledMinutes;
  if (overtimeMinutes > 0 && overtimeBasisMinutes) {
    if (!Number.isFinite(overtimeMultiplier) || overtimeMultiplier <= 0) {
      reasons.push("Configure a valid overtime multiplier.");
    } else if (basePay !== null) {
      overtimePay =
        (basePay / (overtimeBasisMinutes / 60)) *
        (overtimeMinutes / 60) *
        overtimeMultiplier;
    }
  }
  if (reasons.length) return getIncompleteResult(reasons, hours);

  const timingValues = {
    lateMinutes: Number.isFinite(Number(record.lateMinutes))
      ? Number(record.lateMinutes)
      : 0,
    undertimeMinutes: Number.isFinite(Number(record.undertimeMinutes))
      ? Number(record.undertimeMinutes)
      : 0,
  };
  if (holiday) {
    const attendanceHours = getAttendanceHours(record);
    const paidHoursForHoliday =
      hours.actualPaidMinutes === null
        ? attendanceHours ?? 0
        : hours.actualPaidMinutes / 60;
    const holidayPay = calculateHolidayPay({
      holiday: {
        ...holiday,
        classification: getHolidayClassification(holiday),
      },
      dailyWage,
      hoursWorked: Math.min(paidHoursForHoliday, holidayPayRules.standardHours),
      hasSchedule: hasAssignedShift,
      isRestDay: record.type === "Rest Day",
      eligibilityKnown: holidayEligibilityConfirmed,
      worked: !record.clockedIn && attendanceHours !== null,
      unworked: record.holidayUnworked || record.type === "Absent",
      hasAttendanceTime: hasAttendanceTimeData(record),
      overtimeMultiplier,
    });
    if (holidayPay.amount == null) {
      return getIncompleteResult([holidayPay.message], hours);
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
      ...hours,
      [holidayEarningsKey]: Number.isFinite(holidayPay.regularPay)
        ? holidayPay.regularPay
        : Math.max(0, holidayPay.amount - (holidayPay.overtimePay || 0)),
      allowance: allowanceAmount,
      shiftDifferentials: nightDifferentialPay,
      overtime: holidayOvertimePay,
      overtimeMinutes,
      overtimeHours: overtimeMinutes / 60,
    };
    return {
      status: "ready",
      reasons: [],
      hours,
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
    ...hours,
    basicPay: Math.max(0, (basePay || 0) + getAmount(record.penalty)),
    allowance: allowanceAmount,
    shiftDifferentials: nightDifferentialPay,
    overtime: overtimePay,
    overtimeMinutes,
  };
  return {
    status: "ready",
    reasons: [],
    hours,
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