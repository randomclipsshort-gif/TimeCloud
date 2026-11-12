import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import Header from "./components/layout/Header.jsx";
import AuthPage from "./components/AuthPage.jsx";
import DashboardContent from "./components/DashboardContent.jsx";
import ManualEntryModal from "./components/modals/ManualEntryModal.jsx";
import AssignShiftModal from "./components/modals/AssignShiftModal.jsx";
import CalendarRangeActionsModal from "./components/modals/CalendarRangeActionsModal.jsx";
import GrantLeaveModal from "./components/modals/GrantLeaveModal.jsx";
import PayslipModal from "./components/modals/PayslipModal.jsx";
import SettingsModal from "./components/modals/SettingsModal.jsx";
import ConfirmationDialog from "./components/ui/ConfirmationDialog.jsx";
import ShiftIcon from "./components/ui/ShiftIcon.jsx";
import ToastContainer from "./components/ui/ToastContainer.jsx";
import FeatureErrorBoundary from "./components/ui/FeatureErrorBoundary.jsx";
import { holidayCalendarByYear } from "./data/holidayCalendar.js";
import {
  getHolidayClassification,
  getHolidayForDate,
} from "./utils/holidayUtils.js";
import {
  calculateHolidayPay,
  getAttendanceHours,
  hasAttendanceTimeData,
} from "./utils/holidayPay.js";
import { getAttendancePunchAvailability } from "./utils/attendancePunchRules.js";
import {
  AUTH_ACTIVITY_WRITE_INTERVAL_MS,
  AUTH_IDLE_TIMEOUT_MS,
  getAuthActivityStorageKey,
  isAuthSessionExpired,
  parseAuthActivityTimestamp,
} from "./lib/authSessionTimeout.js";
import {
  calculateCutoffPayrollDeductions,
  getPayrollDeductionSettingsDefaults,
  payrollDeductionSettingKeys,
  sumCutoffPayrollDeductions,
} from "./utils/payrollDeductions.js";
import {
  calculateAttendancePayroll,
  getEstimatedAttendanceEarnings,
  getPayrollSettingsForDate,
} from "./utils/payrollCalculation.js";
import {
  createPayrollSettingsUpdate,
  recalculatePrivateAttendance,
} from "./utils/payrollSettingsService.js";
import {
  createCalendarRangeController,
  getDateRangePosition,
  getInclusiveDateKeys,
  normalizeDateRange,
} from "./utils/calendarRange.js";
import {
  clearShiftAndAttendanceRecord,
  createShiftAssignmentUpdates,
  getManualEntryRangeConflicts,
  normalizeTwelveHourShiftTime,
} from "./utils/shiftAssignment.js";
import { summarizePayrollEarningsBreakdown } from "./utils/payrollEarningsBreakdown.js";
import {
  getIncentiveTotal,
  getIncentivesForDate,
  getIncentivesForPeriod,
} from "./utils/incentiveTracker.js";
import {
  appendPayslipSnapshot,
  createPayslipSnapshot,
  findPayslipSnapshot,
  removePayslipSnapshot,
} from "./utils/payrollHistory.js";
import {
  getBudgetUtilization,
  getExpenseDate,
  getExpensesForMonth,
  getExpensesForPeriod,
} from "./utils/expenseTracker.js";
import {
  appendTravelExpense,
  getTravelPlanStatus,
  removeTravelPlan,
  removeTravelExpense,
  replaceTravelExpense,
  validateTravelExpense,
  validateTravelPlan,
} from "./utils/travelPlanner.js";
import {
  getCalendarPayrollPeriod,
  formatPayrollPeriod,
  getPayrollCutoffPeriodsForDate,
  getPayrollPeriodForDate,
  getPayrollPeriodForMonth,
  isPayrollPeriodEarningsAvailable,
  summarizePayrollPeriod,
} from "./utils/payrollPeriods.js";
import { authClient } from "./lib/authClient.js";
import {
  clearPunchForShift,
  clockInForShift,
  clockOutForShift,
  emptyWorkspace,
  loadWorkspace,
  migrateLegacyPrivateFinancialData,
  savePrivateFinancialData,
  saveWorkspace,
} from "./lib/workspace.js";
import {
  extractPrivateFinancialSettings,
  localPrivateFinancialDefaults,
  mergeLocalPrivateAttendance,
  mergeLocalPrivateAttendanceRecord,
  mergePrivateFinancialData,
  serializeWorkspaceForCloud,
} from "./lib/privateFinancialData.js";
import { unlockLegacySalaryVault } from "./lib/legacySalaryVault.js";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const monthAbbreviations = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const defaultEarlyPunchWindowMinutes = 15;
const defaultLateGracePeriodMinutes = 15;
const defaultAttendance = {
  type: "Unassigned",
  shift: "No Shift Assigned",
  wageRate: "0%",
  base: "P0.00",
  ot: "P0.00",
  penalty: "P0.00",
  est: "P0.00 PHP",
  assigned: "No shift assigned",
  in: "—",
  out: "—",
  dots: [],
  badges: [{ text: "No Shift Assigned", color: "bg-slate-100 text-slate-600" }],
};
const defaultShiftTemplates = [
  {
    id: "rest-day",
    name: "Rest Day",
    label: "Rest Day",
    range: "No working hours",
    assigned: "Rest Day",
    icon: "fa-calendar-xmark",
    iconColor: "text-slate-600",
    protected: true,
  },
];
const leaveTypes = {
  VL: {
    name: "Vacation Leave",
    icon: "fa-umbrella-beach",
    badgeColor: "bg-amber-100 text-amber-800",
  },
  SL: {
    name: "Sick Leave",
    icon: "fa-kit-medical",
    badgeColor: "bg-sky-100 text-sky-800",
  },
  EL: {
    name: "Emergency Leave",
    icon: "fa-kit-medical",
    badgeColor: "bg-rose-100 text-rose-800",
  },
};
const formatDate = (year, monthIndex, day) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function formatCalendarRangeDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getAttendanceKey(monthIndex, day, year) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function getRecord(records, monthIndex, day, year) {
  const key = getAttendanceKey(monthIndex, day, year);
  return (key && records[key]) || defaultAttendance;
}

function isAttendanceClearable(record) {
  const hasAssignedShift =
    record.type === "Rest Day" ||
    record.hasAssignedShift === true ||
    Boolean(record.shiftStartTime && record.shiftEndTime);
  return hasAssignedShift || record.type !== "Unassigned";
}

function getAmount(value) {
  const amount = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function getManilaTimestamp(date, minuteOffset) {
  const [yearValue, monthValue, dayValue] = date.split("-").map(Number);
  const utcMilliseconds =
    Date.UTC(yearValue, monthValue - 1, dayValue) +
    minuteOffset * 60_000 -
    8 * 60 * 60_000;
  return new Date(utcMilliseconds).toISOString();
}

function getWorkspaceLoadErrorMessage(error) {
  const detail =
    typeof error?.message === "string"
      ? error.message
      : "The server returned no error message.";
  const code = typeof error?.code === "string" ? error.code : "";

  if (code === "AUTH_REQUIRED") {
    return "This cloud-data request was rejected because the server did not recognize an authenticated session. Refresh and try again; if the problem continues, sign in again.";
  }
  return `Cloud data could not be loaded${code ? ` (${code})` : ""}: ${detail}`;
}

function formatPayAmount(amount) {
  return `P${amount.toFixed(2)}`;
}

function parseTimeMinutes(time) {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour < 1))
    return null;
  if (meridiem) hour = (hour % 12) + (meridiem === "PM" ? 12 : 0);
  return hour * 60 + minute;
}

function applyNightDifferential(record, calculation) {
  if (calculation.status === "not-applicable") {
    return { ...record, payrollCalculationNotice: "" };
  }
  if (calculation.status !== "ready") {
    return {
      ...record,
      payrollCalculationStatus: calculation.status,
      payrollCalculationMessage: calculation.reasons.join(" "),
      payrollCalculationNotice: "",
    };
  }
  const componentTotal =
    (Number(calculation.nightDifferentialPay) || 0) +
    (Number(calculation.overtimePay) || 0);
  return {
    ...record,
    base:
      calculation.dailyWage == null
        ? record.base
        : formatPayAmount(calculation.dailyWage),
    ot: formatPayAmount(componentTotal),
    est: `${formatPayAmount(calculation.earnings)} PHP`,
    payrollCalculationStatus: calculation.status,
    payrollCalculationMessage: "",
    payrollCalculationNotice: calculation.notice || "",
  };
}

function applyHoliday(record, holiday) {
  if (!holiday) return record;
  const classification = getHolidayClassification(holiday);
  const hasAttendance = hasValidAttendanceRecord(record);
  const holidayDutyLabel =
    record.type === "Absent"
      ? "Unworked Holiday"
      : record.type === "Rest Day"
        ? "Rest Day"
        : record.type === "Leave"
          ? "On Leave"
          : record.type === "Unassigned"
            ? "Not Scheduled"
            : hasAttendance
              ? "Holiday Duty"
              : "No attendance recorded";
  return {
    ...record,
    holidayName: holiday.name,
    holidayClassification: classification,
    holidayDescription: holiday.description || "",
    holidayLocality: holiday.locality || "",
    holidayUnworked: record.type === "Absent",
    holidayDutyLabel:
      classification === "Company Break" ? "Company Break" : holidayDutyLabel,
  };
}

