export const holidayPayRules = {
  regularHolidayWorkMultiplier: 2,
  regularHolidayRestDayMultiplier: 2.6,
  specialNonWorkingWorkMultiplier: 1.3,
  specialNonWorkingRestDayMultiplier: 1.5,
  ordinaryWorkMultiplier: 1,
  overtimeMultiplier: 1.3,
  standardHours: 8,
};

function parseTimeMinutes(time) {
  if (typeof time !== "string") return null;
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour < 1)) return null;
  if (meridiem) hour = (hour % 12) + (meridiem === "PM" ? 12 : 0);
  return hour * 60 + minute;
}

export function getAttendanceHours(record) {
  const start = parseTimeMinutes(record.workStartTime || record.in);
  const endOfDay = parseTimeMinutes(record.workEndTime || record.out);
  if (start === null || endOfDay === null || start === endOfDay) return null;
  const end = endOfDay <= start ? endOfDay + 1440 : endOfDay;
  const hours = (end - start) / 60;
  return hours > 0 && hours <= 24 ? hours : null;
}

export function calculateHolidayPay({
  holiday,
  dailyWage,
  hoursWorked,
  hasSchedule = false,
  isRestDay = false,
  eligibilityKnown = false,
  worked = false,
  unworked = false,
  overtimeMultiplier = holidayPayRules.overtimeMultiplier,
}) {
  if (!holiday) return { amount: null, message: "No configured holiday applies to this date." };
  if (holiday.classification === "Local Holiday" || holiday.classification === "Company Break") {
    return {
      amount: null,
      message: "Pay treatment for this local or company-specific holiday must be configured before an estimate can be calculated.",
    };
  }

  if (unworked && !worked && holiday.classification === "Regular Holiday") {
    if (!hasSchedule) {
      return { amount: null, message: "A scheduled workday or rest-day assignment is required to assess this regular-holiday estimate." };
    }
    if (!Number.isFinite(dailyWage) || dailyWage <= 0) {
      return { amount: null, message: "A configured daily wage is required to estimate unworked regular-holiday pay." };
    }
    if (!eligibilityKnown) {
      return { amount: null, message: "Eligibility for unworked regular-holiday pay must be confirmed before an estimate can be calculated." };
    }
    return {
      amount: dailyWage,
      regularPay: dailyWage,
      overtimePay: 0,
      multiplier: 1,
      regularPayRateLabel: "100% total including base wage",
      dailyWage,
      hoursWorked: 0,
      breakdown: "Unworked regular holiday (eligibility confirmed)",
      estimate: true,
    };
  }

  if (!worked) {
    return {
      amount: null,
      message: holiday.classification === "Special Non-Working Day"
        ? "No-work, no-pay is the general rule for a special non-working day; any company policy or agreement is not configured."
        : "No work was recorded; no holiday-work estimate applies.",
    };
  }

  const missing = [];
  if (!Number.isFinite(dailyWage) || dailyWage <= 0) missing.push("daily wage");
  if (!hasSchedule) missing.push("scheduled shift information");
  if (!Number.isFinite(hoursWorked) || hoursWorked <= 0) missing.push("valid clock-in and clock-out times");
  if (!eligibilityKnown) missing.push("employee eligibility");
  if (missing.length) {
    return { amount: null, message: `Cannot estimate holiday pay without ${missing.join(", ")}.` };
  }

  const classification = holiday.classification;
  let multiplier;
  if (classification === "Regular Holiday") {
    multiplier = isRestDay
      ? holidayPayRules.regularHolidayRestDayMultiplier
      : holidayPayRules.regularHolidayWorkMultiplier;
  } else if (classification === "Special Non-Working Day") {
    multiplier = isRestDay
      ? holidayPayRules.specialNonWorkingRestDayMultiplier
      : holidayPayRules.specialNonWorkingWorkMultiplier;
  } else {
    multiplier = holidayPayRules.ordinaryWorkMultiplier;
  }

  const hourlyBase = dailyWage / holidayPayRules.standardHours;
  const regularHours = Math.min(hoursWorked, holidayPayRules.standardHours);
  const overtimeHours = Math.max(0, hoursWorked - holidayPayRules.standardHours);
  if (overtimeHours > 0 && (!Number.isFinite(overtimeMultiplier) || overtimeMultiplier <= 0)) {
    return { amount: null, message: "A valid overtime multiplier is required to estimate overtime pay." };
  }
  const regularPay = hourlyBase * regularHours * multiplier;
  const overtimePay = hourlyBase * overtimeHours * multiplier * overtimeMultiplier;
  return {
    amount: regularPay + overtimePay,
    regularPay,
    overtimePay,
    multiplier,
    regularPayRateLabel: `${Math.round(multiplier * 100)}% total including base wage`,
    dailyWage,
    hoursWorked,
    regularHours,
    overtimeHours,
    overtimeMultiplier: overtimeHours > 0 ? overtimeMultiplier : null,
    breakdown: `${regularHours} regular hour(s)${overtimeHours ? ` + ${overtimeHours} overtime hour(s)` : ""}`,
    estimate: true,
  };
}
