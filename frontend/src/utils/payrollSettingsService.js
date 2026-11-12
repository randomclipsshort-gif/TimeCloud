import { getHolidayForDate } from "./holidayUtils.js";
import {
  buildPayrollSettingsHistory,
  calculateAttendancePayroll,
  getPayrollSettingsForDate,
} from "./payrollCalculation.js";
import { extractPrivateFinancialAttendance } from "../lib/privateFinancialData.js";

export function recalculatePrivateAttendance({
  attendance = {},
  settings = {},
  holidays = [],
  selectedLocality = "",
  holidayEligibilityConfirmed = false,
}) {
  const history = Array.isArray(settings.payrollSettingsHistory)
    ? settings.payrollSettingsHistory
    : [];
  return Object.fromEntries(
    Object.entries(attendance).map(([date, record]) => {
      const calculation = calculateAttendancePayroll({
        record,
        date,
        settings: getPayrollSettingsForDate(history, settings, date),
        holiday: getHolidayForDate(holidays, date, selectedLocality),
        holidayEligibilityConfirmed,
      });
      const privateRecord =
        extractPrivateFinancialAttendance({ [date]: record })[date] || {};
      return [
        date,
        {
          ...privateRecord,
          payrollCalculation: {
            status: calculation.status,
            reasons: calculation.reasons,
            earnings: calculation.earnings,
            breakdown: calculation.breakdown,
          },
        },
      ];
    }),
  );
}

export function createPayrollSettingsUpdate({
  currentSettings = {},
  nextSettings = {},
  effectiveDate,
  attendance = {},
  holidays = [],
  selectedLocality = "",
  holidayEligibilityConfirmed = false,
}) {
  const payrollSettingsHistory = buildPayrollSettingsHistory({
    history: currentSettings.payrollSettingsHistory,
    currentSettings,
    nextSettings,
    effectiveDate,
    attendance,
  });
  const settings = {
    ...nextSettings,
    payrollSettingsHistory,
  };
  return {
    settings,
    attendance: recalculatePrivateAttendance({
      attendance,
      settings,
      holidays,
      selectedLocality,
      holidayEligibilityConfirmed,
    }),
  };
}