function formatCurrency(amount) {
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTime(time) {
  if (!time) return "";
  const minutes = parseTimeMinutes(time);
  if (minutes === null) return "";
  const hour = Math.floor(minutes / 60) % 24;
  return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function getAttendanceTimingFlags(
  record,
  timeIn = record.workStartTime,
  timeOut = record.workEndTime,
  lateGracePeriodMinutes = defaultLateGracePeriodMinutes,
) {
  if (["Absent", "Leave", "Rest Day"].includes(record.type)) {
    return {
      late: false,
      lateMinutes: 0,
      undertime: false,
      undertimeMinutes: 0,
    };
  }
  const scheduledStart = parseTimeMinutes(record.shiftStartTime);
  const scheduledEndOfDay = parseTimeMinutes(record.shiftEndTime);
  const actualStartOfDay = parseTimeMinutes(timeIn);
  const actualEndOfDay = parseTimeMinutes(timeOut);
  if (
    scheduledStart === null ||
    scheduledEndOfDay === null ||
    actualStartOfDay === null
  )
    return {
      late: false,
      lateMinutes: 0,
      undertime: false,
      undertimeMinutes: 0,
    };

  const isOvernightShift = scheduledEndOfDay <= scheduledStart;
  const scheduledEnd = isOvernightShift
    ? scheduledEndOfDay + 1440
    : scheduledEndOfDay;
  const actualStart =
    isOvernightShift && actualStartOfDay < scheduledEndOfDay
      ? actualStartOfDay + 1440
      : actualStartOfDay;
  const actualEnd =
    actualEndOfDay === null
      ? null
      : actualEndOfDay <= actualStartOfDay ||
          (isOvernightShift && actualStart >= 1440)
        ? actualEndOfDay + 1440
        : actualEndOfDay;
  const isLate = actualStart > scheduledStart + lateGracePeriodMinutes;
  const lateMinutes = isLate
    ? actualStart - scheduledStart - lateGracePeriodMinutes
    : 0;
  const undertimeMinutes =
    actualEnd === null || record.isHalfDay
      ? 0
      : Math.max(0, scheduledEnd - actualEnd);

  return {
    late: isLate,
    lateMinutes,
    undertime: actualEnd !== null && undertimeMinutes > 0,
    undertimeMinutes,
  };
}

function getTimingIndicators({
  late,
  lateMinutes,
  undertime,
  undertimeMinutes,
}) {
  return {
    dots: [
      ...(late
        ? [{ title: `Late ${lateMinutes} min`, color: "bg-orange-500" }]
        : []),
      ...(undertime
        ? [{ title: `Undertime ${undertimeMinutes} min`, color: "bg-rose-500" }]
        : []),
    ],
    badges: [
      ...(late
        ? [
            {
              text: `Late (${formatDuration(lateMinutes)})`,
              color: "bg-orange-100 text-orange-800",
            },
          ]
        : []),
      ...(undertime
        ? [
            {
              text: `Undertime (${formatDuration(undertimeMinutes)})`,
              color: "bg-rose-100 text-rose-800",
            },
          ]
        : []),
    ],
  };
}

function applyAttendanceTiming(
  record,
  timeIn = record.workStartTime,
  timeOut = record.workEndTime,
  lateGracePeriodMinutes = defaultLateGracePeriodMinutes,
) {
  const timingFlags = getAttendanceTimingFlags(
    record,
    timeIn,
    timeOut,
    lateGracePeriodMinutes,
  );
  const indicators = getTimingIndicators(timingFlags);
  return {
    ...record,
    ...timingFlags,
    dots: [
      ...(record.dots || []).filter(
        (dot) => !/^(Late|Undertime)\b/.test(dot.title),
      ),
      ...indicators.dots,
    ],
    badges: [
      ...(record.badges || []).filter(
        (badge) => !/^(Late|Undertime)\b/.test(badge.text),
      ),
      ...indicators.badges,
    ],
  };
}

function applyConfiguredAttendanceTiming(record, lateGracePeriodMinutes) {
  return applyAttendanceTiming(
    record,
    record.workStartTime,
    record.workEndTime,
    lateGracePeriodMinutes,
  );
}

function getManilaDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function getManilaTime(date = new Date()) {
  return getManilaDateTime(date).time;
}

function getShiftWindow(record, date) {
  const start = parseTimeMinutes(record.shiftStartTime);
  const endOfDay = parseTimeMinutes(record.shiftEndTime);
  if (start === null || endOfDay === null) return null;
  const dayNumber = Date.parse(`${date}T00:00:00Z`) / 86400000;
  const startAt = dayNumber * 1440 + start;
  const endAt =
    dayNumber * 1440 + (endOfDay <= start ? endOfDay + 1440 : endOfDay);
  return { startAt, endAt };
}

function getCurrentManilaMinutes(manilaNow) {
  const minutes = parseTimeMinutes(manilaNow.time);
  if (minutes === null) return null;
  return (
    (Date.parse(`${manilaNow.date}T00:00:00Z`) / 86400000) * 1440 + minutes
  );
}

function hasValidAttendanceRecord(record) {
  if (record.clockedIn) return true;
  const timeIn = parseTimeMinutes(record.in);
  const timeOut = parseTimeMinutes(record.out);
  if (timeIn === null || timeOut === null || timeIn === timeOut) return false;
  const duration = (timeOut <= timeIn ? timeOut + 1440 : timeOut) - timeIn;
  return duration > 0 && duration <= 1440;
}

function getAutomaticAttendanceStatus(record, date, manilaNow) {
  if (
    record.type !== "Regular" ||
    (record.hasAssignedShift !== true &&
      !(record.shiftStartTime && record.shiftEndTime)) ||
    hasValidAttendanceRecord(record)
  )
    return record;

  const shiftWindow = getShiftWindow(record, date);
  const nowAt = getCurrentManilaMinutes(manilaNow);
  if (!shiftWindow || nowAt === null) return record;
  if (nowAt < shiftWindow.endAt) return record;

  return {
    ...record,
    type: "Absent",
    shift: "Absent",
    wageRate: "0%",
    base: "P0.00",
    ot: "P0.00",
    penalty: "P0.00",
    est: "P0.00 PHP",
    dots: [{ title: "Absent", color: "bg-red-500" }],
    badges: [{ text: "Absent", color: "bg-red-100 text-red-800" }],
  };
}

function actionArgument(action) {
  return action.match(/\(\s*(['"])(.*?)\1/)?.[2] || "";
}

function getMatchingShiftTemplate(record, shiftTemplates) {
  const assignedTemplate = record.assignedShiftTemplateId
    ? shiftTemplates.find(
        (template) => template.id === record.assignedShiftTemplateId,
      )
    : null;
  if (assignedTemplate) return assignedTemplate;
  if (!record.shiftStartTime || !record.shiftEndTime) return null;
  return shiftTemplates.find(
    (template) =>
      template.startTime === record.shiftStartTime &&
      template.endTime === record.shiftEndTime,
  );
}

function getAssignedShiftName(record, shiftTemplates) {
  const matchingTemplate = getMatchingShiftTemplate(record, shiftTemplates);
  if (matchingTemplate?.label) return matchingTemplate.label;
  if (
    record.assignedShiftName &&
    record.assignedShiftName !== "Manual Entry Adjustment"
  ) {
    return record.assignedShiftName;
  }
  return record.shift === "Manual Entry Adjustment"
    ? "Assigned Shift"
    : record.shift;
}

function CalendarDay({
  day,
  year,
  monthIndex,
  dateKey,
  record,
  shiftTemplates,
  selected,
  hasIncentive,
  rangePosition,
  rangeMode,
  onSelect,
  onRangePointerStart,
  onRangePointerMove,
  onRangePointerEnd,
  onRangePointerCancel,
  onNavigate,
}) {
  let cardStyle =
    "bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50";
  if (record.type === "Absent") {
    cardStyle =
      "bg-rose-50/50 border border-rose-300 hover:border-rose-400";
  } else if (record.type === "Rest Day") {
    cardStyle = "bg-slate-50 border border-slate-200 hover:border-slate-300";
  } else if (record.type === "Leave") {
    const leaveCardStyles = {
      VL: "bg-amber-50/50 border border-amber-300 hover:border-amber-400",
      SL: "bg-sky-50/50 border border-sky-300 hover:border-sky-400",
      EL: "bg-rose-50/50 border border-rose-300 hover:border-rose-400",
    };
    cardStyle =
      leaveCardStyles[record.leaveCode] || "bg-sky-50/50 border border-sky-300";
  } else if (["Regular Holiday", "Unworked Holiday"].includes(record.type)) {
    cardStyle =
      "bg-rose-50/30 border border-rose-200 hover:border-rose-300";
  } else if (record.type === "Company Break") {
    cardStyle =
      "bg-emerald-50/50 border border-emerald-200 hover:border-emerald-300";
  } else if (["Special Holiday", "Special Non-Working"].includes(record.type)) {
    cardStyle =
      "bg-indigo-50/30 border border-indigo-200 hover:border-indigo-300";
  }
  const holidayCellStyles = {
    "Regular Holiday":
      "bg-rose-50/30 border border-rose-200 hover:border-rose-300",
    "Special Non-Working Day":
      "bg-indigo-50/30 border border-indigo-200 hover:border-indigo-300",
    "Special Working Day":
      "bg-teal-50/30 border border-teal-200 hover:border-teal-300",
    "Local Holiday":
      "bg-violet-50/30 border border-violet-200 hover:border-violet-300",
    "Ordinary Working Day":
      "bg-white border border-slate-200 hover:border-slate-300",
    "Company Break":
      "bg-emerald-50/50 border border-emerald-200 hover:border-emerald-300",
  };
  if (record.type !== "Absent" && record.holidayClassification) {
    cardStyle = holidayCellStyles[record.holidayClassification] || cardStyle;
  }
  const selectionRingColor =
    record.type === "Absent"
      ? "ring-rose-400"
      : record.type === "Leave"
        ? record.leaveCode === "VL"
          ? "ring-amber-400"
          : record.leaveCode === "EL"
            ? "ring-rose-400"
            : "ring-sky-400"
        : record.type === "Rest Day"
          ? "ring-slate-400"
          : record.holidayClassification === "Regular Holiday"
            ? "ring-rose-400"
            : record.holidayClassification === "Special Non-Working Day"
              ? "ring-indigo-400"
              : record.holidayClassification === "Special Working Day"
                ? "ring-teal-400"
                : record.holidayClassification === "Local Holiday"
                  ? "ring-violet-400"
                  : "ring-teal-500";
  const selectedStyle = selected
    ? `shadow-md ring-2 ${selectionRingColor} ring-offset-1`
    : "";

  const holidayLabelColors = {
    "Regular Holiday": "text-rose-700",
    "Special Non-Working Day": "text-indigo-700",
    "Special Working Day": "text-teal-700",
    "Local Holiday": "text-violet-700",
    "Ordinary Working Day": "text-slate-700",
    "Company Break": "text-emerald-700",
  };
  const matchingShift = getMatchingShiftTemplate(record, shiftTemplates);
  const calendarShiftName =
    matchingShift?.label ||
    (record.punchSource === "manual"
      ? getAssignedShiftName(record, shiftTemplates)
      : record.shift);
  const calendarHasShift =
    record.hasAssignedShift === true ||
    Boolean(record.shiftStartTime && record.shiftEndTime);
  const calendarStatus = (() => {
    if (record.type === "Absent") return "Absent";
    if (record.type === "Leave") return record.shift;
    if (record.type === "Rest Day") return "Rest Day";
    if (calendarHasShift) return calendarShiftName;
    return null;
  })();
  const calendarStatusIcon =
    record.type === "Absent"
      ? "fa-user-xmark"
      : record.type === "Leave"
        ? record.leaveIcon || "fa-umbrella-beach"
        : record.type === "Rest Day"
          ? matchingShift?.icon || "fa-calendar-xmark"
          : matchingShift?.icon || record.customIcon;
  const calendarStatusColor =
    record.type === "Absent"
      ? "text-rose-600"
      : record.type === "Leave"
        ? record.leaveCode === "VL"
          ? "text-amber-700"
          : record.leaveCode === "EL"
            ? "text-rose-600"
            : "text-sky-700"
        : record.type === "Rest Day"
          ? "text-slate-600"
          : "text-slate-800";
  const calendarStatusIconColor =
    record.type === "Absent"
      ? "text-rose-600"
      : record.type === "Leave"
        ? calendarStatusColor
        : record.type === "Rest Day"
          ? "text-slate-600"
          : matchingShift?.iconColor ||
            record.customIconColor ||
            "text-slate-600";
  const isMorningShift = calendarStatus?.toLowerCase() === "morning";
  const isNightShift = calendarStatus?.toLowerCase() === "night";
  const isAfternoonShift = calendarStatus?.toLowerCase().includes("afternoon");
  const calendarCellDetail =
    record.type === "Absent"
      ? record.holidayName
        ? "Unworked Holiday"
        : "Unexcused / No Pay"
      : record.type === "Leave"
        ? `Paid Leave (${record.wageRate || "100%"})`
        : record.type === "Rest Day"
          ? "Rest Day"
          : calendarHasShift
            ? [
                formatTime(record.shiftStartTime),
                formatTime(record.shiftEndTime),
              ]
                .filter(Boolean)
                .join(" - ") || record.assigned
            : record.holidayName
              ? record.holidayDutyLabel || "Not Scheduled"
              : "No shift assigned";
  const rangeStyle = {
    single: "rounded-xl bg-indigo-100/90 ring-2 ring-inset ring-indigo-400",
    start: "rounded-xl bg-indigo-100/90 ring-2 ring-inset ring-indigo-400",
    middle: "rounded-xl bg-indigo-100/90 ring-1 ring-inset ring-indigo-400",
    end: "rounded-xl bg-indigo-100/90 ring-2 ring-inset ring-indigo-400",
  }[rangePosition];
  return (
    <button
      type="button"
      data-calendar-date={dateKey}
      aria-label={`${dateKey}: ${record.holidayName ? `${record.holidayName}, ${record.holidayClassification}, ` : ""}${calendarStatus || calendarShiftName}, ${calendarCellDetail}${hasIncentive ? ", incentive recorded" : ""}${rangePosition ? `, ${rangePosition} of selected date range` : ""}`}
      aria-pressed={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onPointerDown={(event) => {
        if (event.button !== 0 && event.pointerType !== "touch") return;
        if (onRangePointerStart(dateKey, event)) {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }
      }}
      onPointerMove={(event) => onRangePointerMove(dateKey, event)}
      onPointerUp={onRangePointerEnd}
      onPointerCancel={onRangePointerCancel}
      onLostPointerCapture={onRangePointerCancel}
      onDragStart={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        const offsets = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -7,
          ArrowDown: 7,
        };
        if (offsets[event.key]) {
          event.preventDefault();
          onNavigate(dateKey, offsets[event.key]);
        }
      }}
      title={hasIncentive ? "Incentive recorded" : undefined}
      style={{ touchAction: rangeMode ? "none" : "pan-y" }}
      className={`select-none rounded-xl min-h-[100px] flex flex-col transition cursor-pointer relative box-border text-left ${cardStyle} ${selectedStyle}`}
    >
      {rangeStyle && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-0 ${rangeStyle}`}
        />
      )}
      <span className="relative z-10 flex h-full w-full flex-col p-2.5 font-mono">
        <span className="flex justify-between items-center">
          <span
            className={`text-[13px] font-bold ${
              rangePosition
                ? "text-indigo-950"
                : record.type === "Absent"
                  ? "text-rose-600"
                  : record.type === "Leave"
                    ? record.leaveCode === "VL"
                      ? "text-amber-700"
                      : record.leaveCode === "EL"
                        ? "text-rose-600"
                        : "text-sky-700"
                    : record.holidayName
                      ? holidayLabelColors[record.holidayClassification] ||
                        "text-slate-700"
                      : selected
                        ? "text-teal-700"
                        : "text-slate-700"
            }`}
          >
            {day}
          </span>
          <span className="flex items-center gap-1">
            {rangePosition && (
              <span
                className="h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white"
                title="Selected for shift assignment"
                aria-hidden="true"
              />
            )}
            {record.clockedIn && (
              <span className="text-[9px] font-bold text-amber-700">
                Tracking
              </span>
            )}
            {hasIncentive && (
              <i
                className="fa-solid fa-gift text-[11px] text-teal-600"
                aria-hidden="true"
              ></i>
            )}
            {record.late && (
              <span
                className="text-[8px] font-bold text-orange-700"
                title={`Late Arrival (${formatDuration(record.lateMinutes)})`}
              >
                Late
              </span>
            )}
            {record.undertime && (
              <span
                className="text-[8px] font-bold text-rose-700"
                title={`Undertime (${formatDuration(record.undertimeMinutes)})`}
              >
                UT
              </span>
            )}
            {record.dots
              ?.filter((dot) => !/^(Late|Undertime)\b/.test(dot.title))
              .map((dot, index) => (
                <span
                  key={`${dot.title}-${index}`}
                  className={`w-2.5 h-2.5 rounded-full ${dot.color} inline-block`}
                  title={dot.title}
                />
              ))}
          </span>
        </span>
        {record.holidayName && (
          <span
            className={`mt-0.5 truncate text-[10px] font-semibold leading-tight ${
              holidayLabelColors[record.holidayClassification] ||
              "text-indigo-700"
            }`}
            title={record.holidayName}
          >
            {record.holidayName}
          </span>
        )}
        <span className="mt-auto flex min-h-0 flex-col pt-1">
          {calendarStatus && (
            <span
              className="flex min-w-0 items-center gap-1 truncate text-[11px] font-semibold leading-tight"
              title={calendarStatus}
            >
              {calendarStatusIcon && (
                <ShiftIcon
                  icon={calendarStatusIcon}
                  size={11}
                  className={`shrink-0 ${
                    isMorningShift || isAfternoonShift
                      ? "text-indigo-600"
                      : isNightShift
                        ? "text-slate-600"
                        : calendarStatusIconColor
                  }`}
                />
              )}
              <span className={`truncate ${calendarStatusColor}`}>
                {calendarStatus}
              </span>
            </span>
          )}
          {calendarCellDetail && (
            <span
              className={`mt-0.5 truncate text-[10px] leading-tight ${
                record.type === "Absent"
                  ? "text-rose-600"
                  : record.type === "Leave"
                    ? "text-amber-800"
                    : "text-slate-500"
              }`}
              title={calendarCellDetail}
            >
              {calendarCellDetail}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export default function App() {
  const [confirmation, setConfirmation] = useState(null);
  const {
    data: authSession,
    isPending: authLoading,
    error: authError,
    refetch: refetchAuthSession,
  } = authClient.useSession();
  const [workspaceLoadedForUser, setWorkspaceLoadedForUser] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [attendancePunchError, setAttendancePunchError] = useState("");
  const [workspaceDataWarning, setWorkspaceDataWarning] = useState("");
  const [workspaceSaveError, setWorkspaceSaveError] = useState("");
  const [signOutStatus, setSignOutStatus] = useState("");
  const [privateFinancialDataStatus, setPrivateFinancialDataStatus] =
    useState("loading");
  const [privateFinancialDataError, setPrivateFinancialDataError] = useState("");
  const [privateFinancialDataConflict, setPrivateFinancialDataConflict] =
    useState(false);
  const [legacySalaryVault, setLegacySalaryVault] = useState(null);
  const [privateFinancialDataSyncing, setPrivateFinancialDataSyncing] =
    useState(false);
  const [historicalPayslips, setHistoricalPayslips] = useState([]);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState(null);
  const [payslipHistorySaving, setPayslipHistorySaving] = useState(false);
  const [workspaceLoadAttempt, setWorkspaceLoadAttempt] = useState(0);
  const [saveRequest, setSaveRequest] = useState(0);
  const [recoveryMode, setRecoveryMode] = useState(() => {
    const searchToken = new URLSearchParams(window.location.search).get("token");
    const hashToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
    return Boolean(searchToken || hashToken);
  });
  const [accountDeletionLoading, setAccountDeletionLoading] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [manualEntryInitialType, setManualEntryInitialType] =
    useState("Present");
  const [activeSettingsTab, setActiveSettingsTab] = useState("general");
  const [page, setPage] = useState(0);
  const [initialCalendarDate] = useState(() => getManilaDateTime().date);
  const [payslipPeriodMode, setPayslipPeriodMode] = useState(() =>
    Number(initialCalendarDate.slice(8, 10)) <= 10 ||
    Number(initialCalendarDate.slice(8, 10)) >= 26
      ? "first"
      : "second",
  );
  const [monthIndex, setMonthIndex] = useState(
    () => Number(initialCalendarDate.slice(5, 7)) - 1,
  );
  const [year, setYear] = useState(() =>
    Number(initialCalendarDate.slice(0, 4)),
  );
  const [monthCarouselMotion, setMonthCarouselMotion] = useState(null);
  const [selectedDay, setSelectedDay] = useState(() =>
    Number(initialCalendarDate.slice(8, 10)),
  );
  const [selectedCalendarRange, setSelectedCalendarRange] = useState(null);
  const [calendarRangePreview, setCalendarRangePreview] = useState(null);
  const [calendarRangeAnchor, setCalendarRangeAnchor] = useState(null);
  const [calendarRangeMode, setCalendarRangeMode] = useState(false);
  const calendarRangeControllerRef = useRef(null);
  if (!calendarRangeControllerRef.current) {
    calendarRangeControllerRef.current = createCalendarRangeController();
  }
  const calendarRangePreviewRef = useRef(null);
  const calendarRangePointerRef = useRef(null);
  const [financeTrackingScope, setFinanceTrackingScope] = useState(() =>
    Number(initialCalendarDate.slice(8, 10)) >= 11 &&
    Number(initialCalendarDate.slice(8, 10)) <= 25
      ? "cutoff-25"
      : "cutoff-10",
  );
  const [attendance, setAttendance] = useState({});
  const [activeTimeEntry, setActiveTimeEntry] = useState(null);
  const [holidays, setHolidays] = useState(() =>
    holidayCalendarByYear[2026].map((holiday) => ({
      ...holiday,
      enabled: true,
    })),
  );
  const [selectedLocality, setSelectedLocality] = useState("");
  const [holidayEligibilityConfirmed, setHolidayEligibilityConfirmed] =
    useState(false);
  const [dailyWage, setDailyWage] = useState("");
  const [dailyAllowance, setDailyAllowance] = useState(
    localPrivateFinancialDefaults.dailyAllowance,
  );
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(
    localPrivateFinancialDefaults.overtimeMultiplier,
  );
  const [privateFinancialSettings, setPrivateFinancialSettings] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [travelPlans, setTravelPlans] = useState([]);
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    () => getManilaDateTime().date,
  );
  const [expenseCategory, setExpenseCategory] = useState("Utilities");
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const confirmationResolver = useRef(null);
  const monthCarouselTimer = useRef(null);
  const [clock, setClock] = useState(() =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(new Date()),
  );
  const [manilaNow, setManilaNow] = useState(() => getManilaDateTime());
  const [shiftTemplates, setShiftTemplates] = useState(defaultShiftTemplates);
  const [selectedShiftTemplate, setSelectedShiftTemplate] =
    useState("rest-day");
  const [isCustomShiftActive, setIsCustomShiftActive] = useState(false);
  const [customShiftName, setCustomShiftName] = useState("");
  const [customShiftStart, setCustomShiftStart] = useState("10:00 PM");
  const [customShiftEnd, setCustomShiftEnd] = useState("06:00 AM");
  const [selectedIcon, setSelectedIcon] = useState("fa-moon");
  const [leaveBalances, setLeaveBalances] = useState(
    emptyWorkspace.leaveBalances,
  );
  const [settingsBalances, setSettingsBalances] = useState(
    emptyWorkspace.settingsBalances,
  );
  const [nightDifferential, setNightDifferential] = useState(
    localPrivateFinancialDefaults.nightDifferential,
  );
  const earlyPunchWindowMinutes = defaultEarlyPunchWindowMinutes;
  const lateGracePeriodMinutes = defaultLateGracePeriodMinutes;
  const workspaceLoadedRef = useRef(false);
  const signOutInProgressRef = useRef(false);
  const userRef = useRef(null);
  const pendingSuccessToasts = useRef([]);
  const pendingExpenseClearRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const workspaceRevisionRef = useRef(0);
  const privateFinancialDataRevisionRef = useRef(0);
  const privateFinancialDataQueueRef = useRef(Promise.resolve());
  const privateFinancialDataSkipNextSyncRef = useRef(false);
  const privateFinancialDataSyncTimerRef = useRef(null);
  const privateFinancialDataNeedsInitialSaveRef = useRef(false);
  const legacyWorkspacePrivateDataRef = useRef({
    settings: localPrivateFinancialDefaults,
    attendance: {},
    payslips: [],
  });
  const historicalPayslipsRef = useRef([]);

  const requestConfirmation = useCallback(
    (options) =>
      new Promise((resolve) => {
        confirmationResolver.current?.(false);
        confirmationResolver.current = resolve;
        setConfirmation(options);
      }),
    [],
  );
  const resolveConfirmation = useCallback((confirmed) => {
    const resolve = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
  }, []);
  const retryWorkspaceLoad = useCallback(async () => {
    const confirmed = await requestConfirmation({
      title: "Reload cloud data?",
      message:
        "Retrying reloads workspace data and may discard changes not yet saved to the cloud. Continue?",
      confirmLabel: "Reload data",
      variant: "warning",
    });
    if (confirmed) {
      setWorkspaceLoadAttempt((attempt) => attempt + 1);
    }
  }, [requestConfirmation]);

  const employeeIncentives = Array.isArray(
    privateFinancialSettings.employeeIncentives,
  )
    ? privateFinancialSettings.employeeIncentives
    : [];
  const availableEmployeeIncentives =
    privateFinancialDataStatus === "ready" ? employeeIncentives : [];
  const selectedDate = formatDate(year, monthIndex, selectedDay);
  const monthLabel = `${months[monthIndex]} ${year}`;
  const calendarPayrollMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const financeAnchorDate =
    calendarPayrollMonth === manilaNow.date.slice(0, 7)
      ? manilaNow.date
      : selectedDate;
  useEffect(() => {
    const activePeriod = getPayrollPeriodForDate(financeAnchorDate);
    setFinanceTrackingScope(
      activePeriod?.endDate.endsWith("-25") ? "cutoff-25" : "cutoff-10",
    );
  }, [financeAnchorDate]);
  const currentPayrollPeriod = useMemo(
    () => getPayrollPeriodForDate(manilaNow.date),
    [manilaNow.date],
  );
  const payrollPeriod = currentPayrollPeriod;
  const holidaysByDate = useMemo(
    () =>
      new Map(
        holidays
          .filter(
            (holiday) =>
              holiday.enabled &&
              (!holiday.locality ||
                (selectedLocality.trim() &&
                  holiday.locality.trim().toLocaleLowerCase() ===
                    selectedLocality.trim().toLocaleLowerCase())),
          )
          .map((holiday) => [holiday.date, holiday]),
      ),
    [holidays, selectedLocality],
  );
  const selectedHoliday = getHolidayForDate(
    holidays,
    selectedDate,
    selectedLocality,
  );
  const selectedAttendanceRecord = getRecord(
    attendance,
    monthIndex,
    selectedDay,
    year,
  );
  const selectedRecord = applyHoliday(
    applyConfiguredAttendanceTiming(
      getAutomaticAttendanceStatus(
        {
          ...selectedAttendanceRecord,
          assignedShiftName: getAssignedShiftName(
            selectedAttendanceRecord,
            shiftTemplates,
          ),
        },
        selectedDate,
        manilaNow,
      ),
      lateGracePeriodMinutes,
    ),
    selectedHoliday,
  );
  const canClearSelectedShift =
    isAttendanceClearable(selectedAttendanceRecord) &&
    activeTimeEntry?.date !== selectedDate;
  const payrollSettingsHistory = Array.isArray(
    privateFinancialSettings.payrollSettingsHistory,
  )
    ? privateFinancialSettings.payrollSettingsHistory
    : [];
  const getPayrollSettingsAtDate = useCallback(
    (date) =>
      getPayrollSettingsForDate(
        payrollSettingsHistory,
        privateFinancialSettings,
        date,
      ),
    [payrollSettingsHistory, privateFinancialSettings],
  );
  const getPayrollRecordCalculation = useCallback(
    (record, date) =>
      calculateAttendancePayroll({
        record,
        date,
        settings: getPayrollSettingsAtDate(date),
        holiday: getHolidayForDate(holidays, date, selectedLocality),
        holidayEligibilityConfirmed,
      }),
    [
      getPayrollSettingsAtDate,
      holidayEligibilityConfirmed,
      holidays,
      selectedLocality,
    ],
  );
  const getPayrollRecordBreakdown = useCallback(
    (record, date) =>
      getPayrollRecordCalculation(record, date).breakdown,
    [getPayrollRecordCalculation],
  );
  const getPayrollRecordEarnings = useCallback(
    (record, date) => getPayrollRecordCalculation(record, date).earnings,
    [getPayrollRecordCalculation],
  );
  const countPendingPayrollRecords = useCallback(
    (period) => {
      if (!period) return 0;
      return Object.entries(attendance).reduce((count, [date, record]) => {
        if (date < period.startDate || date > period.endDate) return count;
        return getPayrollRecordCalculation(record, date).status === "pending"
          ? count + 1
          : count;
      }, 0);
    },
    [attendance, getPayrollRecordCalculation],
  );
  const payrollPeriodSummary = useMemo(
    () =>
      summarizePayrollPeriod(
        attendance,
        payrollPeriod,
        getPayrollRecordEarnings,
        availableEmployeeIncentives,
      ),
    [attendance, availableEmployeeIncentives, getPayrollRecordEarnings, payrollPeriod],
  );
  const payrollEarningsBreakdown = useMemo(
    () =>
      summarizePayrollEarningsBreakdown(
        attendance,
        payrollPeriod,
        getPayrollRecordBreakdown,
        availableEmployeeIncentives,
      ),
    [attendance, availableEmployeeIncentives, getPayrollRecordBreakdown, payrollPeriod],
  );
  const payrollDeductionSettings = useMemo(
    () =>
      getPayrollDeductionSettingsDefaults(
        getPayrollSettingsAtDate(payrollPeriod.endDate),
      ),
    [getPayrollSettingsAtDate, payrollPeriod.endDate],
  );
  const payrollPeriodMonthGross = useMemo(() => {
    const payrollMonth = payrollPeriod.endDate.slice(0, 7);
    return [10, 25].reduce((sum, cutoffDay) => {
      const period = getPayrollPeriodForMonth(payrollMonth, cutoffDay);
      return (
        sum +
        summarizePayrollPeriod(
          attendance,
          period,
          getPayrollRecordEarnings,
          availableEmployeeIncentives,
        )
          .recordedEarnings
      );
    }, 0);
  }, [attendance, availableEmployeeIncentives, getPayrollRecordEarnings, payrollPeriod]);
  const cutoffPayrollDeductions = useMemo(
    () =>
      calculateCutoffPayrollDeductions({
        period: payrollPeriod,
        mode: payrollDeductionSettings.payrollDeductionMode,
        monthlyGrossPay: payrollPeriodMonthGross,
        manualPerPaycheck: {
          sss: payrollDeductionSettings.manualSssPerPaycheck,
          philHealth: payrollDeductionSettings.manualPhilHealthPerPaycheck,
          pagIbig: payrollDeductionSettings.manualPagIbigPerPaycheck,
        },
        settings: payrollDeductionSettings,
      }),
    [payrollDeductionSettings, payrollPeriod, payrollPeriodMonthGross],
  );
  const payrollPeriodNetPay =
    payrollPeriodSummary.recordedEarnings - cutoffPayrollDeductions.total;
  const payslipMonth = payrollPeriod.endDate.slice(0, 7);
  const selectedPayslipPeriod = useMemo(() => {
    return getPayrollPeriodForMonth(
      payslipMonth,
      payslipPeriodMode === "first" ? 10 : 25,
    );
  }, [payslipMonth, payslipPeriodMode]);
  const selectedPayslipSettings = getPayrollSettingsAtDate(
    selectedPayslipPeriod.endDate,
  );
  const selectedPayslipDeductionSettings =
    getPayrollDeductionSettingsDefaults(selectedPayslipSettings);
  const selectedPayslipSummary = useMemo(
    () => summarizePayrollPeriod(
      attendance,
      selectedPayslipPeriod,
      getPayrollRecordEarnings,
      availableEmployeeIncentives,
    ),
    [attendance, availableEmployeeIncentives, getPayrollRecordEarnings, selectedPayslipPeriod],
  );
  const selectedPayslipPendingCount =
    countPendingPayrollRecords(selectedPayslipPeriod);
  const monthlyPayslipPeriods = useMemo(
    () => [10, 25].map((cutoffDay) =>
      getPayrollPeriodForMonth(payslipMonth, cutoffDay),
    ),
    [payslipMonth],
  );
  const monthlyPayslipRange = {
    startDate: monthlyPayslipPeriods[0].startDate,
    endDate: monthlyPayslipPeriods[monthlyPayslipPeriods.length - 1].endDate,
  };
  const monthlyPayslipGross = useMemo(
    () => monthlyPayslipPeriods.reduce(
      (total, period) =>
        total +
        summarizePayrollPeriod(
          attendance,
          period,
          getPayrollRecordEarnings,
          availableEmployeeIncentives,
        ).recordedEarnings,
      0,
    ),
    [attendance, availableEmployeeIncentives, getPayrollRecordEarnings, monthlyPayslipPeriods],
  );
  const monthlyPayslipDeductions = useMemo(
    () => sumCutoffPayrollDeductions(
      ...monthlyPayslipPeriods.map((period) =>
        calculateCutoffPayrollDeductions({
          period,
          mode: getPayrollDeductionSettingsDefaults(
            getPayrollSettingsAtDate(period.endDate),
          ).payrollDeductionMode,
          monthlyGrossPay: monthlyPayslipGross,
          manualPerPaycheck: {
            sss: getPayrollDeductionSettingsDefaults(
              getPayrollSettingsAtDate(period.endDate),
            ).manualSssPerPaycheck,
            philHealth: getPayrollDeductionSettingsDefaults(
              getPayrollSettingsAtDate(period.endDate),
            ).manualPhilHealthPerPaycheck,
            pagIbig: getPayrollDeductionSettingsDefaults(
              getPayrollSettingsAtDate(period.endDate),
            ).manualPagIbigPerPaycheck,
          },
          settings: getPayrollDeductionSettingsDefaults(
            getPayrollSettingsAtDate(period.endDate),
          ),
        }),
      ),
    ),
    [getPayrollSettingsAtDate, monthlyPayslipGross, monthlyPayslipPeriods],
  );
  const monthlyPayslipNet =
    monthlyPayslipGross - monthlyPayslipDeductions.total;
  const selectedPayslipBreakdown = useMemo(
    () => summarizePayrollEarningsBreakdown(
      attendance,
      selectedPayslipPeriod,
      getPayrollRecordBreakdown,
      availableEmployeeIncentives,
    ),
    [attendance, availableEmployeeIncentives, getPayrollRecordBreakdown, selectedPayslipPeriod],
  );
  const selectedPayslipDeductions = useMemo(() => {
    return calculateCutoffPayrollDeductions({
      period: selectedPayslipPeriod,
      mode: selectedPayslipDeductionSettings.payrollDeductionMode,
      monthlyGrossPay: payrollPeriodMonthGross,
      manualPerPaycheck: {
        sss: selectedPayslipDeductionSettings.manualSssPerPaycheck,
        philHealth: selectedPayslipDeductionSettings.manualPhilHealthPerPaycheck,
        pagIbig: selectedPayslipDeductionSettings.manualPagIbigPerPaycheck,
      },
      settings: selectedPayslipDeductionSettings,
    });
  }, [
    selectedPayslipDeductionSettings,
    payrollPeriodMonthGross,
    selectedPayslipPeriod,
  ]);
  const selectedPayslipNetPay =
    selectedPayslipSummary.recordedEarnings -
    selectedPayslipDeductions.total;
  const selectedWorkedHours = hasValidAttendanceRecord(selectedAttendanceRecord)
    ? getAttendanceHours(selectedAttendanceRecord)
    : 0;
  const selectedPayrollSettings = getPayrollSettingsAtDate(selectedDate);
  const selectedPayrollCalculation = getPayrollRecordCalculation(
    selectedRecord,
    selectedDate,
  );
  const selectedHolidayPay = selectedHoliday
    ? selectedAttendanceRecord.clockedIn
      ? {
          amount: null,
          message: "The holiday-pay estimate is available after Time Out.",
        }
      : calculateHolidayPay({
          holiday: {
            ...selectedHoliday,
            classification: getHolidayClassification(selectedHoliday),
          },
          dailyWage: Number(selectedPayrollSettings.dailyWage),
          hoursWorked: getAttendanceHours(selectedRecord),
          hasSchedule:
            selectedRecord.type === "Rest Day" ||
            (selectedRecord.hasAssignedShift === true &&
              Boolean(
                selectedRecord.shiftStartTime &&
                selectedRecord.shiftEndTime,
              )),
          isRestDay: selectedRecord.type === "Rest Day",
          eligibilityKnown: holidayEligibilityConfirmed,
          worked:
            hasValidAttendanceRecord(selectedRecord) &&
            !selectedRecord.clockedIn,
          unworked:
            selectedRecord.holidayUnworked ||
            selectedRecord.type === "Absent",
          hasAttendanceTime: hasAttendanceTimeData(selectedRecord),
          overtimeMultiplier: Number(selectedPayrollSettings.overtimeMultiplier),
        })
    : null;
  const selectedNightDifferentialPay =
    selectedPayrollCalculation.status === "ready"
      ? selectedPayrollCalculation.nightDifferentialPay
      : null;
  const selectedOvertimePay = selectedHoliday
    ? selectedPayrollCalculation.status === "ready"
      ? selectedPayrollCalculation.overtimePay
      : null
    : selectedPayrollCalculation.status === "ready"
      ? selectedPayrollCalculation.overtimePay
      : null;
  const selectedOvertimeCalculation = (() => {
    const multiplier = Number(selectedPayrollSettings.overtimeMultiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
    if (selectedAttendanceRecord.overtimeMinutes > 0) {
      const shiftStart = parseTimeMinutes(
        selectedAttendanceRecord.shiftStartTime,
      );
      const shiftEndOfDay = parseTimeMinutes(
        selectedAttendanceRecord.shiftEndTime,
      );
      if (shiftStart === null || shiftEndOfDay === null) return null;
      const shiftEnd =
        shiftEndOfDay <= shiftStart ? shiftEndOfDay + 1440 : shiftEndOfDay;
      const scheduledHours = (shiftEnd - shiftStart) / 60;
      const hourlyRate = Number(selectedPayrollSettings.dailyWage) / scheduledHours;
      return `${formatDuration(selectedAttendanceRecord.overtimeMinutes)} × ₱${hourlyRate.toFixed(2)}/hr × ${multiplier}x`;
    }
    if (selectedHolidayPay?.overtimeHours > 0) {
      const holidayMultiplier = selectedHolidayPay.multiplier || 1;
      const hourlyRate =
        (Number(selectedPayrollSettings.dailyWage) / 8) * holidayMultiplier;
      return `${selectedHolidayPay.overtimeHours}h × ₱${hourlyRate.toFixed(2)}/hr × ${multiplier}x`;
    }
    return `Hourly rate × OT hours × ${multiplier}x`;
  })();
  const selectedDateIncentives = getIncentivesForDate(
    availableEmployeeIncentives,
    selectedDate,
  );
  const selectedDailyIncentiveTotal = getIncentiveTotal(
    selectedDateIncentives,
  );
  const selectedEstimatedEarnings = getEstimatedAttendanceEarnings(
    selectedPayrollCalculation,
    selectedDailyIncentiveTotal,
  );
  const canRecordAttendance =
    selectedAttendanceRecord.hasAssignedShift === true ||
    Boolean(
      selectedAttendanceRecord.shiftStartTime &&
      selectedAttendanceRecord.shiftEndTime,
    );
  const punchRecord = activeTimeEntry
    ? attendance[activeTimeEntry.date] || defaultAttendance
    : selectedAttendanceRecord;
  const punchShiftDate = activeTimeEntry?.date || selectedDate;
  const punchShiftWindow = getShiftWindow(punchRecord, punchShiftDate);
  const currentManilaMinutes = getCurrentManilaMinutes(manilaNow);
  const punchAvailability = getAttendancePunchAvailability({
    record: punchRecord,
    shiftWindow: punchShiftWindow,
    date: selectedDate,
    currentDate: manilaNow.date,
    currentMinutes: currentManilaMinutes,
    activeTimeEntryDate: activeTimeEntry?.date,
    earlyPunchWindowMinutes,
    hasAttendanceRecord:
      hasValidAttendanceRecord(selectedAttendanceRecord) ||
      selectedAttendanceRecord.clockedIn ||
      (selectedAttendanceRecord.in && selectedAttendanceRecord.in !== "—") ||
      (selectedAttendanceRecord.out && selectedAttendanceRecord.out !== "—"),
  });
  const canTimeIn = !attendancePunchError && punchAvailability.canTimeIn;
  const canTimeOut = !attendancePunchError && punchAvailability.canTimeOut;
  const selectedRecordWithNightDifferential = applyNightDifferential(
    selectedRecord,
    selectedPayrollCalculation,
  );
  const yearOptions = useMemo(
    () => Array.from({ length: 11 }, (_, index) => year - 5 + index),
    [year],
  );
  const user = authSession?.user
    ? {
        id: authSession.user.id,
        email: authSession.user.email || "",
        name:
          authSession.user.name ||
          authSession.user.email?.split("@")[0] ||
          "TimeCloud user",
      }
    : null;
  const currentMonthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  const calendarPayrollPeriod = getCalendarPayrollPeriod(calendarPayrollMonth);
  const grossPay = summarizePayrollPeriod(
    attendance,
    calendarPayrollPeriod,
    getPayrollRecordEarnings,
    availableEmployeeIncentives,
  ).recordedEarnings;
  const payrollDeductions = sumCutoffPayrollDeductions(
    ...[10, 25].map((cutoffDay) =>
      (() => {
        const period = getPayrollPeriodForMonth(calendarPayrollMonth, cutoffDay);
        const settings = getPayrollDeductionSettingsDefaults(
          getPayrollSettingsAtDate(period.endDate),
        );
        return calculateCutoffPayrollDeductions({
          period,
          mode: settings.payrollDeductionMode,
          monthlyGrossPay: grossPay,
          manualPerPaycheck: {
            sss: settings.manualSssPerPaycheck,
            philHealth: settings.manualPhilHealthPerPaycheck,
            pagIbig: settings.manualPagIbigPerPaycheck,
          },
          settings,
        });
      })(),
    ),
  );
  const netPay = Math.max(0, grossPay - payrollDeductions.total);
  const totalHours = Object.entries(attendance)
    .filter(([date]) => date.startsWith(currentMonthPrefix))
    .reduce(
      (sum, [, record]) =>
        sum +
        (hasValidAttendanceRecord(record) ? getAttendanceHours(record) : 0),
      0,
    );
  const monthExpenses = getExpensesForMonth(expenses, calendarPayrollMonth);
  const totalExpenses = monthExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const { remaining, percentage } = getBudgetUtilization(netPay, totalExpenses);
  const financeCutoffPeriods = useMemo(
    () => {
      if (financeTrackingScope === "month") {
        return [10, 25].map((cutoffDay) =>
          getPayrollPeriodForMonth(calendarPayrollMonth, cutoffDay),
        );
      }
      const periods = getPayrollCutoffPeriodsForDate(financeAnchorDate);
      return periods ? [periods.firstCutoff, periods.secondCutoff] : [];
    },
    [calendarPayrollMonth, financeAnchorDate, financeTrackingScope],
  );
  const financeCutoffSummaries = useMemo(
    () =>
      financeCutoffPeriods.map((period) =>
        summarizePayrollPeriod(
          attendance,
          period,
          getPayrollRecordEarnings,
          availableEmployeeIncentives,
        ),
      ),
    [attendance, availableEmployeeIncentives, financeCutoffPeriods, getPayrollRecordEarnings],
  );
  const financeCutoffMonthlyGross = financeCutoffSummaries.reduce(
    (sum, summary) => sum + summary.recordedEarnings,
    0,
  );
  const financeCutoffDeductions = useMemo(
    () =>
      financeCutoffPeriods.map((period) => {
        const settings = getPayrollDeductionSettingsDefaults(
          getPayrollSettingsAtDate(period.endDate),
        );
        return calculateCutoffPayrollDeductions({
          period,
          mode: settings.payrollDeductionMode,
          monthlyGrossPay: financeCutoffMonthlyGross,
          manualPerPaycheck: {
            sss: settings.manualSssPerPaycheck,
            philHealth: settings.manualPhilHealthPerPaycheck,
            pagIbig: settings.manualPagIbigPerPaycheck,
          },
          settings,
        });
      }),
    [financeCutoffMonthlyGross, financeCutoffPeriods, getPayrollSettingsAtDate],
  );
  const selectedFinanceCutoffIndex =
    financeTrackingScope === "cutoff-25" ? 1 : 0;
  const selectedFinancePeriod =
    financeCutoffPeriods[selectedFinanceCutoffIndex];
  const financePendingPayrollCount =
    financeTrackingScope === "month"
      ? financeCutoffPeriods.reduce(
          (count, period) => count + countPendingPayrollRecords(period),
          0,
        )
      : countPendingPayrollRecords(selectedFinancePeriod);
  const financeExpenses =
    financeTrackingScope === "month"
      ? monthExpenses
      : getExpensesForPeriod(expenses, selectedFinancePeriod);
  const financeTotalExpenses = financeExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const financeGrossPay =
    financeTrackingScope === "month"
      ? financeCutoffMonthlyGross
      : financeCutoffSummaries[selectedFinanceCutoffIndex].recordedEarnings;
  const financePayrollDeductions =
    financeTrackingScope === "month"
      ? sumCutoffPayrollDeductions(...financeCutoffDeductions)
      : financeCutoffDeductions[selectedFinanceCutoffIndex];
  const financeNetPay = Math.max(
    0,
    financeGrossPay - financePayrollDeductions.total,
  );
  const financeTotalHours =
    financeTrackingScope === "month"
      ? financeCutoffSummaries.reduce(
          (sum, summary) => sum + summary.regularHours + summary.overtimeHours,
          0,
        )
      : financeCutoffSummaries[selectedFinanceCutoffIndex].regularHours +
        financeCutoffSummaries[selectedFinanceCutoffIndex].overtimeHours;
  const financePeriodLabel =
    financeTrackingScope === "month"
      ? `Full month · ${monthLabel}`
      : formatPayrollPeriod(selectedFinancePeriod);
  const { remaining: financeRemaining, percentage: financePercentage } =
    getBudgetUtilization(financeNetPay, financeTotalExpenses);
  const workspaceData = useMemo(
    () => ({
      attendance: serializeWorkspaceForCloud({ attendance }).attendance,
      activeTimeEntry,
      holidays,
      selectedLocality,
      holidayEligibilityConfirmed,
      expenses,
      travelPlans,
      shiftTemplates,
      leaveBalances,
      settingsBalances,
    }),
    [
      attendance,
      activeTimeEntry,
      holidays,
      selectedLocality,
      holidayEligibilityConfirmed,
      expenses,
      travelPlans,
      shiftTemplates,
      leaveBalances,
      settingsBalances,
      payrollPeriod.endDate,
    ],
  );

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    timers.current.set(
      id,
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        timers.current.delete(id);
      }, 3500),
    );
  }, []);

  const showToast = useCallback(
    (message, type = "success") => {
      if (type === "success" && workspaceLoadedRef.current && userRef.current) {
        pendingSuccessToasts.current.push(message);
        setSaveRequest((request) => request + 1);
        return;
      }
      addToast(message, type);
    },
    [addToast],
  );

  const queueWorkspaceSave = useCallback(
    (userId, snapshot) => {
      const write = async () => {
        workspaceRevisionRef.current = await saveWorkspace(
          snapshot,
          workspaceRevisionRef.current,
          userId,
        );
      };
      const operation = saveQueueRef.current.then(write, () => {
        if (userRef.current === userId) {
          addToast(
            "Retrying the latest cloud save after an earlier failure.",
            "warning",
          );
        }
        return write();
      });
      saveQueueRef.current = operation;
      return operation;
    },
    [addToast],
  );

  const applyPrivateFinancialData = useCallback((payload) => {
    const settings = extractPrivateFinancialSettings(payload?.settings);
    const payslips = Array.isArray(payload?.payslips) ? payload.payslips : [];
    historicalPayslipsRef.current = payslips;
    setHistoricalPayslips(payslips);
    setActiveHistoricalPayslip(null);
    setDailyWage(settings.dailyWage);
    setDailyAllowance(settings.dailyAllowance);
    setOvertimeMultiplier(settings.overtimeMultiplier);
    setNightDifferential(settings.nightDifferential);
    setPrivateFinancialSettings(settings);
    setAttendance((current) =>
      mergeLocalPrivateAttendance(current, payload?.attendance),
    );
    privateFinancialDataSkipNextSyncRef.current = true;
  }, []);

  const createPrivateAttendancePayload = useCallback(
    (
      records = attendance,
      settings = privateFinancialSettings,
      calculationOptions = {},
    ) => {
      const currentSettings = {
        ...settings,
        dailyWage: settings.dailyWage ?? dailyWage,
        dailyAllowance: settings.dailyAllowance ?? dailyAllowance,
        overtimeMultiplier: settings.overtimeMultiplier ?? overtimeMultiplier,
        nightDifferential: settings.nightDifferential ?? nightDifferential,
      };
      const calculationHolidays = calculationOptions.holidays ?? holidays;
      const calculationLocality =
        calculationOptions.selectedLocality ?? selectedLocality;
      const calculationEligibility =
        calculationOptions.holidayEligibilityConfirmed ??
        holidayEligibilityConfirmed;
      return recalculatePrivateAttendance({
        attendance: records,
        settings: currentSettings,
        holidays: calculationHolidays,
        selectedLocality: calculationLocality,
        holidayEligibilityConfirmed: calculationEligibility,
      });
    },
    [
      attendance,
      dailyAllowance,
      dailyWage,
      holidayEligibilityConfirmed,
      holidays,
      nightDifferential,
      overtimeMultiplier,
      privateFinancialSettings,
      selectedLocality,
    ],
  );

  const createPrivateFinancialPayload = useCallback(
    (payslips = historicalPayslipsRef.current) => ({
      settings: {
        ...privateFinancialSettings,
        dailyWage,
        dailyAllowance,
        overtimeMultiplier,
        nightDifferential,
      },
      attendance: createPrivateAttendancePayload(),
      payslips,
    }),
    [
      createPrivateAttendancePayload,
      privateFinancialSettings,
    ],
  );

  const persistPrivateFinancialData = useCallback(
    (payload = createPrivateFinancialPayload()) => {
      if (!user?.id || privateFinancialDataStatus !== "ready") {
        return Promise.reject(
          new Error("Private financial data is not ready to sync."),
        );
      }
      const operation = privateFinancialDataQueueRef.current.then(async () => {
        if (userRef.current !== user.id) {
          throw new Error(
            "The signed-in account changed before private financial data could be saved.",
          );
        }
        const revision = await savePrivateFinancialData(
          payload,
          privateFinancialDataRevisionRef.current,
          user.id,
        );
        if (userRef.current !== user.id) {
          throw new Error(
            "The signed-in account changed before private financial data could be saved.",
          );
        }
        privateFinancialDataRevisionRef.current = revision;
        setPrivateFinancialDataError("");
        setPrivateFinancialDataConflict(false);
        const shouldResumeWorkspaceSaves =
          privateFinancialDataNeedsInitialSaveRef.current;
        privateFinancialDataNeedsInitialSaveRef.current = false;
        if (shouldResumeWorkspaceSaves) {
          setSaveRequest((request) => request + 1);
        }
        return revision;
      });
      privateFinancialDataQueueRef.current = operation.catch((error) => {
        if (
          userRef.current === user.id &&
          error?.code === "REVISION_CONFLICT"
        ) {
          setPrivateFinancialDataConflict(true);
        }
      });
      return operation;
    },
    [user?.id, privateFinancialDataStatus, createPrivateFinancialPayload],
  );

  const migrateLegacySalaryVault = useCallback(
    async (passphrase) => {
      if (!user?.id || !legacySalaryVault) {
        throw new Error("No legacy encrypted financial data is available to migrate.");
      }
      const legacyPayload = await unlockLegacySalaryVault(
        legacySalaryVault,
        passphrase,
      );
      const mergedPayload = mergePrivateFinancialData(
        legacyWorkspacePrivateDataRef.current,
        legacyPayload,
      );
      const payload = {
        settings: extractPrivateFinancialSettings(mergedPayload.settings),
        attendance: extractPrivateFinancialAttendance(mergedPayload.attendance),
        payslips: mergedPayload.payslips,
      };
      const revision = await migrateLegacyPrivateFinancialData(
        payload,
        legacySalaryVault.revision,
        user.id,
      );
      privateFinancialDataRevisionRef.current = revision;
      privateFinancialDataNeedsInitialSaveRef.current = false;
      applyPrivateFinancialData(payload);
      setLegacySalaryVault(null);
      setPrivateFinancialDataStatus("ready");
      setPrivateFinancialDataError("");
      setPrivateFinancialDataConflict(false);
      legacyWorkspacePrivateDataRef.current = {
        settings: localPrivateFinancialDefaults,
        attendance: {},
        payslips: [],
      };
    },
    [user?.id, legacySalaryVault, applyPrivateFinancialData],
  );

  const dismissToast = useCallback((id) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (!authError) return;
    console.error("Could not restore the sign-in session:", authError.message);
    addToast(
      "Unable to restore the sign-in session. Please check the server configuration and try again.",
      "warning",
    );
  }, [authError, addToast]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const activityKey = getAuthActivityStorageKey(user.id);
    let lastActivityAt;
    let lastPersistedActivityAt;
    let signOutStarted = false;
    let storageWarningShown = false;
    let expirationTimer = null;

    const warnStorageFailure = (error) => {
      if (storageWarningShown) return;
      storageWarningShown = true;
      console.warn(
        "Could not persist the authentication activity timestamp:",
        error,
      );
      addToast(
        "This browser cannot save the session activity timer. Sign out manually when finished.",
        "warning",
      );
    };

    const readStoredActivity = () => {
      try {
        return parseAuthActivityTimestamp(
          window.localStorage.getItem(activityKey),
        );
      } catch (error) {
        warnStorageFailure(error);
        return null;
      }
    };

    const writeStoredActivity = (timestamp) => {
      try {
        window.localStorage.setItem(activityKey, String(timestamp));
        lastPersistedActivityAt = timestamp;
      } catch (error) {
        warnStorageFailure(error);
      }
    };

    const storedActivityAt = readStoredActivity();
    const lastSignInAt = Date.parse(
      authSession?.session?.createdAt || "",
    );
    lastActivityAt =
      storedActivityAt ||
      (Number.isFinite(lastSignInAt) ? lastSignInAt : Date.now());
    lastPersistedActivityAt = storedActivityAt || 0;

    const expireSession = () => {
      if (signOutStarted) return;
      signOutStarted = true;
      if (expirationTimer !== null) window.clearInterval(expirationTimer);
      authClient
        .signOut()
        .then(({ error }) => {
          if (error) {
            console.error("Automatic inactivity sign-out failed:", error);
            addToast(
              "Automatic sign-out failed. Please sign out manually to secure this account.",
              "error",
            );
            return;
          }
          try {
            window.localStorage.removeItem(activityKey);
          } catch (error) {
            warnStorageFailure(error);
          }
          addToast("You were signed out after one hour of inactivity.", "info");
        })
        .catch((error) => {
          console.error("Automatic inactivity sign-out failed:", error);
          addToast(
            "Automatic sign-out failed. Please sign out manually to secure this account.",
            "error",
          );
        });
    };

    const checkExpiration = () => {
      const currentStoredActivity = readStoredActivity();
      if (currentStoredActivity && currentStoredActivity > lastActivityAt) {
        lastActivityAt = currentStoredActivity;
      }
      if (isAuthSessionExpired(lastActivityAt, Date.now())) {
        expireSession();
        return true;
      }
      return false;
    };

    if (!storedActivityAt) writeStoredActivity(lastActivityAt);
    if (checkExpiration()) return undefined;

    const handleActivity = () => {
      if (signOutStarted || checkExpiration()) return;
      const now = Date.now();
      lastActivityAt = now;
      if (now - lastPersistedActivityAt >= AUTH_ACTIVITY_WRITE_INTERVAL_MS) {
        writeStoredActivity(now);
      }
    };

    const handleStorage = (event) => {
      if (event.key !== activityKey) return;
      const newActivityAt = parseAuthActivityTimestamp(event.newValue);
      if (newActivityAt && newActivityAt > lastActivityAt) {
        lastActivityAt = newActivityAt;
      }
      checkExpiration();
    };

    expirationTimer = window.setInterval(
      checkExpiration,
      AUTH_ACTIVITY_WRITE_INTERVAL_MS,
    );
    const activityEvents = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
      "mousemove",
    ];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true }),
    );
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", checkExpiration);

    return () => {
      window.clearInterval(expirationTimer);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, handleActivity),
      );
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", checkExpiration);
      if (!signOutStarted) {
        try {
          window.localStorage.removeItem(activityKey);
        } catch (error) {
          warnStorageFailure(error);
        }
      }
    };
  }, [user?.id, authSession?.session?.createdAt, addToast]);

  useEffect(() => {
    if (!user?.id) {
      userRef.current = null;
      workspaceLoadedRef.current = false;
      workspaceRevisionRef.current = 0;
      historicalPayslipsRef.current = [];
      setHistoricalPayslips([]);
      setActiveHistoricalPayslip(null);
      privateFinancialDataRevisionRef.current = 0;
      privateFinancialDataSkipNextSyncRef.current = false;
      privateFinancialDataNeedsInitialSaveRef.current = false;
      legacyWorkspacePrivateDataRef.current = {
        settings: localPrivateFinancialDefaults,
        attendance: {},
        payslips: [],
      };
      setPrivateFinancialDataStatus("loading");
      setLegacySalaryVault(null);
      setPrivateFinancialDataError("");
      setPrivateFinancialDataConflict(false);
      setPrivateFinancialDataSyncing(false);
      setWorkspaceLoadedForUser(null);
      setWorkspaceLoading(false);
      setAttendancePunchError("");
      setWorkspaceDataWarning("");
      pendingSuccessToasts.current = [];
      pendingExpenseClearRef.current = false;
      setAttendance({});
      setActiveTimeEntry(null);
      setHolidays(
        holidayCalendarByYear[2026].map((holiday) => ({
          ...holiday,
          enabled: true,
        })),
      );
      setSelectedLocality("");
      setHolidayEligibilityConfirmed(false);
      setDailyWage("");
      setDailyAllowance(localPrivateFinancialDefaults.dailyAllowance);
      setOvertimeMultiplier(localPrivateFinancialDefaults.overtimeMultiplier);
      setExpenses([]);
      setTravelPlans([]);
      setShiftTemplates(defaultShiftTemplates);
      setSelectedShiftTemplate("rest-day");
      setIsCustomShiftActive(false);
      setLeaveBalances(emptyWorkspace.leaveBalances);
      setSettingsBalances(emptyWorkspace.settingsBalances);
      setNightDifferential(localPrivateFinancialDefaults.nightDifferential);
      setExpenseName("");
      setExpenseAmount("");
      setActiveModal(null);
      return undefined;
    }

    let active = true;
    userRef.current = user.id;
    workspaceLoadedRef.current = false;
    setTravelPlans([]);
    setWorkspaceLoadedForUser(null);
    setWorkspaceLoading(true);
    setWorkspaceError("");
    setAttendancePunchError("");
    setWorkspaceDataWarning("");
    setPrivateFinancialDataStatus("loading");
    setPrivateFinancialDataError("");
    setPrivateFinancialDataConflict(false);
    setPrivateFinancialDataSyncing(false);
    setLegacySalaryVault(null);

    loadWorkspace(user.id)
      .then(
        ({
          workspace,
          revision,
          privateFinancialData,
          privateFinancialDataLoadError,
          legacyWorkspacePrivateData,
          attendancePunchLoadError,
          workspaceDataWarning: loadedWorkspaceDataWarning,
        }) => {
          if (!active) return;
          privateFinancialDataRevisionRef.current =
            privateFinancialData?.revision ?? 0;
          legacyWorkspacePrivateDataRef.current =
            legacyWorkspacePrivateData?.data ?? {
              settings: localPrivateFinancialDefaults,
              attendance: {},
              payslips: [],
            };
          const hasLegacyWorkspaceData =
            legacyWorkspacePrivateData?.hasData === true;
          privateFinancialDataNeedsInitialSaveRef.current =
            hasLegacyWorkspaceData;
          setLegacySalaryVault(privateFinancialData?.legacyVault ?? null);
          if (privateFinancialDataLoadError) {
            const unavailable =
              privateFinancialDataLoadError.code === "PRIVATE_DATA_UNAVAILABLE";
            setPrivateFinancialDataStatus(
              unavailable ? "unavailable" : "error",
            );
            setPrivateFinancialDataError(
              unavailable
                ? "Private financial storage is not configured on this server."
                : `Private financial data could not be loaded. ${getWorkspaceLoadErrorMessage(privateFinancialDataLoadError)}`,
            );
          } else if (privateFinancialData?.legacyVault) {
            setPrivateFinancialDataStatus("migration-required");
            setPrivateFinancialDataError("");
          } else {
            if (hasLegacyWorkspaceData) {
              privateFinancialDataSkipNextSyncRef.current = false;
            }
            setPrivateFinancialDataStatus("ready");
            setPrivateFinancialDataError("");
          }
          setAttendancePunchError(
            attendancePunchLoadError
              ? getWorkspaceLoadErrorMessage(attendancePunchLoadError)
              : "",
          );
          setWorkspaceDataWarning(loadedWorkspaceDataWarning);
          setPrivateFinancialDataConflict(false);
          const attendance = Object.fromEntries(
            Object.entries(workspace.attendance).map(([date, record]) => [
              date,
              record.punchSource === "ordinary"
                ? applyAttendanceTiming(
                    record,
                    record.workStartTime,
                    record.workEndTime,
                    lateGracePeriodMinutes,
                  )
                : record,
            ]),
          );
          const activePunch = attendancePunchLoadError
            ? null
            : Object.entries(attendance).find(
                ([, record]) =>
                  record.punchSource === "ordinary" && record.clockedIn,
              );
          setAttendance(attendance);
          setActiveTimeEntry(
            activePunch
              ? { date: activePunch[0], time: activePunch[1].workStartTime }
              : null,
          );
          setHolidays(
            workspace.holidays ||
              holidayCalendarByYear[2026].map((holiday) => ({
                ...holiday,
                enabled: true,
              })),
          );
          setSelectedLocality(workspace.selectedLocality);
          setHolidayEligibilityConfirmed(workspace.holidayEligibilityConfirmed);
          setDailyWage("");
          setDailyAllowance(localPrivateFinancialDefaults.dailyAllowance);
          setOvertimeMultiplier(localPrivateFinancialDefaults.overtimeMultiplier);
          setExpenses(workspace.expenses);
          setTravelPlans(workspace.travelPlans);
          setShiftTemplates(workspace.shiftTemplates || defaultShiftTemplates);
          setLeaveBalances(workspace.leaveBalances);
          setSettingsBalances(workspace.settingsBalances);
          setNightDifferential(localPrivateFinancialDefaults.nightDifferential);
          if (
            !privateFinancialDataLoadError &&
            !privateFinancialData?.legacyVault
          ) {
            const legacyWorkspaceData =
              legacyWorkspacePrivateData?.data ?? {
                settings: localPrivateFinancialDefaults,
                attendance: {},
                payslips: [],
              };
            const loadedPrivateFinancialData = privateFinancialData?.data
              ? mergePrivateFinancialData(
                  legacyWorkspaceData,
                  privateFinancialData.data,
                )
              : legacyWorkspaceData;
            applyPrivateFinancialData(loadedPrivateFinancialData);
            if (legacyWorkspacePrivateData?.hasData) {
              privateFinancialDataSkipNextSyncRef.current = false;
            }
          } else {
            setPrivateFinancialSettings(
              extractPrivateFinancialSettings({}),
            );
            setHistoricalPayslips([]);
            historicalPayslipsRef.current = [];
          }
          workspaceRevisionRef.current = revision;
          setWorkspaceLoadedForUser(user.id);
          workspaceLoadedRef.current = true;
          setWorkspaceSaveError("");
          setWorkspaceLoading(false);
        },
      )
      .catch((loadError) => {
        if (!active) return;
        setWorkspaceError(getWorkspaceLoadErrorMessage(loadError));
        setWorkspaceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, workspaceLoadAttempt, applyPrivateFinancialData]);

  useEffect(() => {
    if (
      !user?.id ||
      workspaceLoadedForUser !== user.id ||
      !workspaceLoadedRef.current ||
      privateFinancialDataStatus !== "ready"
    )
      return;
    if (privateFinancialDataSkipNextSyncRef.current) {
      privateFinancialDataSkipNextSyncRef.current = false;
      return;
    }
    const payload = createPrivateFinancialPayload();
    privateFinancialDataSyncTimerRef.current = window.setTimeout(() => {
      privateFinancialDataSyncTimerRef.current = null;
      setPrivateFinancialDataSyncing(true);
      persistPrivateFinancialData(payload)
        .then(() => {
          setPrivateFinancialDataSyncing(false);
        })
        .catch((error) => {
          setPrivateFinancialDataSyncing(false);
          const conflict = error?.code === "REVISION_CONFLICT";
          const message = conflict
            ? "Private financial data changed on another device. Reload before retrying."
            : "Private financial data could not be saved. Your changes remain in memory; retry after checking your connection.";
          setPrivateFinancialDataError(message);
          addToast(message, "error");
        });
    }, 500);
    return () => {
      window.clearTimeout(privateFinancialDataSyncTimerRef.current);
      privateFinancialDataSyncTimerRef.current = null;
    };
  }, [
    user?.id,
    workspaceLoadedForUser,
    privateFinancialDataStatus,
    dailyWage,
    dailyAllowance,
    overtimeMultiplier,
    nightDifferential,
    privateFinancialSettings,
    attendance,
    createPrivateFinancialPayload,
    persistPrivateFinancialData,
    addToast,
  ]);

  useEffect(() => {
    if (
      !user?.id ||
      workspaceLoadedForUser !== user.id ||
      !workspaceLoadedRef.current ||
      privateFinancialDataNeedsInitialSaveRef.current
    )
      return undefined;

    const snapshot = workspaceData;
    const timer = window.setTimeout(() => {
      const saveOperation = queueWorkspaceSave(user.id, snapshot);
      saveOperation
        .then(() => {
          if (userRef.current !== user.id) return;
          setWorkspaceSaveError("");
          if (pendingExpenseClearRef.current) {
            pendingExpenseClearRef.current = false;
            setExpenseName("");
            setExpenseAmount("");
          }
          const savedMessages = pendingSuccessToasts.current.splice(0);
          savedMessages.forEach((message) => addToast(message, "success"));
        })
        .catch(() => {
          if (userRef.current !== user.id) return;
          pendingSuccessToasts.current = [];
          setWorkspaceSaveError(
            "Cloud save failed. Changes are not confirmed. Retry, or reload to discard unsynced changes and load the latest cloud copy.",
          );
          addToast(
            "Cloud save failed. Your changes are not confirmed as saved.",
            "error",
          );
        });
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    user?.id,
    workspaceLoadedForUser,
    privateFinancialDataStatus,
    workspaceData,
    saveRequest,
    addToast,
    queueWorkspaceSave,
  ]);

  useEffect(
    () => () => {
      timers.current.forEach(window.clearTimeout);
      window.clearTimeout(monthCarouselTimer.current);
      const pointer = calendarRangePointerRef.current;
      if (pointer?.target?.hasPointerCapture?.(pointer.pointerId)) {
        pointer.target.releasePointerCapture(pointer.pointerId);
      }
      calendarRangeControllerRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now),
      );
      setManilaNow(getManilaDateTime(now));
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeModal) return undefined;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setActiveModal(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeModal]);

  useEffect(() => {
    if (
      ![
        "calendarRangeActionsModal",
        "assignShiftModal",
        "manualEntryModal",
      ].includes(activeModal) &&
      selectedCalendarRange
    ) {
      setSelectedCalendarRange(null);
    }
  }, [activeModal, selectedCalendarRange]);

  const clearCalendarRange = () => {
    const pointer = calendarRangePointerRef.current;
    if (pointer?.target?.hasPointerCapture?.(pointer.pointerId)) {
      pointer.target.releasePointerCapture(pointer.pointerId);
    }
    calendarRangePointerRef.current = null;
    calendarRangeControllerRef.current.clear();
    calendarRangePreviewRef.current = null;
    setCalendarRangePreview(null);
    setCalendarRangeAnchor(null);
    setCalendarRangeMode(false);
    setSelectedCalendarRange(null);
  };

  useEffect(() => {
    clearCalendarRange();
  }, [monthIndex, user?.id, year]);

  useEffect(() => {
    const cancelRangeOnEscape = (event) => {
      if (
        event.key === "Escape" &&
        (calendarRangeMode ||
          calendarRangeControllerRef.current.getState().pointerActive)
      ) {
        clearCalendarRange();
      }
    };
    window.addEventListener("keydown", cancelRangeOnEscape);
    return () => window.removeEventListener("keydown", cancelRangeOnEscape);
  }, [calendarRangeMode]);

  const commitCalendarRange = (range) => {
    if (!range) return;
    calendarRangePointerRef.current = null;
    calendarRangeControllerRef.current.completeRange();
    calendarRangePreviewRef.current = null;
    setCalendarRangePreview(null);
    setCalendarRangeAnchor(null);
    setCalendarRangeMode(false);
    setSelectedCalendarRange(range);
    setSelectedDay(Number(range.startDate.slice(8, 10)));
    setCustomShiftName("");
    setSelectedShiftTemplate("rest-day");
    setIsCustomShiftActive(false);
    setActiveModal("calendarRangeActionsModal");
  };

  const openRangeAssignShift = () => {
    setCustomShiftName("");
    setSelectedShiftTemplate("rest-day");
    setIsCustomShiftActive(false);
    setActiveModal("assignShiftModal");
  };

  const openRangeManualEntry = () => {
    setManualEntryInitialType("Present");
    setActiveModal("manualEntryModal");
  };

  const clearAttendanceDates = async (dates) => {
    const clearableDates = dates.filter((date) =>
      isAttendanceClearable(attendance[date] || defaultAttendance),
    );
    const activeTimeEntryDate = dates.find(
      (date) => activeTimeEntry?.date === date,
    );
    if (activeTimeEntryDate) {
      showToast(
        `Cannot clear attendance while Time In is active on ${activeTimeEntryDate}.`,
        "warning",
      );
      return;
    }
    if (!clearableDates.length) {
      showToast(
        "No shifts, attendance, or leave records were found to clear.",
        "warning",
      );
      return;
    }

    const confirmed = await requestConfirmation({
      title: "Clear shift and attendance?",
      message:
        "This removes the selected shift and attendance records. Completed clock-in/out records are permanently deleted, and cleared leave days are returned to their balances. Saved payslip snapshots are not changed.",
      confirmLabel: "Clear records",
      variant: "danger",
    });
    if (!confirmed) return;

    const ordinaryPunchDates = clearableDates.filter(
      (date) => attendance[date]?.punchSource === "ordinary",
    );
    const punchResults = await Promise.allSettled(
      ordinaryPunchDates.map((date) => clearPunchForShift(date, user?.id)),
    );
    const failedPunchDates = new Set(
      punchResults.flatMap((result, index) =>
        result.status === "rejected" ? [ordinaryPunchDates[index]] : [],
      ),
    );
    const clearedDates = clearableDates.filter(
      (date) => !failedPunchDates.has(date),
    );
    if (clearedDates.length) {
      setAttendance((state) => ({
        ...state,
        ...Object.fromEntries(
          clearedDates.map((date) => [
            date,
            clearShiftAndAttendanceRecord(state[date] || defaultAttendance),
          ]),
        ),
      }));
      const leaveRefunds = clearedDates.reduce((refunds, date) => {
        const leaveCode =
          attendance[date]?.type === "Leave" ? attendance[date].leaveCode : null;
        if (leaveCode && Object.hasOwn(leaveBalances, leaveCode)) {
          refunds[leaveCode] = (refunds[leaveCode] || 0) + 1;
        }
        return refunds;
      }, {});
      if (Object.keys(leaveRefunds).length) {
        setLeaveBalances((balances) => {
          const updated = { ...balances };
          Object.entries(leaveRefunds).forEach(([code, count]) => {
            updated[code] = (Number(updated[code]) || 0) + count;
          });
          return updated;
        });
      }
      setActiveModal(null);
    }

    if (failedPunchDates.size) {
      showToast(
        `Cleared ${clearedDates.length} day(s). Server attendance could not be deleted for: ${[...failedPunchDates].join(", ")}. Those dates were left unchanged.`,
        "warning",
      );
      return;
    }
    const skippedCount = dates.length - clearedDates.length;
    showToast(
      `Cleared shifts and attendance on ${clearedDates.length} day(s)${skippedCount ? `; ${skippedCount} had no records to clear` : ""}.`,
      "success",
    );
  };

  const clearSelectedShiftRange = () => {
    if (!selectedCalendarRange) return;
    const dates = getInclusiveDateKeys(
      selectedCalendarRange.startDate,
      selectedCalendarRange.endDate,
    );
    void clearAttendanceDates(dates);
  };

  const handleCalendarDateClick = (date, event) => {
    const result = calendarRangeControllerRef.current.click(date, {
      shiftKey: event.shiftKey,
    });
    if (result.type === "ignored") return;
    setSelectedDay(Number(date.slice(8, 10)));
    if (result.type === "range") {
      commitCalendarRange(result.range);
      return;
    }
    setSelectedCalendarRange(null);
    setCalendarRangeAnchor(result.anchorDate);
    const preview = result.rangeMode ? normalizeDateRange(date, date) : null;
    calendarRangePreviewRef.current = preview;
    setCalendarRangePreview(preview);
  };

  const handleCalendarRangeModeToggle = () => {
    const nextMode = !calendarRangeMode;
    const state = calendarRangeControllerRef.current.setRangeMode(nextMode);
    setCalendarRangeMode(state.rangeMode);
    setCalendarRangeAnchor(state.anchorDate);
    const preview =
      nextMode && state.anchorDate
        ? normalizeDateRange(state.anchorDate, state.anchorDate)
        : null;
    calendarRangePreviewRef.current = preview;
    setCalendarRangePreview(preview);
    setSelectedCalendarRange(null);
  };

  const handleRangePointerStart = (date, event) => {
    const started = calendarRangeControllerRef.current.beginPointer({
      date,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });
    if (started) {
      calendarRangePointerRef.current = {
        target: event.currentTarget,
        pointerId: event.pointerId,
      };
    }
    return started;
  };

  const handleRangePointerMove = (_date, event) => {
    const point = document.elementFromPoint(event.clientX, event.clientY);
    const hoveredCell =
      point instanceof Element ? point.closest("[data-calendar-date]") : null;
    const range = calendarRangeControllerRef.current.movePointer({
      date: hoveredCell?.getAttribute("data-calendar-date") || null,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });
    if (
      range &&
      (range.startDate !== calendarRangePreviewRef.current?.startDate ||
        range.endDate !== calendarRangePreviewRef.current?.endDate)
    ) {
      calendarRangePreviewRef.current = range;
      setCalendarRangePreview(range);
    }
  };

  const handleRangePointerEnd = (event) => {
    const range = calendarRangeControllerRef.current.endPointer(event.pointerId);
    if (calendarRangePointerRef.current?.pointerId === event.pointerId) {
      calendarRangePointerRef.current = null;
    }
    if (range) commitCalendarRange(range);
  };

  const handleRangePointerCancel = (event) => {
    const cancelled = calendarRangeControllerRef.current.cancelPointer(
      event.pointerId,
    );
    if (!cancelled) return;
    calendarRangePointerRef.current = null;
    calendarRangePreviewRef.current = null;
    setCalendarRangePreview(null);
  };

  const handleCalendarDayNavigate = (date, offset) => {
    const [currentYear, currentMonth, currentDay] = date.split("-").map(Number);
    const nextDate = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay));
    nextDate.setUTCDate(nextDate.getUTCDate() + offset);
    const nextDateKey = nextDate.toISOString().slice(0, 10);
    const [nextYear, nextMonth, nextDay] = nextDateKey.split("-").map(Number);
    if (nextYear !== year || nextMonth - 1 !== monthIndex) {
      changeMonthTo(nextYear, nextMonth - 1);
      setSelectedDay(nextDay);
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-calendar-date="${nextDateKey}"]`)
          ?.focus();
      });
      return;
    }
    setSelectedDay(nextDay);
    document
      .querySelector(`[data-calendar-date="${nextDateKey}"]`)
      ?.focus();
  };

  const changeMonthTo = (nextYear, nextMonthIndex) => {
    clearCalendarRange();
    const baseYear = monthCarouselMotion?.year ?? year;
    const baseMonthIndex = monthCarouselMotion?.monthIndex ?? monthIndex;
    const offset = (nextYear - baseYear) * 12 + nextMonthIndex - baseMonthIndex;
    window.clearTimeout(monthCarouselTimer.current);
    setMonthCarouselMotion(
      offset === 0
        ? null
        : {
            year: baseYear,
            monthIndex: baseMonthIndex,
            offset,
          },
    );
    if (offset !== 0) {
      monthCarouselTimer.current = window.setTimeout(() => {
        setMonthCarouselMotion(null);
      }, 380);
    }
    setMonthIndex(nextMonthIndex);
    setYear(nextYear);
    setSelectedDay(1);
  };

  const changeMonth = (offset) => {
    const next = new Date(year, monthIndex + offset, 1);
    changeMonthTo(next.getFullYear(), next.getMonth());
  };

  const finishMonthCarouselMotion = (event) => {
    if (event.propertyName !== "transform") return;
    window.clearTimeout(monthCarouselTimer.current);
    setMonthCarouselMotion(null);
  };

  const changeYear = (nextYear) => {
    clearCalendarRange();
    window.clearTimeout(monthCarouselTimer.current);
    setMonthCarouselMotion(null);
    setYear(nextYear);
    setSelectedDay(1);
  };

  const resetCalendar = () => {
    clearCalendarRange();
    const today = getManilaDateTime().date;
    window.clearTimeout(monthCarouselTimer.current);
    setMonthCarouselMotion(null);
    setMonthIndex(Number(today.slice(5, 7)) - 1);
    setYear(Number(today.slice(0, 4)));
    setSelectedDay(Number(today.slice(8, 10)));
    showToast("Calendar view reset", "info");
  };

  const addExpense = () => {
    const name = expenseName.trim();
    const amount = Number(expenseAmount);
    if (!name)
      return showToast(
        "Please provide a valid expense description.",
        "warning",
      );
    if (!getExpenseDate({ date: expenseDate })) {
      return showToast("Please select a valid expense date.", "warning");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return showToast(
        "Please enter a valid expense amount greater than 0.",
        "warning",
      );
    }
    setExpenses((current) => [
      {
        id:
          globalThis.crypto?.randomUUID?.() ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        category: expenseCategory,
        amount,
        date: expenseDate,
      },
      ...current,
    ]);
    const [expenseYear, expenseMonth, expenseDay] = expenseDate
      .split("-")
      .map(Number);
    setYear(expenseYear);
    setMonthIndex(expenseMonth - 1);
    setSelectedDay(
      Math.min(
        expenseDay,
        new Date(Date.UTC(expenseYear, expenseMonth, 0)).getUTCDate(),
      ),
    );
    pendingExpenseClearRef.current = true;
    showToast("Expense record added successfully.", "success");
  };

  const addEmployeeIncentive = ({
    name: incentiveName,
    amount: incentiveAmount,
    date,
  }) => {
    if (privateFinancialDataStatus !== "ready") {
      showToast("Private financial data is not ready yet.", "warning");
      return false;
    }
    const name = incentiveName.trim();
    const amount = Number(incentiveAmount);
    if (!name) {
      showToast("Please provide an incentive description.", "warning");
      return false;
    }
    if (name.length > 80) {
      showToast("Incentive descriptions must be 80 characters or fewer.", "warning");
      return false;
    }
    if (!getExpenseDate({ date })) {
      showToast("Please select a valid incentive date.", "warning");
      return false;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Please enter a valid incentive amount greater than 0.", "warning");
      return false;
    }
    const incentive = {
      id:
        globalThis.crypto?.randomUUID?.() ||
        `incentive-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      amount,
      date,
    };
    setPrivateFinancialSettings((current) => ({
      ...current,
      employeeIncentives: [
        incentive,
        ...(Array.isArray(current.employeeIncentives)
          ? current.employeeIncentives
          : []),
      ],
    }));
    const [incentiveYear, incentiveMonth, incentiveDay] = date
      .split("-")
      .map(Number);
    setYear(incentiveYear);
    setMonthIndex(incentiveMonth - 1);
    setSelectedDay(incentiveDay);
    showToast("Employee incentive added.", "success");
    return true;
  };

  const deleteEmployeeIncentive = (id) => {
    setPrivateFinancialSettings((current) => ({
      ...current,
      employeeIncentives: (Array.isArray(current.employeeIncentives)
        ? current.employeeIncentives
        : []
      ).filter((incentive) => incentive.id !== id),
    }));
    showToast("Employee incentive removed.", "success");
  };

  const deleteExpense = (id) => {
    setExpenses((current) => current.filter((item) => item.id !== id));
    showToast("Expense item removed.", "success");
  };

  const createTravelPlan = (draft) => {
    if (!userRef.current || !workspaceLoadedRef.current) {
      showToast("Wait for your travel data to load before making changes.", "warning");
      return false;
    }
    const error = validateTravelPlan(draft);
    if (error) {
      showToast(error, "warning");
      return false;
    }
    const id =
      globalThis.crypto?.randomUUID?.() ||
      `travel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setTravelPlans((current) => [
      {
        id,
        name: draft.name.trim(),
        destination: draft.destination.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        budget: Number(draft.budget),
        currency: draft.currency,
        notes: draft.notes.trim(),
        completedAt: null,
        expenses: [],
      },
      ...current,
    ]);
    showToast("Travel plan created.", "success");
    return id;
  };

  const updateTravelPlan = (id, draft) => {
    if (!userRef.current || !workspaceLoadedRef.current) {
      showToast("Wait for your travel data to load before making changes.", "warning");
      return false;
    }
    const error = validateTravelPlan(draft);
    if (error) {
      showToast(error, "warning");
      return false;
    }
    const existing = travelPlans.find((plan) => plan.id === id);
    if (!existing) {
      showToast("The travel plan could not be found.", "error");
      return false;
    }
    if (getTravelPlanStatus(existing, manilaNow.date) === "Completed") {
      showToast("Completed trips are read-only to preserve their final history.", "warning");
      return false;
    }
    if (existing.expenses.length > 0 && existing.currency !== draft.currency) {
      showToast("Currency cannot be changed after trip expenses have been recorded.", "warning");
      return false;
    }
    setTravelPlans((current) => current.map((plan) =>
      plan.id === id
        ? {
            ...plan,
            name: draft.name.trim(),
            destination: draft.destination.trim(),
            startDate: draft.startDate,
            endDate: draft.endDate,
            budget: Number(draft.budget),
            currency: draft.currency,
            notes: draft.notes.trim(),
          }
        : plan,
    ));
    showToast("Travel plan updated.", "success");
    return true;
  };

  const completeTravelPlan = (id) => {
    if (!userRef.current || !workspaceLoadedRef.current) {
      showToast("Wait for your travel data to load before making changes.", "warning");
      return false;
    }
    const existing = travelPlans.find((plan) => plan.id === id);
    if (!existing) {
      showToast("The travel plan could not be found.", "error");
      return false;
    }
    if (getTravelPlanStatus(existing, manilaNow.date) === "Completed") return false;
    setTravelPlans((current) => current.map((plan) =>
      plan.id === id ? { ...plan, completedAt: new Date().toISOString() } : plan,
    ));
    showToast("Trip completed and saved to travel history.", "success");
    return true;
  };

  const deleteTravelPlan = (id) => {
    if (!userRef.current || !workspaceLoadedRef.current) {
      showToast("Wait for your travel data to load before making changes.", "warning");
      return false;
    }
    if (!travelPlans.some((plan) => plan.id === id)) {
      showToast("The travel plan could not be found.", "error");
      return false;
    }
    setTravelPlans((current) => removeTravelPlan(current, id));
    showToast("Travel plan and its expenses removed.", "success");
    return true;
  };

  const addTravelExpense = (tripId, draft) => {
    if (!userRef.current || !workspaceLoadedRef.current) {
      showToast("Wait for your travel data to load before making changes.", "warning");
      return false;
    }
    const error = validateTravelExpense(draft);
    if (error) {
      showToast(error, "warning");
      return false;
    }
    const trip = travelPlans.find((plan) => plan.id === tripId);
    if (!trip) {
      showToast("The travel plan could not be found.", "error");
      return false;
    }
    if (getTravelPlanStatus(trip, manilaNow.date) === "Completed") {
      showToast("Completed trips are read-only to preserve their final history.", "warning");
      return false;
    }
    const expense = {
      id:
        globalThis.crypto?.randomUUID?.() ||
        `travel-expense-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: draft.name.trim(),
      category: draft.category.trim(),
      date: draft.date,
      amount: Number(draft.amount),
      paidBy: draft.paidBy.trim(),
      forPeople: draft.forPeople,
      splitEqually: draft.splitEqually === true,
      method: draft.method,
      notes: draft.notes.trim(),
    };
    setTravelPlans((current) => appendTravelExpense(current, tripId, expense));
    showToast("Travel expense added.", "success");
    return true;
  };

  const updateTravelExpense = (tripId, expenseId, draft) => {
    if (!userRef.current || !workspaceLoadedRef.current) {
      showToast("Wait for your travel data to load before making changes.", "warning");
      return false;
    }
    const error = validateTravelExpense(draft);
    if (error) {
      showToast(error, "warning");
      return false;
    }
    const trip = travelPlans.find((plan) => plan.id === tripId);
    if (!trip) {
      showToast("The travel plan could not be found.", "error");
      return false;
    }
    if (getTravelPlanStatus(trip, manilaNow.date) === "Completed") {
      showToast("Completed trips are read-only to preserve their final history.", "warning");
      return false;
    }
    if (!trip.expenses.some((expense) => expense.id === expenseId)) {
      showToast("The travel expense could not be found.", "error");
      return false;
    }
    const updatedExpense = {
      name: draft.name.trim(),
      category: draft.category.trim(),
      date: draft.date,
      amount: Number(draft.amount),
      paidBy: draft.paidBy.trim(),
      forPeople: draft.forPeople,
      splitEqually: draft.splitEqually === true,
      method: draft.method,
      notes: draft.notes.trim(),
    };
    setTravelPlans((current) =>
      replaceTravelExpense(current, tripId, expenseId, updatedExpense),
    );
    showToast("Travel expense updated.", "success");
    return true;
  };

  const deleteTravelExpense = (tripId, expenseId) => {
    if (!userRef.current || !workspaceLoadedRef.current) {
      showToast("Wait for your travel data to load before making changes.", "warning");
      return false;
    }
    const trip = travelPlans.find((plan) => plan.id === tripId);
    if (!trip || getTravelPlanStatus(trip, manilaNow.date) === "Completed") {
      showToast("The travel expense cannot be changed for this trip.", "warning");
      return false;
    }
    if (!trip.expenses.some((expense) => expense.id === expenseId)) {
      showToast("The travel expense could not be found.", "error");
      return false;
    }
    setTravelPlans((current) => removeTravelExpense(current, tripId, expenseId));
    showToast("Travel expense removed.", "success");
    return true;
  };

  const savePayslipToHistory = async () => {
    if (
      privateFinancialDataStatus !== "ready" ||
      !user?.id
    ) {
      showToast(
        "Private financial data is not ready to save a payslip snapshot.",
        "warning",
      );
      return false;
    }

    let nextHistory;
    try {
      const settings = getPayrollSettingsAtDate(
        selectedPayslipPeriod.endDate,
      );
      const deductionSettings = getPayrollDeductionSettingsDefaults(settings);
      const snapshot = createPayslipSnapshot({
        employeeId: user.id,
        employeeName:
          typeof user.name === "string" && user.name.trim()
            ? user.name
            : "Employee",
        period: selectedPayslipPeriod,
        summary: selectedPayslipSummary,
        earningsBreakdown: selectedPayslipBreakdown,
        deductions: selectedPayslipDeductions,
        netPay: selectedPayslipNetPay,
        settings: {
          dailyWage: settings.dailyWage,
          dailyAllowance: settings.dailyAllowance,
          overtimeMultiplier: settings.overtimeMultiplier,
          nightDifferential: settings.nightDifferential,
          payrollDeductions: deductionSettings,
        },
      });
      nextHistory = appendPayslipSnapshot(
        historicalPayslipsRef.current,
        snapshot,
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Payslip history could not be updated.",
        "warning",
      );
      return false;
    }

    window.clearTimeout(privateFinancialDataSyncTimerRef.current);
    privateFinancialDataSyncTimerRef.current = null;
    setPayslipHistorySaving(true);
    setPrivateFinancialDataSyncing(true);
    try {
      await persistPrivateFinancialData(createPrivateFinancialPayload(nextHistory));
      historicalPayslipsRef.current = nextHistory;
      setHistoricalPayslips(nextHistory);
      privateFinancialDataSkipNextSyncRef.current = true;
      addToast("Payslip estimate saved to history.", "success");
      return true;
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      const message =
        error?.code === "REVISION_CONFLICT"
          ? "Private financial data changed on another device. Reload before saving this payslip."
          : `Payslip history could not be saved. No success was recorded.${detail}`;
      setPrivateFinancialDataError(message);
      addToast(message, "error");
      return false;
    } finally {
      setPrivateFinancialDataSyncing(false);
      setPayslipHistorySaving(false);
    }
  };

  const viewHistoricalPayslip = (snapshot) => {
    setActiveHistoricalPayslip(snapshot);
    setActiveModal("payslipModal");
  };

  const deleteHistoricalPayslip = async (snapshot) => {
    if (payslipHistorySaving) return false;
    if (
      privateFinancialDataStatus !== "ready" ||
      !user?.id
    ) {
      showToast(
        "Private financial data is not ready to delete a saved payslip.",
        "warning",
      );
      return false;
    }

    let nextHistory;
    try {
      nextHistory = removePayslipSnapshot(
        historicalPayslipsRef.current,
        snapshot.id,
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "The saved payslip could not be deleted.",
        "error",
      );
      return false;
    }

    window.clearTimeout(privateFinancialDataSyncTimerRef.current);
    privateFinancialDataSyncTimerRef.current = null;
    setPayslipHistorySaving(true);
    setPrivateFinancialDataSyncing(true);
    try {
      await persistPrivateFinancialData(createPrivateFinancialPayload(nextHistory));
      historicalPayslipsRef.current = nextHistory;
      setHistoricalPayslips(nextHistory);
      if (activeHistoricalPayslip?.id === snapshot.id) {
        setActiveHistoricalPayslip(null);
      }
      privateFinancialDataSkipNextSyncRef.current = true;
      addToast("Saved payslip deleted.", "success");
      return true;
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      const message =
        error?.code === "REVISION_CONFLICT"
          ? "Private financial data changed on another device. Reload before deleting this payslip."
          : `Saved payslip could not be deleted. No deletion was recorded.${detail}`;
      setPrivateFinancialDataError(message);
      addToast(message, "error");
      return false;
    } finally {
      setPrivateFinancialDataSyncing(false);
      setPayslipHistorySaving(false);
    }
  };

  const flushWorkspace = async () => {
    if (!user?.id || !workspaceLoadedRef.current) return true;
    if (privateFinancialDataNeedsInitialSaveRef.current) {
      setWorkspaceSaveError(
        "Workspace changes will not be saved until legacy private financial data has been preserved.",
      );
      return false;
    }
    const operation = queueWorkspaceSave(user.id, workspaceData);
    try {
      await operation;
      setWorkspaceSaveError("");
      if (pendingExpenseClearRef.current) {
        pendingExpenseClearRef.current = false;
        setExpenseName("");
        setExpenseAmount("");
      }
      pendingSuccessToasts.current
        .splice(0)
        .forEach((message) => addToast(message, "success"));
      return true;
    } catch {
      setWorkspaceSaveError(
        "Cloud save failed. Changes are not confirmed. Retry, or reload to discard unsynced changes and load the latest cloud copy.",
      );
      addToast(
        "Cloud save failed. Your changes are not confirmed as saved.",
        "error",
      );
      return false;
    }
  };

  const flushPrivateFinancialData = async () => {
    if (privateFinancialDataStatus !== "ready") return true;
    window.clearTimeout(privateFinancialDataSyncTimerRef.current);
    privateFinancialDataSyncTimerRef.current = null;
    setPrivateFinancialDataSyncing(true);
    try {
      await persistPrivateFinancialData(createPrivateFinancialPayload());
      setPrivateFinancialDataSyncing(false);
      return true;
    } catch (error) {
      setPrivateFinancialDataSyncing(false);
      const message =
        error?.code === "REVISION_CONFLICT"
          ? "Private financial data changed on another device. Reload before signing out."
          : "Private financial data could not be saved. Stay signed in and retry before signing out.";
      setPrivateFinancialDataError(message);
      addToast(message, "error");
      return false;
    }
  };

  const exportWorkspace = async () => {
    if (privateFinancialDataStatus !== "ready") {
      addToast(
        "Private financial data must finish loading or migration before a complete export is available.",
        "warning",
      );
      return;
    }
    if (!(await flushPrivateFinancialData())) return;
    if (!(await flushWorkspace())) return;
    const exportData = {
      exportedAt: new Date().toISOString(),
      workspace: workspaceData,
      privateFinancialData: createPrivateFinancialPayload(),
      deviceOnlyFinancialData: {
        dailyWage,
        dailyAllowance,
        overtimeMultiplier,
        nightDifferential,
        attendance: Object.fromEntries(
          Object.entries(attendance).map(([date, record]) => [
            date,
            mergeLocalPrivateAttendanceRecord({}, record),
          ]),
        ),
      },
    };
    const objectUrl = URL.createObjectURL(
      new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `timecloud-export-${manilaNow.date}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    addToast("Workspace export downloaded. Keep this file private.", "info");
  };

  const deleteAccount = async () => {
    if (accountDeletionLoading) return;
    const confirmed = await requestConfirmation({
      title: "Permanently delete your account?",
      message:
        "This deletes your account and all TimeCloud app data, including your workspace, attendance, and private financial data. Unsaved changes will be discarded. This cannot be undone. Operational logs and backups may be retained under the provider's retention policies.",
      confirmLabel: "Delete account",
      variant: "danger",
    });
    if (!confirmed) return;

    const password = window.prompt(
      "Enter your current password to permanently delete this account.",
    );
    if (password === null || password.length === 0) return;

    setAccountDeletionLoading(true);
    try {
      const { error } = await authClient.deleteUser({ password });
      if (error) {
        showToast(
          `Account deletion could not be confirmed: ${error.message}`,
          "error",
        );
        return;
      }

      pendingSuccessToasts.current = [];
      await refetchAuthSession();
      setWorkspaceLoadedForUser(null);
      setActiveModal(null);
      privateFinancialDataRevisionRef.current = 0;
      historicalPayslipsRef.current = [];
      setHistoricalPayslips([]);
      setLegacySalaryVault(null);
      setPrivateFinancialDataStatus("loading");
      setPrivateFinancialDataError("");
      addToast(
        "Account and all associated TimeCloud app data were deleted.",
        "info",
      );
    } catch (error) {
      console.error("Account deletion request failed:", error);
      showToast(
        error instanceof Error
          ? `Account deletion could not be confirmed: ${error.message}`
          : "Account deletion could not be confirmed. Check your account status before retrying.",
        "error",
      );
    } finally {
      setAccountDeletionLoading(false);
    }
  };

  const handleClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target instanceof HTMLElement && target.id.endsWith("Modal")) {
      setActiveModal(null);
      return;
    }
    const actionElement = target.closest("[data-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.action.trim();
    if (action.startsWith("openModal(")) setActiveModal(actionArgument(action));
    else if (action.startsWith("closeModal(")) setActiveModal(null);
    else if (action.startsWith("showToast(")) {
      const match = action.match(
        /showToast\(\s*['"]([\s\S]*?)['"]\s*(?:,\s*['"]([^'"]+)['"])?/,
      );
      if (match) showToast(match[1], match[2] || "success");
    } else if (action.startsWith("slidePage("))
      setPage(Number(action.match(/\d+/)?.[0] || 0));
    else if (action === "exportWorkspace()") exportWorkspace();
    else if (action.startsWith("changeMonth("))
      changeMonth(Number(action.match(/-?\d+/)?.[0] || 0));
    else if (action === "resetCalendar()") resetCalendar();
    else if (action === "openManualEntryModal()") {
      setManualEntryInitialType("Present");
      setActiveModal("manualEntryModal");
    } else if (action === "openMarkAbsentModal()") {
      setManualEntryInitialType("Absent");
      setActiveModal("manualEntryModal");
    } else if (action === "clearSelectedShift()") {
      void clearAttendanceDates([selectedDate]);
    } else if (action === "openAssignShiftModal()") {
      clearCalendarRange();
      setCustomShiftName("");
      setSelectedShiftTemplate("rest-day");
      setIsCustomShiftActive(false);
      setActiveModal("assignShiftModal");
    } else if (action === "addExpense()") addExpense();
    else if (action.startsWith("switchSettingsTab("))
      setActiveSettingsTab(actionArgument(action));
    else if (action.startsWith("selectShiftIcon(")) {
      setSelectedIcon(
        actionArgument(action)
          .replace(/\bfa-solid\b/g, "")
          .trim(),
      );
    } else if (action.startsWith("selectShiftCard(")) {
      setSelectedShiftTemplate(actionArgument(action));
      setCustomShiftName("");
      setIsCustomShiftActive(false);
    } else if (action.startsWith("deleteShiftTemplate(")) {
      const id = actionArgument(action);
      const template = shiftTemplates.find((item) => item.id === id);
      if (!template || template.protected) return;
      setShiftTemplates((current) => current.filter((item) => item.id !== id));
      if (selectedShiftTemplate === id) setSelectedShiftTemplate("rest-day");
      if (selectedShiftTemplate === id) setIsCustomShiftActive(false);
      showToast(`"${template.label}" template deleted.`, "success");
    } else if (action.startsWith("handleSaveCustomShift(")) {
      event.preventDefault();
      const name = customShiftName.trim();
      if (!name) return;
      const startTime = normalizeTwelveHourShiftTime(customShiftStart);
      const endTime = normalizeTwelveHourShiftTime(customShiftEnd);
      if (startTime === null || endTime === null) {
        showToast(
          "Enter valid custom shift times in 12-hour format, such as 10:00 PM.",
          "warning",
        );
        return;
      }
      let iconColor = "text-teal-600";
      if (selectedIcon.includes("sun") && !selectedIcon.includes("cloud"))
        iconColor = "text-amber-500";
      else if (selectedIcon.includes("moon")) iconColor = "text-indigo-600";
      else if (selectedIcon.includes("cloud-sun"))
        iconColor = "text-orange-500";
      else if (selectedIcon.includes("shield")) iconColor = "text-rose-600";
      else if (selectedIcon.includes("bolt")) iconColor = "text-amber-500";
      else if (selectedIcon.includes("clock")) iconColor = "text-slate-600";
      const id = `custom-${crypto.randomUUID()}`;
      setShiftTemplates((current) => [
        ...current,
        {
          id,
          name,
          label: name,
          range: `${formatTime(startTime)} - ${formatTime(endTime)}`,
          assigned: `${formatTime(startTime)} - ${formatTime(endTime)}`,
          startTime,
          endTime,
          icon: selectedIcon,
          iconColor,
        },
      ]);
      setSelectedShiftTemplate(id);
      setCustomShiftName("");
      setIsCustomShiftActive(false);
      showToast(`Custom shift "${name}" saved to options.`, "success");
    }
  };

  const handleTimeClockClick = async () => {
    if (attendancePunchError) {
      showToast(
        "Cloud attendance records could not be loaded. Retry after restoring the connection before recording a punch.",
        "error",
      );
      return;
    }

    if (activeTimeEntry) {
      const { date, time: timeIn } = activeTimeEntry;
      const activeRecord = attendance[date] || defaultAttendance;
      const activeShiftWindow = getShiftWindow(activeRecord, date);
      const nowAt = getCurrentManilaMinutes(manilaNow);
      const availability = getAttendancePunchAvailability({
        record: activeRecord,
        shiftWindow: activeShiftWindow,
        date,
        currentDate: manilaNow.date,
        currentMinutes: nowAt,
        activeTimeEntryDate: activeTimeEntry.date,
        earlyPunchWindowMinutes,
        hasAttendanceRecord: hasValidAttendanceRecord(activeRecord),
      });
      if (!availability.canTimeOut) {
        showToast(
          "Time Out is available after Time In and until the assigned shift ends. Select the scheduled date or today for an overnight shift.",
          "warning",
        );
        return;
      }
      try {
        const punch = await clockOutForShift(date, user?.id);
        const timeOut = getManilaTime(new Date(punch.timeAt));
        const recordedTimeIn = punch.record.workStartTime || timeIn;
        const inValue = formatTime(recordedTimeIn);
        const outValue = formatTime(timeOut);
        const completedRecord = applyAttendanceTiming(
          mergeLocalPrivateAttendanceRecord(
            {
              ...punch.record,
              assigned: punch.record.hasAssignedShift
                ? punch.record.assigned
                : `${inValue} - ${outValue}`,
              in: inValue,
              out: outValue,
              workStartTime: recordedTimeIn,
              workEndTime: timeOut,
              clockedIn: false,
              dots: [{ title: "Present", color: "bg-emerald-500" }],
              badges: [
                { text: "Present", color: "bg-emerald-100 text-emerald-800" },
              ],
            },
            activeRecord,
          ),
          recordedTimeIn,
          timeOut,
          lateGracePeriodMinutes,
        );
        setAttendance((state) => ({ ...state, [date]: completedRecord }));
        setActiveTimeEntry(null);
        showToast(
          `Timed out at ${outValue}. Attendance saved for ${date}.`,
          "success",
        );
      } catch (error) {
        if (error?.code === "ACTIVE_PUNCH_REQUIRED") {
          showToast(
            "Time Out requires an active cloud-recorded Time In and can only be recorded once.",
            "warning",
          );
        } else if (
          error?.code === "INVALID_SCHEDULE" ||
          error?.code === "PUNCH_WINDOW_CLOSED"
        ) {
          showToast(
            "The server rejected Time Out because the shift time is invalid or the clock-out window has ended. Use Manual Entry to correct a missed punch.",
            "error",
          );
        } else {
          console.error("Time Out cloud save failed:", error);
          showToast(
            `Time Out could not be saved to the cloud${error?.message ? `: ${error.message}` : ". Check your connection and try again."}`,
            "error",
          );
        }
        return;
      }
      return;
    }

    const currentRecord = attendance[selectedDate] || defaultAttendance;
    const currentShiftWindow = getShiftWindow(currentRecord, selectedDate);
    const nowAt = getCurrentManilaMinutes(manilaNow);
    const availability = getAttendancePunchAvailability({
      record: currentRecord,
      shiftWindow: currentShiftWindow,
      date: selectedDate,
      currentDate: manilaNow.date,
      currentMinutes: nowAt,
      activeTimeEntryDate: activeTimeEntry?.date,
      earlyPunchWindowMinutes,
      hasAttendanceRecord: hasValidAttendanceRecord(currentRecord),
    });
    if (!availability.canTimeIn) {
      showToast(
        `Time In is available only on the scheduled date, up to ${earlyPunchWindowMinutes} minutes before shift start and before shift end.`,
        "warning",
      );
      return;
    }
    if (
      currentRecord.hasAssignedShift !== true &&
      !(currentRecord.shiftStartTime && currentRecord.shiftEndTime)
    ) {
      showToast("Assign a shift to this date before clocking in.", "warning");
      return;
    }
    if (
      ["Leave", "Absent", "Rest Day", "Company Break"].includes(
        currentRecord.type,
      )
    ) {
      showToast(
        `Cannot clock in on a ${currentRecord.type.toLowerCase()} record.`,
        "warning",
      );
      return;
    }
    if (
      currentRecord.clockedIn ||
      (currentRecord.in && currentRecord.in !== "—") ||
      (currentRecord.out && currentRecord.out !== "—")
    ) {
      showToast(
        "A time record already exists for this date. Use Manual Entry to correct it.",
        "warning",
      );
      return;
    }

    const targetDate = selectedDate;
    const hasScheduledShift =
      currentRecord.hasAssignedShift === true ||
      Boolean(currentRecord.shiftStartTime && currentRecord.shiftEndTime);
    try {
      if (!(await flushWorkspace())) return;
      const punch = await clockInForShift(targetDate, user?.id);
      const time = punch.record.workStartTime;
      const inValue = formatTime(time);
      const clockedInRecord = applyAttendanceTiming(
        mergeLocalPrivateAttendanceRecord(
          {
            ...punch.record,
            assigned: hasScheduledShift
              ? currentRecord.assigned
              : `${inValue} - Tracking`,
          },
          currentRecord,
        ),
        time,
        "",
        lateGracePeriodMinutes,
      );
      setAttendance((state) => ({ ...state, [targetDate]: clockedInRecord }));
      setActiveTimeEntry({ date: targetDate, time });
      showToast(
        `Timed in at ${inValue}. Remember to time out when your shift ends.`,
        "success",
      );
    } catch (error) {
      if (error?.code === "PUNCH_ALREADY_EXISTS") {
        showToast(
          "A Time In was already recorded for this shift, possibly in another browser.",
          "warning",
        );
      } else {
        showToast(
          "Time In could not be saved to the cloud. Check your connection and try again.",
          "error",
        );
      }
    }
  };

  const handleChange = (event) => {
    const { id, value } = event.target;
    if (id === "customShiftName") setCustomShiftName(value);
    else if (id === "customShiftStart") setCustomShiftStart(value);
    else if (id === "customShiftEnd") setCustomShiftEnd(value);
  };

  const handleSubmit = (event) => {
    const form = event.target;
    const action = form.dataset.submitAction;
    if (!action) return;
    event.preventDefault();
    const data = new FormData(form);
    if (action.startsWith("handleManualEntrySubmit")) {
      const entryType = data.get("manualEntryType");
      const isAbsentEntry = entryType === "Absent";
      const targetDate = String(
        data.get("manualEntryDate") || selectedCalendarRange?.startDate || "",
      );
      const targetDates = selectedCalendarRange
        ? getInclusiveDateKeys(
            selectedCalendarRange.startDate,
            selectedCalendarRange.endDate,
          )
        : getInclusiveDateKeys(targetDate, targetDate);
      const isRangeEntry = Boolean(selectedCalendarRange);
      const manualTimeIn = String(data.get("manualTimeIn") || "");
      const manualTimeOut = String(data.get("manualTimeOut") || "");
      const manualInMinutes = parseTimeMinutes(manualTimeIn);
      const manualOutMinutes = parseTimeMinutes(manualTimeOut);
      if (!targetDates.length) {
        showToast("Choose a valid target date.", "warning");
        return;
      }
      if (isAbsentEntry && targetDates.includes(activeTimeEntry?.date)) {
        showToast(
          "Cannot mark attendance absent while Time In is active.",
          "warning",
        );
        return;
      }
      if (isRangeEntry) {
        const conflictingDates = getManualEntryRangeConflicts(
          attendance,
          targetDates,
          activeTimeEntry?.date,
        );
        if (conflictingDates.length) {
          showToast(
            `Manual entry was not applied. Attendance already exists or Time In is active on: ${conflictingDates.join(", ")}.`,
            "warning",
          );
          return;
        }
      }
      if (
        !isAbsentEntry &&
        (manualInMinutes === null ||
          manualOutMinutes === null ||
          manualInMinutes === manualOutMinutes)
      ) {
        showToast(
          "Enter valid Time In and Time Out values. Overnight shifts are supported.",
          "warning",
        );
        return;
      }
      const isOvertimeClaim = entryType === "Overtime";
      const configuredOvertimeMultiplier = Number(overtimeMultiplier);
      if (
        isOvertimeClaim &&
        (!Number.isFinite(configuredOvertimeMultiplier) ||
          configuredOvertimeMultiplier <= 0)
      ) {
        showToast(
          "Enter a valid overtime multiplier in Settings before recording overtime.",
          "warning",
        );
        return;
      }

      const attendanceUpdates = {};
      for (const targetDate of targetDates) {
        const assignedRecord = attendance[targetDate] || defaultAttendance;
        const hasAssignedShift =
          assignedRecord.hasAssignedShift === true ||
          Boolean(
            assignedRecord.shiftStartTime && assignedRecord.shiftEndTime,
          );
        const isShiftlessAbsence =
          isAbsentEntry &&
          !hasAssignedShift &&
          ["Unassigned", "Regular"].includes(assignedRecord.type);
        if (!hasAssignedShift && !isShiftlessAbsence) {
          showToast(
            `Assign a shift to ${targetDate} before adding a manual attendance entry.`,
            "warning",
          );
          return;
        }
        if (assignedRecord.type !== "Regular" && !isShiftlessAbsence) {
          showToast(
            `Manual attendance cannot replace a ${assignedRecord.type.toLowerCase()} date on ${targetDate} without an eligible scheduled shift.`,
            "warning",
          );
          return;
        }
        const scheduledStartValue = parseTimeMinutes(
          assignedRecord.shiftStartTime,
        );
        const scheduledEndValue = parseTimeMinutes(
          assignedRecord.shiftEndTime,
        );
        if (
          !isAbsentEntry &&
          (scheduledStartValue === null || scheduledEndValue === null)
        ) {
          showToast(
            `The assigned shift on ${targetDate} has invalid scheduled times. Update the shift before entering attendance.`,
            "warning",
          );
          return;
        }
        const scheduledStart = scheduledStartValue ?? 0;
        const scheduledEndOfDay = scheduledEndValue ?? 0;
        const overnightShift = scheduledEndOfDay <= scheduledStart;
        const scheduledEnd = overnightShift
          ? scheduledEndOfDay + 1440
          : scheduledEndOfDay;
        const manualStart =
          overnightShift && manualInMinutes < scheduledEndOfDay
            ? manualInMinutes + 1440
            : manualInMinutes;
        const manualEnd =
          overnightShift &&
          (manualOutMinutes <= manualInMinutes || manualStart >= 1440)
            ? manualOutMinutes + 1440
            : manualOutMinutes;
        if (!isAbsentEntry) {
          const invalidShiftTimes =
            manualStart < scheduledStart - earlyPunchWindowMinutes ||
            manualStart > scheduledEnd ||
            manualEnd <= manualStart ||
            manualEnd > manualStart + 1440 ||
            (isOvertimeClaim
              ? manualEnd <= scheduledEnd
              : manualEnd > scheduledEnd);
          if (invalidShiftTimes) {
            showToast(
              isOvertimeClaim
                ? `An overtime claim on ${targetDate} must end after the assigned shift. Time In must fall within the shift and its allowed early-punch window.`
                : `Time In and Time Out on ${targetDate} must fall within the assigned shift and its allowed early-punch window.`,
              "warning",
            );
            return;
          }
        }

        let badges = [
          { text: "Present", color: "bg-emerald-100 text-emerald-800" },
        ];
        let dots = [{ title: "Present", color: "bg-emerald-500" }];
        let shift = "Manual Entry Adjustment";
        let base = assignedRecord.base || "P0.00";
        let ot = "P0.00";
        let est = `${base} PHP`;
        let overtimeAmount = 0;
        let overtimeMinutes = 0;
        let inValue = formatTime(manualTimeIn);
        let outValue = formatTime(manualTimeOut);
        const rawTimingFlags = isAbsentEntry
          ? {
              late: false,
              lateMinutes: 0,
              undertime: false,
              undertimeMinutes: 0,
            }
          : getAttendanceTimingFlags(
              assignedRecord,
              manualTimeIn,
              manualTimeOut,
              lateGracePeriodMinutes,
            );
        const timingFlags =
          entryType === "Half-day"
            ? { ...rawTimingFlags, undertime: false, undertimeMinutes: 0 }
            : rawTimingFlags;
        const timingIndicators = getTimingIndicators(timingFlags);
        if (entryType === "Half-day") {
          const scheduledShiftMinutes = scheduledEnd - scheduledStart;
          const hourlyBase =
            getAmount(assignedRecord.base) / (scheduledShiftMinutes / 60);
          base = formatPayAmount(hourlyBase * 4);
          est = `${base} PHP`;
          shift = "Half-day";
          badges = [
            { text: "Half-day", color: "bg-amber-100 text-amber-800" },
          ];
          dots = [{ title: "Half-day", color: "bg-amber-500" }];
        } else if (isOvertimeClaim) {
          const scheduledShiftMinutes = scheduledEnd - scheduledStart;
          overtimeMinutes = manualEnd - scheduledEnd;
          const hourlyBase =
            getAmount(assignedRecord.base) / (scheduledShiftMinutes / 60);
          overtimeAmount =
            hourlyBase *
            (overtimeMinutes / 60) *
            configuredOvertimeMultiplier;
          const overtimeDurationLabel = formatDuration(overtimeMinutes);
          badges.push({
            text: "Overtime Claim",
            color: "bg-purple-100 text-purple-800",
            title: `Overtime: ${overtimeDurationLabel}`,
          });
          dots.push({
            title: `Overtime: ${overtimeDurationLabel}`,
            color: "bg-purple-500",
          });
          shift = "Overtime Claim";
          est = formatPayAmount(getAmount(base) + overtimeAmount) + " PHP";
          ot = `${formatPayAmount(overtimeAmount)} (${formatDuration(overtimeMinutes)} OT)`;
        } else if (isAbsentEntry) {
          badges = [{ text: "Absent", color: "bg-red-100 text-red-800" }];
          dots = [];
          shift = "Absent";
          base = "P0.00";
          ot = "P0.00";
          est = "P0.00 PHP";
          inValue = "—";
          outValue = "—";
        } else if (entryType === "Official Business") {
          badges = [
            { text: "Official Business", color: "bg-teal-100 text-teal-800" },
          ];
          shift = "Official Business / Field Work";
        }

        attendanceUpdates[targetDate] = applyAttendanceTiming(
          {
            ...assignedRecord,
            type: isAbsentEntry ? "Absent" : "Regular",
            punchSource: "manual",
            assignedShiftName: getAssignedShiftName(
              assignedRecord,
              shiftTemplates,
            ),
            shift,
            wageRate: isAbsentEntry ? "0%" : "100%",
            base,
            ot,
            penalty: isAbsentEntry
              ? `-${formatPayAmount(getAmount(assignedRecord.base))} (Absence)`
              : "P0.00",
            est,
            assigned: `${inValue} - ${outValue}`,
            in: inValue,
            out: outValue,
            hasAssignedShift:
              assignedRecord.hasAssignedShift === true ||
              Boolean(
                assignedRecord.shiftStartTime && assignedRecord.shiftEndTime,
              ),
            clockedIn: false,
            workStartTime: isAbsentEntry ? "" : manualTimeIn,
            workEndTime: isAbsentEntry ? "" : manualTimeOut,
            manualTimeInAt: isAbsentEntry
              ? null
              : getManilaTimestamp(targetDate, manualStart),
            manualTimeOutAt: isAbsentEntry
              ? null
              : getManilaTimestamp(targetDate, manualEnd),
            timeZone: "Asia/Manila",
            isHalfDay: entryType === "Half-day",
            overtimeAmount,
            overtimeMinutes,
            dots: [...dots, ...timingIndicators.dots],
            badges: [...badges, ...timingIndicators.badges],
          },
          isAbsentEntry ? "" : manualTimeIn,
          isAbsentEntry ? "" : manualTimeOut,
          lateGracePeriodMinutes,
        );
      }
      setAttendance((state) => ({ ...state, ...attendanceUpdates }));
      const [targetYear, targetMonth, targetDay] = targetDates[0]
        .split("-")
        .map(Number);
      changeMonthTo(targetYear, targetMonth - 1);
      setSelectedDay(targetDay);
      if (targetDates.includes(activeTimeEntry?.date)) setActiveTimeEntry(null);
      setActiveModal(null);
      showToast(
        isRangeEntry
          ? `Manual entry applied to ${targetDates.length} day(s).`
          : "Manual entry applied successfully!",
        "success",
      );
    } else if (action.startsWith("handleAssignShiftSubmit")) {
      const startValue = String(
        data.get("assignStartDate") || selectedCalendarRange?.startDate || "",
      );
      const endValue = String(
        data.get("assignEndDate") || selectedCalendarRange?.endDate || "",
      );
      if (!startValue || !endValue) {
        showToast("Please select both start and end dates.", "warning");
        return;
      }
      if (startValue > endValue) {
        showToast("Start date cannot be after end date.", "warning");
        return;
      }
      const dateKeys = getInclusiveDateKeys(startValue, endValue);
      if (!dateKeys.length) {
        showToast("Please select valid start and end dates.", "warning");
        return;
      }
      const template =
        shiftTemplates.find((item) => item.id === selectedShiftTemplate) ||
        shiftTemplates.find((item) => item.id === "rest-day");
      setAttendance((state) => ({
        ...state,
        ...createShiftAssignmentUpdates(
          state,
          dateKeys,
          template,
          dailyWage,
          shiftTemplates,
        ),
      }));
      setActiveModal(null);
      showToast(
        `Shift "${template.name}" assigned to ${dateKeys.length} day(s).`,
        "success",
      );
    } else if (action.startsWith("handleGrantLeaveSubmit")) {
      const type = String(data.get("grantLeaveTypeSelect") || "VL");
      if (!Object.hasOwn(leaveBalances, type)) {
        showToast("Choose a valid leave type.", "warning");
        return;
      }
      const startDate = String(data.get("grantLeaveStartDate") || "");
      const endDate = String(data.get("grantLeaveEndDate") || "");
      const parsedStart = new Date(`${startDate}T00:00:00Z`);
      const parsedEnd = new Date(`${endDate}T00:00:00Z`);
      const isValidDate = (value, parsed) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value;
      if (
        !isValidDate(startDate, parsedStart) ||
        !isValidDate(endDate, parsedEnd)
      ) {
        showToast("Choose valid leave start and end dates.", "warning");
        return;
      }
      if (parsedStart > parsedEnd) {
        showToast("Leave start date cannot be after the end date.", "warning");
        return;
      }
      const dayCount = Math.round((parsedEnd - parsedStart) / 86400000) + 1;
      if (dayCount > leaveBalances[type]) {
        showToast(
          `Not enough ${type} credits for ${dayCount} day(s).`,
          "warning",
        );
        return;
      }
      const leaveDates = Array.from({ length: dayCount }, (_, index) => {
        const date = new Date(parsedStart);
        date.setUTCDate(date.getUTCDate() + index);
        return date.toISOString().slice(0, 10);
      });
      const hasIneligibleDate = leaveDates.some((date) => {
        const record = attendance[date] || defaultAttendance;
        return (
          record.type === "Leave" ||
          record.type === "Rest Day" ||
          record.clockedIn ||
          (record.in && record.in !== "—")
        );
      });
      if (hasIneligibleDate) {
        showToast(
          "The selected range includes a rest day, existing leave, or a date with attendance already recorded.",
          "warning",
        );
        return;
      }
      const leave = leaveTypes[type];
      const leaveName = leave.name;
      setAttendance((state) => {
        const updated = { ...state };
        leaveDates.forEach((date) => {
          updated[date] = {
            type: "Leave",
            shift: leaveName,
            wageRate: "100%",
            base:
              Number(dailyWage) > 0
                ? formatPayAmount(Number(dailyWage))
                : "P0.00",
            ot: "P0.00",
            penalty: "P0.00",
            est: `${Number(dailyWage) > 0 ? formatPayAmount(Number(dailyWage)) : "P0.00"} PHP`,
            assigned: "Leave",
            in: "—",
            out: "—",
            dots: [],
            leaveCode: type,
            leaveIcon: leave.icon,
            badges: [{ text: leaveName, color: leave.badgeColor }],
          };
        });
        return updated;
      });
      setLeaveBalances((state) => ({
        ...state,
        [type]: state[type] - dayCount,
      }));
      const [firstYear, firstMonth, firstDay] = startDate
        .split("-")
        .map(Number);
      changeMonthTo(firstYear, firstMonth - 1);
      setYear(firstYear);
      setMonthIndex(firstMonth - 1);
      setSelectedDay(firstDay);
      setActiveModal(null);
      showToast(
        `${leaveName} granted for ${dayCount} day(s). Remaining credits updated.`,
        "success",
      );
    }
  };

  const monthTabs = useMemo(() => {
    const baseYear = monthCarouselMotion?.year ?? year;
    const baseMonthIndex = monthCarouselMotion?.monthIndex ?? monthIndex;
    const offset = monthCarouselMotion?.offset ?? 0;
    const padding = Math.max(4, Math.abs(offset));
    return Array.from({ length: padding * 2 + 1 }, (_, position) => {
      const monthOffset = position - padding;
      const tabDate = new Date(baseYear, baseMonthIndex + monthOffset, 1);
      const tabMonthIndex = tabDate.getMonth();
      const tabYear = tabDate.getFullYear();
      const isActive = tabMonthIndex === monthIndex && tabYear === year;
      return (
        <button
          key={`${tabYear}-${tabMonthIndex}`}
          type="button"
          onClick={() => changeMonthTo(tabYear, tabMonthIndex)}
          aria-current={isActive ? "date" : undefined}
          className={`relative z-10 inline-flex h-6 w-10 shrink-0 items-center justify-center rounded-lg text-center text-xs font-medium transition-colors duration-300 cursor-pointer ${isActive ? "text-white font-bold" : "text-slate-600 hover:text-slate-900"}`}
        >
          {monthAbbreviations[tabMonthIndex]}
        </button>
      );
    });
  }, [monthIndex, monthCarouselMotion, year]);

  const activeCalendarRange =
    calendarRangePreview || selectedCalendarRange;
  const calendarRangeStatus = calendarRangePreview
    ? `Selecting: ${formatCalendarRangeDate(calendarRangePreview.startDate)} – ${formatCalendarRangeDate(calendarRangePreview.endDate)} (${calendarRangePreview.dayCount} day${calendarRangePreview.dayCount === 1 ? "" : "s"})`
    : calendarRangeMode
      ? calendarRangeAnchor
        ? `Select an end date after ${formatCalendarRangeDate(calendarRangeAnchor)}`
        : "Select a start date"
      : "Single-click any day to inspect";
  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    const previousMonthDays = new Date(year, monthIndex, 0).getDate();
    const incentiveDates = new Set(
      availableEmployeeIncentives.map((incentive) => incentive.date),
    );
    const cells = [];
    for (let offset = firstDay; offset > 0; offset -= 1) {
      cells.push(
        <div
          key={`previous-${offset}`}
          className="min-h-[100px] rounded-xl border border-slate-100 bg-slate-50/50 p-0 opacity-40"
        >
          <div className="p-2.5 h-full flex flex-col">
            <span className="text-xs font-semibold text-slate-400">
              {previousMonthDays - offset + 1}
            </span>
          </div>
        </div>,
      );
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const date = formatDate(year, monthIndex, day);
      const calendarRecord = applyHoliday(
        applyConfiguredAttendanceTiming(
          getAutomaticAttendanceStatus(
            getRecord(attendance, monthIndex, day, year),
            date,
            manilaNow,
          ),
          lateGracePeriodMinutes,
        ),
        getHolidayForDate(holidays, date, selectedLocality),
      );
      const payrollCalculation = getPayrollRecordCalculation(
        calendarRecord,
        date,
      );
      cells.push(
        <CalendarDay
          key={`${year}-${monthIndex}-${day}`}
          day={day}
          year={year}
          monthIndex={monthIndex}
          dateKey={date}
          shiftTemplates={shiftTemplates}
          record={applyNightDifferential(calendarRecord, payrollCalculation)}
          selected={day === selectedDay && !activeCalendarRange}
          hasIncentive={incentiveDates.has(date)}
          rangePosition={getDateRangePosition(date, activeCalendarRange)}
          rangeMode={calendarRangeMode}
          onSelect={(event) => handleCalendarDateClick(date, event)}
          onRangePointerStart={handleRangePointerStart}
          onRangePointerMove={handleRangePointerMove}
          onRangePointerEnd={handleRangePointerEnd}
          onRangePointerCancel={handleRangePointerCancel}
          onNavigate={handleCalendarDayNavigate}
        />,
      );
    }
    return cells;
  }, [
    attendance,
    activeCalendarRange,
    availableEmployeeIncentives,
    calendarRangeMode,
    getPayrollRecordCalculation,
    handleCalendarDateClick,
    handleCalendarDayNavigate,
    handleRangePointerCancel,
    handleRangePointerEnd,
    handleRangePointerMove,
    handleRangePointerStart,
    holidays,
    lateGracePeriodMinutes,
    manilaNow,
    monthIndex,
    selectedDay,
    selectedLocality,
    shiftTemplates,
    year,
  ]);

  const shiftTemplateCards = shiftTemplates.map((template) => (
    <div
      key={template.id}
      role="button"
      tabIndex={0}
      aria-pressed={selectedShiftTemplate === template.id}
      onClick={(event) => {
        if (event.target.closest("button")) return;
        setSelectedShiftTemplate(template.id);
        setCustomShiftName("");
        setIsCustomShiftActive(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelectedShiftTemplate(template.id);
          setCustomShiftName("");
          setIsCustomShiftActive(false);
        }
      }}
      className={`shift-card relative cursor-pointer border-2 rounded-2xl p-3.5 flex flex-col items-center text-center transition ${selectedShiftTemplate === template.id ? "border-indigo-600 bg-indigo-50/30 shadow-xs" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      <span
        className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${
          ["morning", "afternoon"].includes(template.label?.toLowerCase())
            ? "bg-indigo-100 text-indigo-600"
            : "bg-slate-100"
        }`}
      >
        <ShiftIcon
          icon={template.icon}
          size={16}
          className={
            ["morning", "afternoon"].includes(
              template.label?.toLowerCase(),
            )
              ? ""
              : template.label?.toLowerCase() === "night"
                ? "text-slate-600"
                : template.iconColor
          }
        />
      </span>
      <span className="font-bold text-slate-800 text-xs">{template.label}</span>
      <span className="text-[10px] text-slate-500 mt-0.5">
        {template.range}
      </span>
      {!template.protected && (
        <button
          type="button"
          data-action={`deleteShiftTemplate('${template.id}')`}
          aria-label={`Delete ${template.label} template`}
          className="absolute top-1 right-1 text-slate-400 hover:text-rose-600 p-1"
        >
          <i className="fa-solid fa-trash-can text-[10px]" />
        </button>
      )}
    </div>
  ));

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-clip bg-slate-50 font-sans text-textMain antialiased selection:bg-teal-500 selection:text-white"
      onClick={handleClick}
      onChange={handleChange}
      onSubmit={handleSubmit}
    >
      {authLoading && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
          Restoring your secure session...
        </div>
      )}
      {user && workspaceLoading && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
          Loading your private cloud workspace...
        </div>
      )}
      {workspaceError && user && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
            <p className="text-sm text-rose-700" role="alert">
              {workspaceError}
            </p>
            <button
              type="button"
              onClick={() => setWorkspaceLoadAttempt((attempt) => attempt + 1)}
              className="mt-5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={async () => {
                if (signOutInProgressRef.current) return;
                signOutInProgressRef.current = true;
                setSignOutStatus("Signing out...");
                try {
                  const { error } = await authClient.signOut();
                  if (error) {
                    showToast("Unable to sign out. Please try again.", "error");
                  }
                } catch {
                  showToast("Unable to sign out. Please try again.", "error");
                } finally {
                  signOutInProgressRef.current = false;
                  setSignOutStatus("");
                }
              }}
              disabled={Boolean(signOutStatus)}
              className="ml-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-wait disabled:opacity-70"
            >
              {signOutStatus || "Sign out"}
            </button>
          </div>
        </div>
      )}
      {user &&
        !recoveryMode &&
        workspaceLoadedForUser === user.id &&
        !workspaceError && (
          <>
            <div className="sticky top-0 z-50">
              <Header
                clock={clock}
                user={user}
                isSigningOut={Boolean(signOutStatus)}
                onLogout={async () => {
                  if (signOutInProgressRef.current) return;
                  signOutInProgressRef.current = true;
                  try {
                    setSignOutStatus("Saving private financial data...");
                    if (!(await flushPrivateFinancialData())) return;
                    setSignOutStatus("Saving workspace changes...");
                    if (!(await flushWorkspace())) return;
                    setSignOutStatus("Signing out...");
                    const { error } = await authClient.signOut();
                    if (error) {
                      showToast("Unable to sign out. Please try again.", "error");
                    } else {
                      addToast("Signed out successfully.", "info");
                    }
                  } catch {
                    showToast("Unable to sign out. Please try again.", "error");
                  } finally {
                    signOutInProgressRef.current = false;
                    setSignOutStatus("");
                  }
                }}
              />
              {signOutStatus && (
                <div
                  className="flex items-center justify-center gap-2 border-b border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  <span>{signOutStatus}</span>
                </div>
              )}
              {privateFinancialDataStatus !== "ready" && (
                <div
                  className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between"
                  role="status"
                >
                  <span>
                    {privateFinancialDataStatus === "migration-required"
                      ? "Existing encrypted salary data needs a one-time migration. Enter your current passphrase in Settings; it will not be needed after migration."
                      : privateFinancialDataStatus === "error"
                        ? "Private financial data could not be loaded. It is not available for editing until the data can be loaded."
                        : privateFinancialDataStatus === "unavailable"
                          ? "Private financial storage is not configured. Legacy financial data will be preserved until it is available."
                          : "Private financial data is loading."}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      privateFinancialDataStatus === "migration-required"
                        ? (setActiveSettingsTab("general"),
                          setActiveModal("settingsModal"))
                        : retryWorkspaceLoad()
                    }
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold hover:bg-amber-100"
                  >
                    {privateFinancialDataStatus === "migration-required"
                      ? "Migrate data"
                      : "Retry loading"}
                  </button>
                </div>
              )}
            </div>
            {(attendancePunchError || workspaceDataWarning) && (
              <div
                className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between"
                role="status"
              >
                <div className="space-y-1">
                  {attendancePunchError && (
                    <p>
                      Attendance punch records could not be loaded. Time In and
                      Time Out are unavailable; other workspace features remain
                      usable. {attendancePunchError}
                    </p>
                  )}
                  {workspaceDataWarning && <p>{workspaceDataWarning}</p>}
                </div>
                {attendancePunchError && (
                  <button
                    type="button"
                    onClick={retryWorkspaceLoad}
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold hover:bg-amber-100"
                  >
                    Retry cloud data
                  </button>
                )}
              </div>
            )}
            {privateFinancialDataError && (
              <div
                className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
                role="alert"
              >
                {privateFinancialDataError}
              </div>
            )}
            {workspaceSaveError && (
              <div
                className="flex flex-col gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 sm:flex-row sm:items-center sm:justify-between"
                role="alert"
              >
                <span>{workspaceSaveError}</span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setSaveRequest((request) => request + 1)}
                    className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 font-semibold hover:bg-rose-100"
                  >
                    Retry save
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await requestConfirmation({
                        title: "Reload cloud data?",
                        message:
                          "Reloading will discard unsynced changes. Continue only if you are sure you do not need them.",
                        confirmLabel: "Reload data",
                        variant: "warning",
                      })) {
                        window.location.reload();
                      }
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Reload cloud data
                  </button>
                </div>
              </div>
            )}
            <DashboardContent
              requestConfirmation={requestConfirmation}
              page={page}
              monthTabs={monthTabs}
              monthCarouselOffset={monthCarouselMotion?.offset ?? 0}
              onMonthCarouselTransitionEnd={finishMonthCarouselMotion}
              yearOptions={yearOptions}
              onYearChange={changeYear}
              calendarCells={calendarCells}
              calendarRangeMode={calendarRangeMode}
              calendarRangeStatus={calendarRangeStatus}
              onCalendarRangeModeToggle={handleCalendarRangeModeToggle}
              monthLabel={monthLabel}
              monthValue={calendarPayrollMonth}
              year={year}
              selectedDate={selectedDate}
              canClearShift={canClearSelectedShift}
              isTimedIn={Boolean(
                activeTimeEntry &&
                (activeTimeEntry.date === selectedDate || canTimeOut),
              )}
              canRecordAttendance={canRecordAttendance}
              canTimeIn={canTimeIn}
              canTimeOut={canTimeOut}
              earlyPunchWindowMinutes={earlyPunchWindowMinutes}
              holidayPayEstimate={selectedHolidayPay}
              estimatedEarnings={selectedEstimatedEarnings}
              selectedDateIncentives={selectedDateIncentives}
              onAddIncentive={addEmployeeIncentive}
              dailyAllowance={selectedPayrollSettings.dailyAllowance}
              holidayWorkedHours={selectedWorkedHours}
              nightDifferentialPay={selectedNightDifferentialPay}
              overtimePay={selectedOvertimePay}
              overtimeCalculation={selectedOvertimeCalculation}
              configuredDailyWage={selectedPayrollSettings.dailyWage}
              onOpenHolidayPaySettings={() => {
                setActiveSettingsTab("earnings");
                setActiveModal("settingsModal");
              }}
              onTimeClockClick={handleTimeClockClick}
              record={selectedRecordWithNightDifferential}
              monthExpenses={financeExpenses}
              expenses={expenses}
              totalExpenses={financeTotalExpenses}
              grossPay={financeGrossPay}
              payrollDeductions={financePayrollDeductions}
              pendingPayrollRecords={financePendingPayrollCount}
              remaining={financeRemaining}
              percentage={financePercentage}
              netPay={financeNetPay}
              totalHours={financeTotalHours}
              financeTrackingScope={financeTrackingScope}
              setFinanceTrackingScope={setFinanceTrackingScope}
              financePeriodLabel={financePeriodLabel}
              formatCurrency={formatCurrency}
              expenseName={expenseName}
              setExpenseName={setExpenseName}
              expenseAmount={expenseAmount}
              setExpenseAmount={setExpenseAmount}
              expenseDate={expenseDate}
              setExpenseDate={setExpenseDate}
              expenseCategory={expenseCategory}
              setExpenseCategory={setExpenseCategory}
              onDeleteExpense={deleteExpense}
              employeeIncentives={availableEmployeeIncentives}
              onDeleteIncentive={deleteEmployeeIncentive}
              privateFinancialDataError={privateFinancialDataError}
              workspaceLoading={workspaceLoading}
              workspaceError={workspaceError}
              workspaceSaveError={workspaceSaveError}
              historicalPayslips={
                privateFinancialDataStatus === "ready" ? historicalPayslips : []
              }
              payslipHistorySaving={payslipHistorySaving}
              privateFinancialDataStatus={privateFinancialDataStatus}
              currentPayrollPeriod={payrollPeriod}
              onViewCurrentPayslip={() => {
                setActiveHistoricalPayslip(null);
                setActiveModal("payslipModal");
              }}
              onViewHistoricalPayslip={viewHistoricalPayslip}
              onDeleteHistoricalPayslip={deleteHistoricalPayslip}
              travelPlans={travelPlans}
              today={manilaNow.date}
              onCreateTravelPlan={createTravelPlan}
              onUpdateTravelPlan={updateTravelPlan}
              onCompleteTravelPlan={completeTravelPlan}
              onDeleteTravelPlan={deleteTravelPlan}
              onAddTravelExpense={addTravelExpense}
              onUpdateTravelExpense={updateTravelExpense}
              onDeleteTravelExpense={deleteTravelExpense}
            />
            <CalendarRangeActionsModal
              open={activeModal === "calendarRangeActionsModal"}
              range={selectedCalendarRange}
              onAssignShift={openRangeAssignShift}
              onClearShifts={clearSelectedShiftRange}
              onManualEntry={openRangeManualEntry}
            />
            <ManualEntryModal
              key={`manual-${selectedDate}-${selectedCalendarRange?.startDate || ""}-${selectedCalendarRange?.endDate || ""}`}
              open={activeModal === "manualEntryModal"}
              selectedDate={selectedDate}
              selectedRange={selectedCalendarRange}
              initialEntryType={manualEntryInitialType}
              initialTimeIn={
                selectedAttendanceRecord.shiftStartTime ||
                selectedAttendanceRecord.workStartTime ||
                "06:00"
              }
              initialTimeOut={
                selectedAttendanceRecord.shiftEndTime ||
                selectedAttendanceRecord.workEndTime ||
                "14:00"
              }
            />
            <AssignShiftModal
              key={`shift-${selectedDate}-${selectedCalendarRange?.startDate || ""}-${selectedCalendarRange?.endDate || ""}`}
              open={activeModal === "assignShiftModal"}
              selectedDate={selectedDate}
              selectedRange={selectedCalendarRange}
              shiftTemplateCards={shiftTemplateCards}
              isCustomShiftActive={isCustomShiftActive}
              setIsCustomShiftActive={setIsCustomShiftActive}
              customShiftName={customShiftName}
              setCustomShiftName={setCustomShiftName}
              customShiftStart={customShiftStart}
              setCustomShiftStart={setCustomShiftStart}
              customShiftEnd={customShiftEnd}
              setCustomShiftEnd={setCustomShiftEnd}
              selectedIcon={selectedIcon}
            />
            <GrantLeaveModal
              key={`leave-${selectedDate}`}
              open={activeModal === "grantLeaveModal"}
              balances={leaveBalances}
              selectedDate={selectedDate}
            />
            <PayslipModal
              open={activeModal === "payslipModal"}
              userName={user?.name}
              historicalPayslip={
                privateFinancialDataStatus === "ready"
                  ? activeHistoricalPayslip
                  : null
              }
              payrollPeriodMode={payslipPeriodMode}
              onPayrollPeriodModeChange={setPayslipPeriodMode}
              payrollPeriod={selectedPayslipPeriod}
              payrollPeriodSummary={selectedPayslipSummary}
              monthlyPayslipRange={monthlyPayslipRange}
              monthlyPayslipGross={monthlyPayslipGross}
              monthlyPayslipNet={monthlyPayslipNet}
              payrollEarningsBreakdown={selectedPayslipBreakdown}
              cutoffPayrollDeductions={selectedPayslipDeductions}
              payrollPeriodNetPay={selectedPayslipNetPay}
              payrollPeriodEarningsAvailable={isPayrollPeriodEarningsAvailable(
                privateFinancialDataStatus,
              )}
              pendingPayrollRecords={selectedPayslipPendingCount}
              dailyWage={dailyWage}
              formatCurrency={formatCurrency}
              canSavePayslip={privateFinancialDataStatus === "ready"}
              payslipAlreadySaved={Boolean(
                findPayslipSnapshot(
                  historicalPayslips,
                  user?.id,
                  selectedPayslipPeriod,
                ),
              )}
              payslipHistorySaving={payslipHistorySaving}
              onSavePayslipToHistory={savePayslipToHistory}
            />
            <FeatureErrorBoundary name="Settings">
              <SettingsModal
                open={activeModal === "settingsModal"}
                activeSettingsTab={activeSettingsTab}
                holidays={holidays}
                selectedLocality={selectedLocality}
                holidayEligibilityConfirmed={holidayEligibilityConfirmed}
                settingsBalances={settingsBalances}
                dailyWage={dailyWage}
                dailyAllowance={dailyAllowance}
                overtimeMultiplier={overtimeMultiplier}
                payrollSettings={privateFinancialSettings}
                payrollDeductions={payrollDeductions}
                nightDifferential={nightDifferential}
                payrollEffectiveDate={manilaNow.date}
                onDeleteAccount={deleteAccount}
                accountDeletionLoading={accountDeletionLoading}
                privateFinancialDataStatus={privateFinancialDataStatus}
                privateFinancialDataError={privateFinancialDataError}
                privateFinancialDataConflict={privateFinancialDataConflict}
                privateFinancialDataSyncing={privateFinancialDataSyncing}
                legacySalaryVaultAvailable={Boolean(legacySalaryVault)}
                onMigrateLegacySalaryVault={migrateLegacySalaryVault}
                onReloadPrivateFinancialData={retryWorkspaceLoad}
                onSettingsValidationError={(message) =>
                  showToast(message, "warning")
                }
                onSaveSettings={async (draft) => {
                  const currentPayrollSettings =
                    getPayrollDeductionSettingsDefaults(
                      privateFinancialSettings,
                    );
                  const financialSettingsChanged =
                    draft.dailyWage !== dailyWage ||
                    draft.dailyAllowance !== dailyAllowance ||
                    draft.overtimeMultiplier !== overtimeMultiplier ||
                    draft.nightDifferential !== nightDifferential ||
                    payrollDeductionSettingKeys.some(
                      (key) => draft[key] !== currentPayrollSettings[key],
                    );
                  if (
                    financialSettingsChanged &&
                    privateFinancialDataStatus !== "ready"
                  ) {
                    addToast(
                      "Private financial data is not ready to save yet.",
                      "warning",
                    );
                    return false;
                  }
                  if (financialSettingsChanged) {
                    window.clearTimeout(
                      privateFinancialDataSyncTimerRef.current,
                    );
                    privateFinancialDataSyncTimerRef.current = null;
                    try {
                      const currentPayrollSettings = {
                        ...privateFinancialSettings,
                        dailyWage,
                        dailyAllowance,
                        overtimeMultiplier,
                        nightDifferential,
                      };
                      const nextPayrollSettings = {
                        ...currentPayrollSettings,
                        dailyWage: draft.dailyWage,
                        dailyAllowance: draft.dailyAllowance,
                        overtimeMultiplier: draft.overtimeMultiplier,
                        nightDifferential: draft.nightDifferential,
                        ...Object.fromEntries(
                          payrollDeductionSettingKeys.map((key) => [
                            key,
                            draft[key],
                          ]),
                        ),
                      };
                      const payrollUpdate = createPayrollSettingsUpdate({
                        currentSettings: currentPayrollSettings,
                        nextSettings: nextPayrollSettings,
                        effectiveDate: draft.payrollEffectiveDate,
                        attendance,
                        holidays: draft.holidays,
                        selectedLocality: draft.selectedLocality,
                        holidayEligibilityConfirmed:
                          draft.holidayEligibilityConfirmed,
                      });
                      await persistPrivateFinancialData({
                        settings: payrollUpdate.settings,
                        attendance: payrollUpdate.attendance,
                        payslips: historicalPayslipsRef.current,
                      });
                      privateFinancialDataSkipNextSyncRef.current = true;
                      setPrivateFinancialSettings((current) => ({
                        ...current,
                        ...Object.fromEntries(
                          payrollDeductionSettingKeys.map((key) => [
                            key,
                            draft[key],
                          ]),
                        ),
                        payrollSettingsHistory:
                          payrollUpdate.settings.payrollSettingsHistory,
                      }));
                    } catch (error) {
                      const conflict = error?.code === "REVISION_CONFLICT";
                      const message = conflict
                        ? "Private financial data changed on another device. Reload before saving."
                        : error instanceof Error
                          ? error.message
                          : "Salary settings could not be saved. Your settings were not confirmed as saved.";
                      setPrivateFinancialDataError(message);
                      addToast(message, "error");
                      return false;
                    }
                  }
                  setHolidays(draft.holidays);
                  setSelectedLocality(draft.selectedLocality);
                  setHolidayEligibilityConfirmed(
                    draft.holidayEligibilityConfirmed,
                  );
                  setDailyWage(draft.dailyWage);
                  setDailyAllowance(draft.dailyAllowance);
                  setOvertimeMultiplier(draft.overtimeMultiplier);
                  setNightDifferential(draft.nightDifferential);
                  setSettingsBalances(draft.settingsBalances);
                  setLeaveBalances({
                    VL: Number(draft.settingsBalances.VL) || 0,
                    SL: Number(draft.settingsBalances.SL) || 0,
                    EL: Number(draft.settingsBalances.EL) || 0,
                  });
                  setActiveModal(null);
                  showToast("Settings saved successfully.", "success");
                  return true;
                }}
              />
            </FeatureErrorBoundary>
          </>
        )}
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />
      <ConfirmationDialog
        options={confirmation}
        onResolve={resolveConfirmation}
      />
      <AuthPage
        open={!authLoading && (!user || recoveryMode)}
        recoveryMode={recoveryMode}
        onRecoveryComplete={() => {
          setRecoveryMode(false);
          addToast("Password updated successfully.", "success");
        }}
      />
    </div>
  );
}
