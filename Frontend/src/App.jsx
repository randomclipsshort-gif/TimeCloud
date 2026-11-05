import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/layout/Header.jsx";
import AuthPage from "./components/AuthPage.jsx";
import DashboardContent from "./components/DashboardContent.jsx";
import ManualEntryModal from "./components/modals/ManualEntryModal.jsx";
import AssignShiftModal from "./components/modals/AssignShiftModal.jsx";
import GrantLeaveModal from "./components/modals/GrantLeaveModal.jsx";
import PayslipModal from "./components/modals/PayslipModal.jsx";
import SettingsModal from "./components/modals/SettingsModal.jsx";
import ToastContainer from "./components/ui/ToastContainer.jsx";
import { holidayCalendarByYear } from "./data/holidayCalendar.js";
import {
  getHolidayClassification,
  getHolidayForDate,
} from "./utils/holidayUtils.js";
import { calculateHolidayPay, getAttendanceHours } from "./utils/holidayPay.js";
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
  getCalendarPayrollPeriod,
  formatPayrollPeriod,
  getPayrollPeriodForDate,
  getPayrollPeriodForMonth,
  isPayrollPeriodEarningsAvailable,
  summarizePayrollPeriod,
} from "./utils/payrollPeriods.js";
import { supabase, supabaseConfigured } from "./lib/supabase.js";
import {
  clockInForShift,
  clockOutForShift,
  emptyWorkspace,
  loadPrivateSalaryVault,
  loadWorkspace,
  savePrivateSalaryVault,
  saveWorkspace,
} from "./lib/workspace.js";
import {
  clearLegacyPrivateFinancialData,
  extractPrivateFinancialAttendance,
  extractPrivateFinancialSettings,
  findPrivateFinancialConflicts,
  getLegacyPrivateFinancialData,
  hasLegacyPrivateFinancialData,
  localPrivateFinancialDefaults,
  mergeLocalPrivateAttendance,
  mergeLocalPrivateAttendanceRecord,
  mergePrivateFinancialData,
  serializeWorkspaceForCloud,
} from "./lib/privateFinancialData.js";
import {
  createSalaryVault,
  encryptSalaryVault,
  unlockSalaryVault,
} from "./lib/privateSalaryVault.js";

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

function isShiftClearable(record) {
  const hasAssignedShift =
    record.type === "Rest Day" ||
    record.hasAssignedShift === true ||
    Boolean(record.shiftStartTime && record.shiftEndTime);
  return hasAssignedShift;
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
      : "The Supabase request failed without an error message.";
  const code = typeof error?.code === "string" ? error.code : "";

  if (code === "PGRST205" || code === "42P01") {
    return `A required cloud table is missing in the configured Supabase project. Apply all migrations in supabase/migrations to the project used by VITE_SUPABASE_URL, then retry. (${code}: ${detail})`;
  }
  if (error?.name === "TypeError" && /fetch/i.test(detail)) {
    return `Could not reach the configured Supabase project. Check your connection and VITE_SUPABASE_URL, then retry. (${detail})`;
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

function getNightShiftMinutes(startTime, endTime) {
  const start = parseTimeMinutes(startTime);
  const endOfDay = parseTimeMinutes(endTime);
  if (start === null || endOfDay === null) return 0;
  const end = endOfDay <= start ? endOfDay + 1440 : endOfDay;
  let nightMinutes = 0;
  for (
    let day = Math.floor(start / 1440) - 1;
    day <= Math.floor(end / 1440);
    day += 1
  ) {
    const nightStart = day * 1440 + 22 * 60;
    const nightEnd = day * 1440 + 30 * 60;
    nightMinutes += Math.max(
      0,
      Math.min(end, nightEnd) - Math.max(start, nightStart),
    );
  }
  return nightMinutes;
}

function applyNightDifferential(record, percentage) {
  if (
    record.type === "Unassigned" ||
    record.type === "Absent" ||
    record.type === "Leave" ||
    record.type === "Rest Day" ||
    record.type === "Company Break"
  )
    return record;
  const baseAmount = getAmount(record.base);
  const nightHours =
    getNightShiftMinutes(record.workStartTime, record.workEndTime) / 60;
  const rate = Number(percentage);
  if (baseAmount <= 0 || nightHours <= 0 || !Number.isFinite(rate) || rate <= 0)
    return record;
  const premium = (baseAmount / 8) * nightHours * (rate / 100);
  const total =
    baseAmount + getAmount(record.ot) + premium + getAmount(record.penalty);
  return {
    ...record,
    ot: formatPayAmount(getAmount(record.ot) + premium),
    est: `${formatPayAmount(total)} PHP`,
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
  const [hourText, minute = "00"] = time.split(":");
  const value = Number(hourText);
  return `${String(value % 12 || 12).padStart(2, "0")}:${minute} ${value >= 12 ? "PM" : "AM"}`;
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
  record,
  shiftTemplates,
  selected,
  hasIncentive,
  onSelect,
}) {
  let cardStyle =
    "bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:border-teal-300";
  if (selected) {
    cardStyle =
      "bg-teal-50/60 border-2 border-teal-600 shadow-sm ring-2 ring-teal-500/25";
  } else if (record.type === "Rest Day") {
    cardStyle = "bg-slate-100/60 border border-slate-200/70 hover:bg-slate-100";
  } else if (record.type === "Leave") {
    const leaveCardStyles = {
      VL: "bg-amber-50/70 border border-amber-200 hover:border-amber-300",
      SL: "bg-sky-50/70 border border-sky-200 hover:border-sky-300",
      EL: "bg-rose-50/70 border border-rose-200 hover:border-rose-300",
    };
    cardStyle =
      leaveCardStyles[record.leaveCode] || "bg-sky-50/70 border border-sky-200";
  } else if (["Regular Holiday", "Unworked Holiday"].includes(record.type)) {
    cardStyle =
      "bg-white border border-rose-200 border-l-4 border-l-rose-500 hover:border-rose-300 shadow-xs";
  } else if (record.type === "Company Break") {
    cardStyle =
      "bg-emerald-50/70 border border-emerald-200 border-l-4 border-l-emerald-500 hover:border-emerald-300";
  } else if (["Special Holiday", "Special Non-Working"].includes(record.type)) {
    cardStyle =
      "bg-white border border-indigo-200 border-l-4 border-l-indigo-500 hover:border-indigo-300 shadow-xs";
  }
  const holidayCellStyles = {
    "Regular Holiday":
      "bg-white border border-rose-200 border-l-4 border-l-rose-500 hover:border-rose-300 shadow-xs",
    "Special Non-Working Day":
      "bg-white border border-indigo-200 border-l-4 border-l-indigo-500 hover:border-indigo-300 shadow-xs",
    "Special Working Day":
      "bg-white border border-teal-200 border-l-4 border-l-teal-500 hover:border-teal-300 shadow-xs",
    "Local Holiday":
      "bg-white border border-violet-200 border-l-4 border-l-violet-500 hover:border-violet-300 shadow-xs",
    "Ordinary Working Day":
      "bg-white border border-slate-200 border-l-4 border-l-slate-400 hover:border-slate-300 shadow-xs",
    "Company Break":
      "bg-emerald-50/70 border border-emerald-200 border-l-4 border-l-emerald-500 hover:border-emerald-300",
  };
  if (!selected && record.holidayClassification) {
    cardStyle = holidayCellStyles[record.holidayClassification] || cardStyle;
  }

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
  let label = null;
  if (record.holidayName) {
    label = (
      <div className="flex flex-col">
        <span
          className={`text-[10px] font-bold leading-tight ${holidayLabelColors[record.holidayClassification] || "text-indigo-700"}`}
        >
          {record.holidayName}
        </span>
        {record.holidayDutyLabel !== "Not Scheduled" && (
          <span
            className={`text-[9px] font-semibold mt-0.5 ${record.holidayUnworked ? "text-slate-600" : "text-slate-500"}`}
          >
            {record.holidayDutyLabel}
          </span>
        )}
      </div>
    );
  } else if (record.type === "Absent") {
    label = (
      <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 rounded inline-block w-fit">
        Absent
      </span>
    );
  } else if (record.type === "Leave") {
    const leaveLabelStyles = {
      VL: "bg-amber-100 text-amber-800",
      SL: "bg-sky-100 text-sky-800",
      EL: "bg-rose-100 text-rose-800",
    };
    label = (
      <span
        className={`inline-flex w-fit max-w-full items-center gap-1.5 truncate rounded px-2 py-0.5 text-[10px] font-bold ${leaveLabelStyles[record.leaveCode] || "bg-sky-100 text-sky-800"}`}
      >
        <i
          className={`fa-solid ${record.leaveIcon || "fa-umbrella-beach"} shrink-0`}
          aria-hidden="true"
        />
        <span className="truncate">{record.shift}</span>
      </span>
    );
  } else if (record.type === "Rest Day") {
    label = (
      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 rounded inline-block w-fit">
        Rest Day
      </span>
    );
  } else if (record.customIcon) {
    label = (
      <div className="flex items-center space-x-1.5">
        <i
          className={`fa-solid ${record.customIcon} ${record.customIconColor || "text-teal-600"} text-xs`}
        />
        <span className="text-[10px] font-bold text-slate-700 truncate">
          {calendarShiftName}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`${formatDate(year, monthIndex, day)}: ${record.holidayName ? `${record.holidayName}, ${record.holidayClassification}, ` : ""}${record.type === "Absent" && record.holidayName ? "Unworked Holiday" : calendarShiftName}${hasIncentive ? ", incentive recorded" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
      title={hasIncentive ? "Incentive recorded" : undefined}
      className={`rounded-xl min-h-[90px] flex flex-col transition cursor-pointer relative box-border text-left ${cardStyle}`}
    >
      <span className="p-2.5 flex flex-col justify-between h-full w-full">
        <span className="flex justify-between items-center">
          <span
            className={`text-xs font-bold ${selected ? "text-teal-900" : "text-slate-700"}`}
          >
            {day}
          </span>
          <span className="flex items-center gap-1">
            {record.clockedIn && (
              <span className="text-[9px] font-bold text-amber-700">
                Tracking
              </span>
            )}
            {hasIncentive && (
              <i
                className="fa-solid fa-gift text-[10px] text-teal-600"
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
        <span className="my-auto py-1 flex flex-col justify-center">
          {label}
        </span>
        {record.type !== "Rest Day" && record.assigned !== "Rest Day" && (
          <span className="text-[10px] text-slate-500 font-medium">
            {record.type === "Unassigned" && record.holidayName
              ? "Not Scheduled"
              : record.assigned}
          </span>
        )}
      </span>
    </button>
  );
}

export default function App() {
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspaceLoadedForUser, setWorkspaceLoadedForUser] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceSaveError, setWorkspaceSaveError] = useState("");
  const [salaryVaultStatus, setSalaryVaultStatus] = useState("loading");
  const [salaryVaultError, setSalaryVaultError] = useState("");
  const [salaryVaultConflict, setSalaryVaultConflict] = useState(false);
  const [salaryVaultRecord, setSalaryVaultRecord] = useState(null);
  const [salaryVaultSyncing, setSalaryVaultSyncing] = useState(false);
  const [historicalPayslips, setHistoricalPayslips] = useState([]);
  const [activeHistoricalPayslip, setActiveHistoricalPayslip] = useState(null);
  const [payslipHistorySaving, setPayslipHistorySaving] = useState(false);
  const [workspaceLoadAttempt, setWorkspaceLoadAttempt] = useState(0);
  const [saveRequest, setSaveRequest] = useState(0);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [accountDeletionLoading, setAccountDeletionLoading] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
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
  const [financeTrackingScope, setFinanceTrackingScope] = useState("cutoff-10");
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
  const [salaryVaultExtraSettings, setSalaryVaultExtraSettings] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    () => getManilaDateTime().date,
  );
  const [expenseCategory, setExpenseCategory] = useState("Utilities");
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
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
  const [customShiftName, setCustomShiftName] = useState("");
  const [customShiftStart, setCustomShiftStart] = useState("22:00");
  const [customShiftEnd, setCustomShiftEnd] = useState("06:00");
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
  const userRef = useRef(null);
  const pendingSuccessToasts = useRef([]);
  const pendingExpenseClearRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const workspaceRevisionRef = useRef(0);
  const salaryVaultKeyRef = useRef(null);
  const salaryVaultPayslipsRef = useRef([]);
  const salaryVaultRevisionRef = useRef(0);
  const salaryVaultQueueRef = useRef(Promise.resolve());
  const salaryVaultSkipNextSyncRef = useRef(false);
  const preserveLegacyLocalRef = useRef(false);
  const salaryVaultSyncTimerRef = useRef(null);

  const employeeIncentives = Array.isArray(
    salaryVaultExtraSettings.employeeIncentives,
  )
    ? salaryVaultExtraSettings.employeeIncentives
    : [];
  const availableEmployeeIncentives =
    salaryVaultStatus === "unlocked" ? employeeIncentives : [];
  const selectedDate = formatDate(year, monthIndex, selectedDay);
  const monthLabel = `${months[monthIndex]} ${year}`;
  const calendarPayrollMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
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
    isShiftClearable(selectedAttendanceRecord) &&
    activeTimeEntry?.date !== selectedDate;
  const getPayrollRecordBreakdown = useCallback(
    (record, date) => {
      const recordedOvertimeAmount = Number(record.overtimeAmount);
      const overtimeAmount = Number.isFinite(recordedOvertimeAmount)
        ? recordedOvertimeAmount
        : 0;
      const lateMinutes = Number(record.lateMinutes);
      const undertimeMinutes = Number(record.undertimeMinutes);
      const timingValues = {
        lateMinutes: Number.isFinite(lateMinutes) ? lateMinutes : 0,
        undertimeMinutes: Number.isFinite(undertimeMinutes)
          ? undertimeMinutes
          : 0,
      };
      if (record.type === "Leave") {
        const leaveEarnings = getAmount(record.est);
        return {
          ...timingValues,
          [record.leaveCode === "SL" ? "paidSickLeave" : "otherPaidLeave"]:
            leaveEarnings,
        };
      }

      const holiday = getHolidayForDate(holidays, date, selectedLocality);
      const hoursWorked = getAttendanceHours(record) || 0;
      const hasAssignedShift =
        record.type === "Rest Day" ||
        record.hasAssignedShift === true ||
        Boolean(record.shiftStartTime && record.shiftEndTime);
      const nightHours =
        getNightShiftMinutes(record.workStartTime, record.workEndTime) / 60;
      const applicableDailyWage = holiday
        ? Number(dailyWage)
        : getAmount(record.base);
      const rate = Number(nightDifferential);
      const nightDifferentialPay =
        Number.isFinite(applicableDailyWage) &&
        applicableDailyWage > 0 &&
        Number.isFinite(rate) &&
        rate > 0 &&
        nightHours > 0
          ? (applicableDailyWage / 8) * nightHours * (rate / 100)
          : 0;
      const allowanceAmount = Number(dailyAllowance);
      const hasDailyAllowance =
        Number.isFinite(allowanceAmount) && allowanceAmount >= 0;

      if (holiday) {
        const holidayPay = calculateHolidayPay({
          holiday: {
            ...holiday,
            classification: getHolidayClassification(holiday),
          },
          dailyWage: Number(dailyWage),
          hoursWorked,
          hasSchedule: hasAssignedShift,
          isRestDay: record.type === "Rest Day",
          eligibilityKnown: holidayEligibilityConfirmed,
          worked: hasValidAttendanceRecord(record) && !record.clockedIn,
          unworked: record.holidayUnworked || record.type === "Absent",
          overtimeMultiplier: Number(overtimeMultiplier),
        });
        if (
          !hasAssignedShift ||
          holidayPay.amount == null ||
          !hasDailyAllowance
        )
          return null;
        const classification = getHolidayClassification(holiday);
        const holidayRegularPay = Number.isFinite(holidayPay.regularPay)
          ? holidayPay.regularPay
          : Math.max(0, holidayPay.amount - (holidayPay.overtimePay || 0));
        const holidayOvertimePay =
          (Number(holidayPay.overtimePay) || 0) + overtimeAmount;
        const holidayEarningsKey =
          classification === "Regular Holiday"
            ? "regularHoliday"
            : classification === "Special Non-Working Day"
              ? "specialHoliday"
              : "basicPay";
        return {
          ...timingValues,
          [holidayEarningsKey]: holidayRegularPay,
          allowance: allowanceAmount,
          shiftDifferentials: nightDifferentialPay,
          overtime: holidayOvertimePay,
          overtimeMinutes: Math.max(
            Number(record.overtimeMinutes) || 0,
            (Number(holidayPay.overtimeHours) || 0) * 60,
          ),
          overtimeHours: Number(holidayPay.overtimeHours) || 0,
        };
      }

      if (
        !hasAssignedShift ||
        !["Regular", "Official Business"].includes(record.type) ||
        !hasDailyAllowance
      )
        return null;

      return {
        ...timingValues,
        basicPay: Math.max(0, getAmount(record.est) - overtimeAmount),
        allowance: allowanceAmount,
        shiftDifferentials: nightDifferentialPay,
        overtime: overtimeAmount,
        overtimeMinutes: Number(record.overtimeMinutes) || 0,
      };
    },
    [
      dailyAllowance,
      dailyWage,
      holidayEligibilityConfirmed,
      holidays,
      nightDifferential,
      overtimeMultiplier,
      selectedLocality,
    ],
  );
  const getPayrollRecordEarnings = useCallback(
    (record, date) => {
      const breakdown = getPayrollRecordBreakdown(record, date);
      if (!breakdown) return null;
      return [
        "basicPay",
        "allowance",
        "shiftDifferentials",
        "regularHoliday",
        "specialHoliday",
        "overtime",
      ].reduce((total, key) => total + (Number(breakdown[key]) || 0), 0);
    },
    [getPayrollRecordBreakdown],
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
    () => getPayrollDeductionSettingsDefaults(salaryVaultExtraSettings),
    [salaryVaultExtraSettings],
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
    if (payslipPeriodMode === "month") {
      return getCalendarPayrollPeriod(payslipMonth);
    }
    return getPayrollPeriodForMonth(
      payslipMonth,
      payslipPeriodMode === "first" ? 10 : 25,
    );
  }, [payslipMonth, payslipPeriodMode]);
  const selectedPayslipSummary = useMemo(
    () => summarizePayrollPeriod(
      attendance,
      selectedPayslipPeriod,
      getPayrollRecordEarnings,
      availableEmployeeIncentives,
    ),
    [attendance, availableEmployeeIncentives, getPayrollRecordEarnings, selectedPayslipPeriod],
  );
  const selectedPayslipBreakdown = useMemo(
    () => summarizePayrollEarningsBreakdown(
      attendance,
      selectedPayslipPeriod,
      getPayrollRecordBreakdown,
      availableEmployeeIncentives,
    ),
    [attendance, availableEmployeeIncentives, getPayrollRecordBreakdown, selectedPayslipPeriod],
  );
  const calendarMonthGross = useMemo(
    () => summarizePayrollPeriod(
      attendance,
      getCalendarPayrollPeriod(payslipMonth),
      getPayrollRecordEarnings,
      availableEmployeeIncentives,
    ).recordedEarnings,
    [attendance, availableEmployeeIncentives, getPayrollRecordEarnings, payslipMonth],
  );
  const selectedPayslipDeductions = useMemo(() => {
    const calculateDeductions = (period, monthlyGrossPay) =>
      calculateCutoffPayrollDeductions({
        period,
        mode: payrollDeductionSettings.payrollDeductionMode,
        monthlyGrossPay,
        manualPerPaycheck: {
          sss: payrollDeductionSettings.manualSssPerPaycheck,
          philHealth: payrollDeductionSettings.manualPhilHealthPerPaycheck,
          pagIbig: payrollDeductionSettings.manualPagIbigPerPaycheck,
        },
        settings: payrollDeductionSettings,
      });
    if (payslipPeriodMode === "month") {
      return sumCutoffPayrollDeductions(
        calculateDeductions(getPayrollPeriodForMonth(payslipMonth, 10), calendarMonthGross),
        calculateDeductions(getPayrollPeriodForMonth(payslipMonth, 25), calendarMonthGross),
      );
    }
    return calculateDeductions(selectedPayslipPeriod, payrollPeriodMonthGross);
  }, [
    calendarMonthGross,
    payrollDeductionSettings,
    payrollPeriodMonthGross,
    payslipMonth,
    payslipPeriodMode,
    selectedPayslipPeriod,
  ]);
  const selectedPayslipNetPay =
    selectedPayslipSummary.recordedEarnings -
    selectedPayslipDeductions.total;
  const selectedWorkedHours = hasValidAttendanceRecord(selectedAttendanceRecord)
    ? getAttendanceHours(selectedAttendanceRecord)
    : 0;
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
          dailyWage: Number(dailyWage),
          hoursWorked: getAttendanceHours(selectedAttendanceRecord),
          hasSchedule:
            selectedAttendanceRecord.type === "Rest Day" ||
            (selectedAttendanceRecord.hasAssignedShift === true &&
              Boolean(
                selectedAttendanceRecord.shiftStartTime &&
                selectedAttendanceRecord.shiftEndTime,
              )),
          isRestDay: selectedAttendanceRecord.type === "Rest Day",
          eligibilityKnown: holidayEligibilityConfirmed,
          worked:
            hasValidAttendanceRecord(selectedAttendanceRecord) &&
            !selectedAttendanceRecord.clockedIn,
          unworked:
            selectedAttendanceRecord.holidayUnworked ||
            selectedAttendanceRecord.type === "Absent",
          overtimeMultiplier: Number(overtimeMultiplier),
        })
    : null;
  const selectedNightDifferentialPay = (() => {
    const applicableDailyWage = selectedHoliday
      ? Number(dailyWage)
      : getAmount(selectedAttendanceRecord.base);
    const rate = Number(nightDifferential);
    const nightHours =
      getNightShiftMinutes(
        selectedAttendanceRecord.workStartTime,
        selectedAttendanceRecord.workEndTime,
      ) / 60;
    if (
      selectedAttendanceRecord.clockedIn ||
      !hasValidAttendanceRecord(selectedAttendanceRecord) ||
      !Number.isFinite(applicableDailyWage) ||
      applicableDailyWage <= 0 ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      nightHours <= 0
    )
      return null;
    return (applicableDailyWage / 8) * nightHours * (rate / 100);
  })();
  const selectedOvertimePay = selectedHoliday
    ? selectedHolidayPay?.overtimePay != null
      ? selectedHolidayPay.overtimePay +
        (selectedAttendanceRecord.overtimeAmount || 0)
      : null
    : Number.isFinite(selectedAttendanceRecord.overtimeAmount)
      ? selectedAttendanceRecord.overtimeAmount
      : null;
  const selectedOvertimeCalculation = (() => {
    const multiplier = Number(overtimeMultiplier);
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
      const hourlyRate =
        getAmount(selectedAttendanceRecord.base) / scheduledHours;
      return `${formatDuration(selectedAttendanceRecord.overtimeMinutes)} × ₱${hourlyRate.toFixed(2)}/hr × ${multiplier}x`;
    }
    if (selectedHolidayPay?.overtimeHours > 0) {
      const holidayMultiplier = selectedHolidayPay.multiplier || 1;
      const hourlyRate = (Number(dailyWage) / 8) * holidayMultiplier;
      return `${selectedHolidayPay.overtimeHours}h × ₱${hourlyRate.toFixed(2)}/hr × ${multiplier}x`;
    }
    return `Hourly rate × OT hours × ${multiplier}x`;
  })();
  const allowanceAmount = Number(dailyAllowance);
  const hasDailyAllowance =
    Number.isFinite(allowanceAmount) && allowanceAmount >= 0;
  const hasAssignedShift =
    selectedAttendanceRecord.type === "Rest Day" ||
    selectedAttendanceRecord.hasAssignedShift === true ||
    Boolean(
      selectedAttendanceRecord.shiftStartTime &&
      selectedAttendanceRecord.shiftEndTime,
    );
  const isSelectedDateAbsent = selectedRecord.type === "Absent";
  const selectedDateIncentives = getIncentivesForDate(
    availableEmployeeIncentives,
    selectedDate,
  );
  const selectedDailyIncentiveTotal = getIncentiveTotal(
    selectedDateIncentives,
  );
  const selectedBaseEstimatedEarnings = selectedHoliday
    ? hasAssignedShift &&
      selectedHolidayPay?.amount != null &&
      hasDailyAllowance
      ? selectedHolidayPay.amount +
        (selectedAttendanceRecord.overtimeAmount || 0) +
        (selectedNightDifferentialPay || 0) +
        (isSelectedDateAbsent ? 0 : allowanceAmount)
      : null
    : hasAssignedShift &&
        selectedRecord.type !== "Absent" &&
        ["Regular", "Official Business"].includes(
          selectedAttendanceRecord.type,
        ) &&
        hasDailyAllowance
      ? getAmount(selectedAttendanceRecord.est) +
        allowanceAmount +
        (selectedNightDifferentialPay || 0)
      : null;
  const selectedEstimatedEarnings =
    selectedBaseEstimatedEarnings === null
      ? selectedDailyIncentiveTotal > 0
        ? selectedDailyIncentiveTotal
        : null
      : selectedBaseEstimatedEarnings + selectedDailyIncentiveTotal;
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
  const { canTimeIn, canTimeOut } = punchAvailability;
  const selectedRecordWithNightDifferential = applyNightDifferential(
    selectedRecord,
    nightDifferential,
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
          authSession.user.user_metadata?.full_name ||
          authSession.user.email?.split("@")[0] ||
          "TimeCloud user",
      }
    : null;
  const currentMonthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  const grossPay = Object.entries(attendance)
    .filter(([date]) => date.startsWith(currentMonthPrefix))
    .reduce((sum, [, record]) => {
      if (record.clockedIn) return sum;
      if (record.type === "Leave") return sum + getAmount(record.est);
      return hasValidAttendanceRecord(record)
        ? sum + getAmount(record.est)
        : sum;
    }, 0);
  const grossPayWithIncentives =
    grossPay +
    getIncentiveTotal(
      getIncentivesForPeriod(
        availableEmployeeIncentives,
        getCalendarPayrollPeriod(calendarPayrollMonth),
      ),
    );
  const payrollDeductions = sumCutoffPayrollDeductions(
    ...[10, 25].map((cutoffDay) =>
      calculateCutoffPayrollDeductions({
        period: getPayrollPeriodForMonth(calendarPayrollMonth, cutoffDay),
        mode: payrollDeductionSettings.payrollDeductionMode,
        monthlyGrossPay: grossPayWithIncentives,
        manualPerPaycheck: {
          sss: payrollDeductionSettings.manualSssPerPaycheck,
          philHealth: payrollDeductionSettings.manualPhilHealthPerPaycheck,
          pagIbig: payrollDeductionSettings.manualPagIbigPerPaycheck,
        },
        settings: payrollDeductionSettings,
      }),
    ),
  );
  const netPay = Math.max(0, grossPayWithIncentives - payrollDeductions.total);
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
    () =>
      [10, 25].map((cutoffDay) =>
        getPayrollPeriodForMonth(calendarPayrollMonth, cutoffDay),
      ),
    [calendarPayrollMonth],
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
      financeCutoffPeriods.map((period) =>
        calculateCutoffPayrollDeductions({
          period,
          mode: payrollDeductionSettings.payrollDeductionMode,
          monthlyGrossPay: financeCutoffMonthlyGross,
          manualPerPaycheck: {
            sss: payrollDeductionSettings.manualSssPerPaycheck,
            philHealth: payrollDeductionSettings.manualPhilHealthPerPaycheck,
            pagIbig: payrollDeductionSettings.manualPagIbigPerPaycheck,
          },
          settings: payrollDeductionSettings,
        }),
      ),
    [financeCutoffMonthlyGross, financeCutoffPeriods, payrollDeductionSettings],
  );
  const selectedFinanceCutoffIndex =
    financeTrackingScope === "cutoff-25" ? 1 : 0;
  const selectedFinancePeriod =
    financeCutoffPeriods[selectedFinanceCutoffIndex];
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
      ? grossPayWithIncentives
      : financeCutoffSummaries[selectedFinanceCutoffIndex].recordedEarnings;
  const financePayrollDeductions =
    financeTrackingScope === "month"
      ? payrollDeductions
      : financeCutoffDeductions[selectedFinanceCutoffIndex];
  const financeNetPay = Math.max(
    0,
    financeGrossPay - financePayrollDeductions.total,
  );
  const financeTotalHours =
    financeTrackingScope === "month"
      ? totalHours
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

  const persistPrivateSalaryVault = useCallback(
    (payload) => {
      const vaultKey = salaryVaultKeyRef.current;
      if (!user?.id || !vaultKey) {
        return Promise.reject(
          new Error(
            "Unlock the encrypted salary vault before syncing salary data.",
          ),
        );
      }

      const operation = salaryVaultQueueRef.current.then(async () => {
        if (userRef.current !== user.id) {
          throw new Error(
            "The signed-in account changed before the encrypted salary vault could be saved.",
          );
        }
        const encryptedRecord = await encryptSalaryVault(
          {
            ...payload,
            payslips: payload.payslips ?? salaryVaultPayslipsRef.current,
          },
          vaultKey.key,
          vaultKey.salt,
        );
        if (userRef.current !== user.id) {
          throw new Error(
            "The signed-in account changed before the encrypted salary vault could be saved.",
          );
        }
        const revision = await savePrivateSalaryVault(
          encryptedRecord,
          salaryVaultRevisionRef.current,
          user.id,
        );
        if (userRef.current === user.id) {
          salaryVaultRevisionRef.current = revision;
          setSalaryVaultRecord({
            ...encryptedRecord,
            revision,
            updated_at: new Date().toISOString(),
          });
          if (!preserveLegacyLocalRef.current) {
            try {
              clearLegacyPrivateFinancialData(user.id);
              setSalaryVaultError("");
            } catch {
              setSalaryVaultError(
                "Vault saved, but the prior unencrypted browser copy could not be removed. Keep this browser secure and retry cleanup.",
              );
            }
            setSalaryVaultConflict(false);
          }
        }
        return revision;
      });
      salaryVaultQueueRef.current = operation.catch((error) => {
        if (userRef.current === user.id && error?.code === "40001") {
          setSalaryVaultConflict(true);
        }
      });
      return operation;
    },
    [user?.id],
  );

  const unlockOrCreateSalaryVault = useCallback(
    async (passphrase, confirmation) => {
      if (!user?.id)
        throw new Error("Sign in before unlocking the salary vault.");

      if (!salaryVaultRecord) {
        if (passphrase !== confirmation) {
          throw new Error("The vault passphrases do not match.");
        }
        const payload = {
          settings: {
            ...salaryVaultExtraSettings,
            dailyWage,
            dailyAllowance,
            overtimeMultiplier,
            nightDifferential,
          },
          attendance: extractPrivateFinancialAttendance(attendance),
          payslips: [],
        };
        const { record, key } = await createSalaryVault(payload, passphrase);
        const revision = await savePrivateSalaryVault(record, 0, user.id);
        let localCopyRemains = hasLegacyPrivateFinancialData(user.id);
        salaryVaultKeyRef.current = {
          key,
          salt: Uint8Array.from(atob(record.salt), (character) =>
            character.charCodeAt(0),
          ),
        };
        salaryVaultRevisionRef.current = revision;
        salaryVaultPayslipsRef.current = [];
        setHistoricalPayslips([]);
        setSalaryVaultRecord({
          ...record,
          revision,
          updated_at: new Date().toISOString(),
        });
        try {
          clearLegacyPrivateFinancialData(user.id);
          localCopyRemains = false;
        } catch {
          setSalaryVaultError(
            "Vault created, but the prior unencrypted browser copy could not be removed. Keep this browser secure and retry cleanup.",
          );
        }
        preserveLegacyLocalRef.current = localCopyRemains;
        salaryVaultSkipNextSyncRef.current = true;
        setSalaryVaultStatus("unlocked");
        if (!localCopyRemains) setSalaryVaultError("");
        setSalaryVaultConflict(false);
        return { settings: payload.settings };
      }

      const unlocked = await unlockSalaryVault(salaryVaultRecord, passphrase);
      let payload = unlocked.payload;
      let revision = salaryVaultRecord.revision;
      let localCopyRemains = hasLegacyPrivateFinancialData(user.id);
      if (localCopyRemains) {
        const legacyLocalData = getLegacyPrivateFinancialData(user.id, null);
        const conflicts = findPrivateFinancialConflicts(
          legacyLocalData,
          payload,
        );
        if (conflicts.length > 0) {
          setSalaryVaultError(
            "This browser has older local salary values that differ from the cloud vault. The cloud copy was not overwritten and the local copy was preserved; export or reconcile it before removing browser data.",
          );
        } else {
          payload = {
            ...mergePrivateFinancialData(legacyLocalData, payload),
            payslips: payload.payslips || [],
          };
          const encryptedRecord = await encryptSalaryVault(
            payload,
            unlocked.key,
            unlocked.salt,
          );
          revision = await savePrivateSalaryVault(
            encryptedRecord,
            revision,
            user.id,
          );
          setSalaryVaultRecord({
            ...encryptedRecord,
            revision,
            updated_at: new Date().toISOString(),
          });
          try {
            clearLegacyPrivateFinancialData(user.id);
            localCopyRemains = false;
          } catch {
            setSalaryVaultError(
              "Vault synced, but the prior unencrypted browser copy could not be removed. Keep this browser secure and retry cleanup.",
            );
          }
        }
      }
      preserveLegacyLocalRef.current = localCopyRemains;

      salaryVaultKeyRef.current = { key: unlocked.key, salt: unlocked.salt };
      salaryVaultRevisionRef.current = revision;
      salaryVaultPayslipsRef.current = payload.payslips || [];
      setHistoricalPayslips(payload.payslips || []);
      setActiveHistoricalPayslip(null);
      setDailyWage(payload.settings.dailyWage);
      setDailyAllowance(payload.settings.dailyAllowance);
      setOvertimeMultiplier(payload.settings.overtimeMultiplier);
      setNightDifferential(payload.settings.nightDifferential);
      setSalaryVaultExtraSettings(
        extractPrivateFinancialSettings(payload.settings),
      );
      setAttendance((current) =>
        mergeLocalPrivateAttendance(current, payload.attendance),
      );
      salaryVaultSkipNextSyncRef.current = true;
      setSalaryVaultStatus("unlocked");
      if (!localCopyRemains) setSalaryVaultError("");
      setSalaryVaultConflict(false);
      return { settings: payload.settings };
    },
    [
      user?.id,
      salaryVaultRecord,
      dailyWage,
      dailyAllowance,
      overtimeMultiplier,
      nightDifferential,
      salaryVaultExtraSettings,
      attendance,
    ],
  );

  const rotateSalaryVaultPassphrase = useCallback(
    async (nextPassphrase, confirmation) => {
      if (nextPassphrase !== confirmation) {
        throw new Error("The new vault passphrases do not match.");
      }
      if (
        salaryVaultStatus !== "unlocked" ||
        !salaryVaultRecord ||
        !salaryVaultKeyRef.current
      ) {
        throw new Error(
          "Unlock the salary vault before changing its passphrase.",
        );
      }
      const payload = {
        settings: {
          ...salaryVaultExtraSettings,
          dailyWage,
          dailyAllowance,
          overtimeMultiplier,
          nightDifferential,
        },
        attendance: extractPrivateFinancialAttendance(attendance),
        payslips: salaryVaultPayslipsRef.current,
      };
      await persistPrivateSalaryVault(payload);
      const nextVersion = salaryVaultRecord.key_version + 1;
      const { record, key } = await createSalaryVault(
        payload,
        nextPassphrase,
        nextVersion,
      );
      const revision = await savePrivateSalaryVault(
        record,
        salaryVaultRevisionRef.current,
        user.id,
      );
      salaryVaultKeyRef.current = {
        key,
        salt: Uint8Array.from(atob(record.salt), (character) =>
          character.charCodeAt(0),
        ),
      };
      salaryVaultRevisionRef.current = revision;
      setSalaryVaultRecord({
        ...record,
        revision,
        updated_at: new Date().toISOString(),
      });
      setSalaryVaultError("");
    },
    [
      salaryVaultStatus,
      salaryVaultRecord,
      dailyWage,
      dailyAllowance,
      overtimeMultiplier,
      nightDifferential,
      salaryVaultExtraSettings,
      attendance,
      persistPrivateSalaryVault,
      user?.id,
    ],
  );

  const reloadSalaryVault = useCallback(async () => {
    if (!user?.id) return;
    const confirmed = window.confirm(
      "Reload the encrypted cloud vault? Any salary changes in this browser that were not saved will be discarded. Export them first if you need to keep them.",
    );
    if (!confirmed) return;
    setSalaryVaultSyncing(true);
    try {
      const latestVault = await loadPrivateSalaryVault(user.id);
      if (!latestVault) {
        throw new Error(
          "No encrypted salary vault was found for this account.",
        );
      }
      salaryVaultKeyRef.current = null;
      salaryVaultPayslipsRef.current = [];
      setHistoricalPayslips([]);
      setActiveHistoricalPayslip(null);
      salaryVaultRevisionRef.current = latestVault.revision;
      setSalaryVaultRecord(latestVault);
      setSalaryVaultStatus("locked");
      setDailyWage("");
      setDailyAllowance(localPrivateFinancialDefaults.dailyAllowance);
      setOvertimeMultiplier(localPrivateFinancialDefaults.overtimeMultiplier);
      setNightDifferential(localPrivateFinancialDefaults.nightDifferential);
      setSalaryVaultExtraSettings({});
      setAttendance(
        (current) =>
          serializeWorkspaceForCloud({ attendance: current }).attendance,
      );
      setSalaryVaultConflict(false);
      setSalaryVaultError("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to reload the encrypted salary vault.";
      setSalaryVaultError(message);
      addToast(message, "error");
    } finally {
      setSalaryVaultSyncing(false);
    }
  }, [user?.id, addToast]);

  const lockSalaryVault = useCallback(async () => {
    window.clearTimeout(salaryVaultSyncTimerRef.current);
    try {
      await persistPrivateSalaryVault({
        settings: {
          ...salaryVaultExtraSettings,
          dailyWage,
          dailyAllowance,
          overtimeMultiplier,
          nightDifferential,
        },
        attendance: extractPrivateFinancialAttendance(attendance),
      });
    } catch (error) {
      const message =
        error?.code === "40001"
          ? "Encrypted salary data changed on another device. Reload the vault before locking."
          : "Encrypted salary data could not be saved. The vault remains unlocked so you can retry.";
      setSalaryVaultError(message);
      addToast(message, "error");
      return false;
    }
    salaryVaultKeyRef.current = null;
    salaryVaultPayslipsRef.current = [];
    setHistoricalPayslips([]);
    setActiveHistoricalPayslip(null);
    setSalaryVaultStatus(salaryVaultRecord ? "locked" : "uninitialized");
    setDailyWage("");
    setDailyAllowance(localPrivateFinancialDefaults.dailyAllowance);
    setOvertimeMultiplier(localPrivateFinancialDefaults.overtimeMultiplier);
    setNightDifferential(localPrivateFinancialDefaults.nightDifferential);
    setSalaryVaultExtraSettings({});
    setAttendance(
      (current) =>
        serializeWorkspaceForCloud({ attendance: current }).attendance,
    );
    return true;
  }, [
    salaryVaultRecord,
    dailyWage,
    dailyAllowance,
    overtimeMultiplier,
    nightDifferential,
    salaryVaultExtraSettings,
    attendance,
    persistPrivateSalaryVault,
    addToast,
  ]);

  const dismissToast = useCallback((id) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthSession(session);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (event === "SIGNED_OUT") setRecoveryMode(false);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error)
        addToast(
          "Unable to restore the sign-in session. Please sign in again.",
          "warning",
        );
      setAuthSession(data.session);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [addToast]);

  useEffect(() => {
    if (!user?.id || !supabase) return undefined;

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
    const lastSignInAt = Date.parse(authSession?.user?.last_sign_in_at || "");
    lastActivityAt =
      storedActivityAt ||
      (Number.isFinite(lastSignInAt) ? lastSignInAt : Date.now());
    lastPersistedActivityAt = storedActivityAt || 0;

    const expireSession = () => {
      if (signOutStarted) return;
      signOutStarted = true;
      if (expirationTimer !== null) window.clearInterval(expirationTimer);
      supabase.auth
        .signOut({ scope: "local" })
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

    const handlePageHide = (event) => {
      if (event.persisted) return;
      supabase.auth
        .signOut({ scope: "local" })
        .then(({ error }) => {
          if (error)
            console.warn(
              "Could not clear the local session while closing the page:",
              error,
            );
        })
        .catch((error) => {
          console.warn(
            "Could not clear the local session while closing the page:",
            error,
          );
        });
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
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", checkExpiration);

    return () => {
      window.clearInterval(expirationTimer);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, handleActivity),
      );
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", checkExpiration);
      if (!signOutStarted) {
        try {
          window.localStorage.removeItem(activityKey);
        } catch (error) {
          warnStorageFailure(error);
        }
      }
    };
  }, [user?.id, authSession?.user?.last_sign_in_at, addToast]);

  useEffect(() => {
    if (!user?.id) {
      userRef.current = null;
      workspaceLoadedRef.current = false;
      workspaceRevisionRef.current = 0;
      salaryVaultKeyRef.current = null;
      salaryVaultPayslipsRef.current = [];
      setHistoricalPayslips([]);
      setActiveHistoricalPayslip(null);
      salaryVaultRevisionRef.current = 0;
      salaryVaultSkipNextSyncRef.current = false;
      preserveLegacyLocalRef.current = false;
      setSalaryVaultStatus("loading");
      setSalaryVaultRecord(null);
      setSalaryVaultError("");
      setSalaryVaultConflict(false);
      setSalaryVaultSyncing(false);
      setWorkspaceLoadedForUser(null);
      setWorkspaceLoading(false);
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
      setShiftTemplates(defaultShiftTemplates);
      setSelectedShiftTemplate("rest-day");
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
    setWorkspaceLoadedForUser(null);
    setWorkspaceLoading(true);
    setWorkspaceError("");

    loadWorkspace(user.id)
      .then(
        ({
          workspace,
          revision,
          legacyPrivateFinancialData,
          salaryVault,
          salaryVaultTableAvailable,
        }) => {
          if (!active) return;
          let localPrivateData;
          try {
            localPrivateData = getLegacyPrivateFinancialData(
              user.id,
              legacyPrivateFinancialData,
            );
          } catch (privateDataError) {
            const detail =
              privateDataError instanceof Error
                ? privateDataError.message
                : "Browser storage is unavailable.";
            setWorkspaceError(
              `Private salary settings could not be preserved in this browser. ${detail}`,
            );
            setWorkspaceLoading(false);
            return;
          }
          salaryVaultKeyRef.current = null;
          salaryVaultRevisionRef.current = salaryVault?.revision ?? 0;
          setSalaryVaultRecord(salaryVault);
          setSalaryVaultStatus(
            !salaryVaultTableAvailable
              ? "unavailable"
              : salaryVault
                ? "locked"
                : "uninitialized",
          );
          setSalaryVaultError(
            !salaryVaultTableAvailable
              ? "Apply the pending Supabase migration to enable encrypted salary sync. Other workspace data remains available."
              : "",
          );
          setSalaryVaultConflict(false);
          const attendance = Object.fromEntries(
            Object.entries(
              mergeLocalPrivateAttendance(
                workspace.attendance,
                salaryVault ? {} : localPrivateData.attendance,
              ),
            ).map(([date, record]) => [
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
          const activePunch = Object.entries(attendance).find(
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
          setDailyWage(salaryVault ? "" : localPrivateData.settings.dailyWage);
          setDailyAllowance(
            salaryVault
              ? localPrivateFinancialDefaults.dailyAllowance
              : localPrivateData.settings.dailyAllowance,
          );
          setOvertimeMultiplier(
            salaryVault
              ? localPrivateFinancialDefaults.overtimeMultiplier
              : localPrivateData.settings.overtimeMultiplier,
          );
          setExpenses(workspace.expenses);
          setShiftTemplates(workspace.shiftTemplates || defaultShiftTemplates);
          setLeaveBalances(workspace.leaveBalances);
          setSettingsBalances(workspace.settingsBalances);
          setNightDifferential(
            salaryVault
              ? localPrivateFinancialDefaults.nightDifferential
              : localPrivateData.settings.nightDifferential,
          );
          setSalaryVaultExtraSettings(
            extractPrivateFinancialSettings(
              salaryVault ? {} : localPrivateData.settings,
            ),
          );
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
  }, [user?.id, workspaceLoadAttempt]);

  useEffect(() => {
    if (
      !user?.id ||
      workspaceLoadedForUser !== user.id ||
      !workspaceLoadedRef.current ||
      salaryVaultStatus !== "unlocked" ||
      !salaryVaultKeyRef.current
    )
      return;
    if (salaryVaultSkipNextSyncRef.current) {
      salaryVaultSkipNextSyncRef.current = false;
      return;
    }
    const payload = {
      settings: {
        ...salaryVaultExtraSettings,
        dailyWage,
        dailyAllowance,
        overtimeMultiplier,
        nightDifferential,
      },
      attendance: extractPrivateFinancialAttendance(attendance),
    };
    salaryVaultSyncTimerRef.current = window.setTimeout(() => {
      salaryVaultSyncTimerRef.current = null;
      setSalaryVaultSyncing(true);
      persistPrivateSalaryVault(payload)
        .then(() => {
          setSalaryVaultSyncing(false);
        })
        .catch((error) => {
          setSalaryVaultSyncing(false);
          const conflict = error?.code === "40001";
          const message = conflict
            ? "Encrypted salary data changed on another device. Lock and unlock the vault again before retrying."
            : "Encrypted salary data could not be saved to Supabase. Your changes remain in memory; retry after checking your connection.";
          setSalaryVaultError(message);
          addToast(message, "error");
        });
    }, 500);
    return () => {
      window.clearTimeout(salaryVaultSyncTimerRef.current);
      salaryVaultSyncTimerRef.current = null;
    };
  }, [
    user?.id,
    workspaceLoadedForUser,
    salaryVaultStatus,
    dailyWage,
    dailyAllowance,
    overtimeMultiplier,
    nightDifferential,
    salaryVaultExtraSettings,
    attendance,
    persistPrivateSalaryVault,
    addToast,
  ]);

  useEffect(() => {
    if (
      !user?.id ||
      workspaceLoadedForUser !== user.id ||
      !workspaceLoadedRef.current
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
    workspaceData,
    saveRequest,
    addToast,
    queueWorkspaceSave,
  ]);

  useEffect(
    () => () => {
      timers.current.forEach(window.clearTimeout);
      window.clearTimeout(monthCarouselTimer.current);
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

  const changeMonthTo = (nextYear, nextMonthIndex) => {
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
    window.clearTimeout(monthCarouselTimer.current);
    setMonthCarouselMotion(null);
    setYear(nextYear);
    setSelectedDay(1);
  };

  const resetCalendar = () => {
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
    if (salaryVaultStatus !== "unlocked") {
      showToast("Unlock the salary vault before adding an employee incentive.", "warning");
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
    setSalaryVaultExtraSettings((current) => ({
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
    setSalaryVaultExtraSettings((current) => ({
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

  const savePayslipToHistory = async () => {
    if (
      salaryVaultStatus !== "unlocked" ||
      !salaryVaultKeyRef.current ||
      !user?.id
    ) {
      showToast(
        "Unlock the salary vault before saving a payslip snapshot.",
        "warning",
      );
      return false;
    }

    let nextHistory;
    try {
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
          dailyWage,
          dailyAllowance,
          overtimeMultiplier,
          nightDifferential,
          payrollDeductions: payrollDeductionSettings,
        },
      });
      nextHistory = appendPayslipSnapshot(
        salaryVaultPayslipsRef.current,
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

    window.clearTimeout(salaryVaultSyncTimerRef.current);
    salaryVaultSyncTimerRef.current = null;
    setPayslipHistorySaving(true);
    setSalaryVaultSyncing(true);
    try {
      await persistPrivateSalaryVault({
        settings: {
          ...salaryVaultExtraSettings,
          dailyWage,
          dailyAllowance,
          overtimeMultiplier,
          nightDifferential,
        },
        attendance: extractPrivateFinancialAttendance(attendance),
        payslips: nextHistory,
      });
      salaryVaultPayslipsRef.current = nextHistory;
      setHistoricalPayslips(nextHistory);
      addToast("Payslip estimate saved to encrypted history.", "success");
      return true;
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      const message =
        error?.code === "40001"
          ? "Encrypted salary data changed on another device. Reload and unlock the vault before saving this payslip."
          : `Payslip history could not be saved. No success was recorded.${detail}`;
      setSalaryVaultError(message);
      addToast(message, "error");
      return false;
    } finally {
      setSalaryVaultSyncing(false);
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
      salaryVaultStatus !== "unlocked" ||
      !salaryVaultKeyRef.current ||
      !user?.id
    ) {
      showToast(
        "Unlock the salary vault before deleting a saved payslip.",
        "warning",
      );
      return false;
    }

    let nextHistory;
    try {
      nextHistory = removePayslipSnapshot(
        salaryVaultPayslipsRef.current,
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

    window.clearTimeout(salaryVaultSyncTimerRef.current);
    salaryVaultSyncTimerRef.current = null;
    setPayslipHistorySaving(true);
    setSalaryVaultSyncing(true);
    try {
      await persistPrivateSalaryVault({
        settings: {
          ...salaryVaultExtraSettings,
          dailyWage,
          dailyAllowance,
          overtimeMultiplier,
          nightDifferential,
        },
        attendance: extractPrivateFinancialAttendance(attendance),
        payslips: nextHistory,
      });
      salaryVaultPayslipsRef.current = nextHistory;
      setHistoricalPayslips(nextHistory);
      if (activeHistoricalPayslip?.id === snapshot.id) {
        setActiveHistoricalPayslip(null);
      }
      addToast("Saved payslip deleted.", "success");
      return true;
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      const message =
        error?.code === "40001"
          ? "Encrypted salary data changed on another device. Reload and unlock the vault before deleting this payslip."
          : `Saved payslip could not be deleted. No deletion was recorded.${detail}`;
      setSalaryVaultError(message);
      addToast(message, "error");
      return false;
    } finally {
      setSalaryVaultSyncing(false);
      setPayslipHistorySaving(false);
    }
  };

  const flushWorkspace = async () => {
    if (!user?.id || !workspaceLoadedRef.current) return true;
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

  const flushSalaryVault = async () => {
    if (salaryVaultStatus !== "unlocked") return true;
    window.clearTimeout(salaryVaultSyncTimerRef.current);
    salaryVaultSyncTimerRef.current = null;
    setSalaryVaultSyncing(true);
    try {
      await persistPrivateSalaryVault({
        settings: {
          ...salaryVaultExtraSettings,
          dailyWage,
          dailyAllowance,
          overtimeMultiplier,
          nightDifferential,
        },
        attendance: extractPrivateFinancialAttendance(attendance),
      });
      setSalaryVaultSyncing(false);
      return true;
    } catch (error) {
      setSalaryVaultSyncing(false);
      const message =
        error?.code === "40001"
          ? "Encrypted salary data changed on another device. Unlock the vault again before signing out."
          : "Encrypted salary data could not be saved. Stay signed in and retry before signing out.";
      setSalaryVaultError(message);
      addToast(message, "error");
      return false;
    }
  };

  const exportWorkspace = async () => {
    if (!(await flushWorkspace())) return;
    const exportData = {
      exportedAt: new Date().toISOString(),
      workspace: workspaceData,
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
    const confirmed = window.confirm(
      "Permanently delete your account and all TimeCloud app data (workspace, attendance, and encrypted salary vault)? Unsaved changes will be discarded. This cannot be undone. Supabase operational logs and backups may be retained under the provider's retention policies.",
    );
    if (!confirmed || !supabase) return;

    setAccountDeletionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error || data?.success !== true) {
        const detail = typeof data?.error === "string" ? ` ${data.error}` : "";
        showToast(
          `Account deletion could not be confirmed.${detail || " Check your account status before retrying."}`,
          "error",
        );
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });
      pendingSuccessToasts.current = [];
      setAuthSession(null);
      setWorkspaceLoadedForUser(null);
      setActiveModal(null);
      try {
        clearLegacyPrivateFinancialData(user.id);
      } catch {
        addToast(
          "Account deleted, but an older unencrypted salary copy remains in this browser's storage. Clear it manually after preserving any needed data.",
          "error",
        );
      }
      salaryVaultKeyRef.current = null;
      salaryVaultRevisionRef.current = 0;
      setSalaryVaultRecord(null);
      setSalaryVaultStatus("loading");
      if (signOutError) {
        showToast(
          "Your account and app data were deleted, but this browser could not clear its saved session. Reload the page.",
          "error",
        );
        return;
      }
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
    if (!(target instanceof HTMLElement)) return;
    if (target.id.endsWith("Modal")) {
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
    else if (action === "openManualEntryModal()")
      setActiveModal("manualEntryModal");
    else if (action === "clearSelectedShift()") {
      const currentRecord = attendance[selectedDate] || defaultAttendance;
      if (
        !isShiftClearable(currentRecord) ||
        activeTimeEntry?.date === selectedDate
      ) {
        showToast(
          "A shift can only be cleared when assigned and no Time In is currently active.",
          "warning",
        );
        return;
      }
      setAttendance((state) => ({
        ...state,
        [selectedDate]: { ...defaultAttendance },
      }));
      showToast(`Shift cleared for ${selectedDate}.`, "success");
    } else if (action === "openAssignShiftModal()") {
      setCustomShiftName("");
      setSelectedShiftTemplate("rest-day");
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
    } else if (action.startsWith("deleteShiftTemplate(")) {
      const id = actionArgument(action);
      const template = shiftTemplates.find((item) => item.id === id);
      if (!template || template.protected) return;
      setShiftTemplates((current) => current.filter((item) => item.id !== id));
      if (selectedShiftTemplate === id) setSelectedShiftTemplate("rest-day");
      showToast(`"${template.label}" template deleted.`, "success");
    } else if (action.startsWith("handleSaveCustomShift(")) {
      event.preventDefault();
      const name = customShiftName.trim();
      if (!name) return;
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
          range: `${formatTime(customShiftStart)} - ${formatTime(customShiftEnd)}`,
          assigned: `${formatTime(customShiftStart)} - ${formatTime(customShiftEnd)}`,
          startTime: customShiftStart,
          endTime: customShiftEnd,
          icon: selectedIcon,
          iconColor,
        },
      ]);
      setSelectedShiftTemplate(id);
      setCustomShiftName("");
      showToast(`Custom shift "${name}" saved to options.`, "success");
    }
  };

  const handleTimeClockClick = async () => {
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
        const punch = await clockOutForShift(date);
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
        if (error?.code === "23514") {
          showToast(
            "Time Out requires an active cloud-recorded Time In and can only be recorded once.",
            "warning",
          );
        } else if (error?.code === "22023") {
          showToast(
            "The server rejected Time Out because the shift time is invalid or the clock-out window has ended. Use Manual Entry to correct a missed punch.",
            "error",
          );
        } else if (error?.code === "42702") {
          showToast(
            "The cloud clock-out function needs its latest Supabase migration. Contact the project administrator to apply pending migrations.",
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
    const configuredWage = Number(dailyWage);
    const shiftPay =
      Number.isFinite(configuredWage) && configuredWage > 0
        ? formatPayAmount(configuredWage)
        : "P0.00";
    const hasScheduledShift =
      currentRecord.hasAssignedShift === true ||
      Boolean(currentRecord.shiftStartTime && currentRecord.shiftEndTime);
    const punchRecord = {
      ...currentRecord,
      type: "Regular",
      shift:
        hasScheduledShift && currentRecord.type !== "Absent"
          ? currentRecord.shift
          : "Time Record",
      wageRate: "100%",
      base: shiftPay,
      ot: "P0.00",
      penalty: "P0.00",
      est: `${shiftPay} PHP`,
      assigned: currentRecord.assigned,
      in: "—",
      out: "—",
      workStartTime: "",
      workEndTime: "",
      clockedIn: false,
      hasAssignedShift: hasScheduledShift,
      undertime: false,
      undertimeMinutes: 0,
      dots: [{ title: "Clocked In", color: "bg-amber-500" }],
      badges: [{ text: "Clocked In", color: "bg-amber-100 text-amber-800" }],
    };
    try {
      if (!(await flushWorkspace())) return;
      const punch = await clockInForShift(targetDate, punchRecord);
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
      if (error?.code === "23505") {
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
      const targetDate = String(data.get("manualEntryDate") || "");
      const [targetYear, targetMonth, targetDay] = targetDate
        .split("-")
        .map(Number);
      const parsedTargetDate = new Date(`${targetDate}T00:00:00Z`);
      const isValidTargetDate =
        /^\d{4}-\d{2}-\d{2}$/.test(targetDate) &&
        !Number.isNaN(parsedTargetDate.getTime()) &&
        parsedTargetDate.toISOString().slice(0, 10) === targetDate;
      const manualTimeIn = String(data.get("manualTimeIn") || "");
      const manualTimeOut = String(data.get("manualTimeOut") || "");
      const manualInMinutes = parseTimeMinutes(manualTimeIn);
      const manualOutMinutes = parseTimeMinutes(manualTimeOut);
      if (!isValidTargetDate) {
        showToast("Choose a valid target date.", "warning");
        return;
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
      const assignedRecord = attendance[targetDate] || defaultAttendance;
      if (
        assignedRecord.hasAssignedShift !== true &&
        !(assignedRecord.shiftStartTime && assignedRecord.shiftEndTime)
      ) {
        showToast(
          "Assign a shift to the target date before adding a manual attendance entry.",
          "warning",
        );
        return;
      }
      if (assignedRecord.type !== "Regular") {
        showToast(
          `Manual attendance cannot replace a ${assignedRecord.type.toLowerCase()} date without an eligible scheduled shift.`,
          "warning",
        );
        return;
      }
      const scheduledStart = parseTimeMinutes(assignedRecord.shiftStartTime);
      const scheduledEndOfDay = parseTimeMinutes(assignedRecord.shiftEndTime);
      if (scheduledStart === null || scheduledEndOfDay === null) {
        showToast(
          "The assigned shift has invalid scheduled times. Update the shift before entering attendance.",
          "warning",
        );
        return;
      }
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
      const isOvertimeClaim = entryType === "Overtime";
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
              ? "An overtime claim must end after the assigned shift. Time In must fall within the assigned shift and its allowed early-punch window."
              : "Time In and Time Out must fall within the assigned shift and its allowed early-punch window.",
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
        ? { late: false, lateMinutes: 0, undertime: false, undertimeMinutes: 0 }
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
        badges = [{ text: "Half-day", color: "bg-amber-100 text-amber-800" }];
        dots = [{ title: "Half-day", color: "bg-amber-500" }];
      } else if (entryType === "Overtime") {
        const scheduledShiftMinutes = scheduledEnd - scheduledStart;
        overtimeMinutes = manualEnd - scheduledEnd;
        const hourlyBase =
          getAmount(assignedRecord.base) / (scheduledShiftMinutes / 60);
        const configuredOvertimeMultiplier = Number(overtimeMultiplier);
        if (
          !Number.isFinite(configuredOvertimeMultiplier) ||
          configuredOvertimeMultiplier <= 0
        ) {
          showToast(
            "Enter a valid overtime multiplier in Settings before recording overtime.",
            "warning",
          );
          return;
        }
        overtimeAmount =
          hourlyBase * (overtimeMinutes / 60) * configuredOvertimeMultiplier;
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
      const key = getAttendanceKey(targetMonth - 1, targetDay, targetYear);
      setAttendance((state) => ({
        ...state,
        [key]: applyAttendanceTiming(
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
        ),
      }));
      changeMonthTo(targetYear, targetMonth - 1);
      setSelectedDay(targetDay);
      if (activeTimeEntry?.date === targetDate) setActiveTimeEntry(null);
      setActiveModal(null);
      showToast("Manual entry applied successfully!", "success");
    } else if (action.startsWith("handleAssignShiftSubmit")) {
      const startValue = String(data.get("assignStartDate") || "");
      const endValue = String(data.get("assignEndDate") || "");
      const startDate = new Date(`${startValue}T00:00:00`);
      const endDate = new Date(`${endValue}T00:00:00`);
      if (
        !startValue ||
        !endValue ||
        Number.isNaN(startDate.valueOf()) ||
        Number.isNaN(endDate.valueOf())
      ) {
        showToast("Please select both start and end dates.", "warning");
        return;
      }
      if (startDate > endDate) {
        showToast("Start date cannot be after end date.", "warning");
        return;
      }
      const template =
        shiftTemplates.find((item) => item.id === selectedShiftTemplate) ||
        shiftTemplates.find((item) => item.id === "rest-day");
      const updates = {};
      const day = new Date(startDate);
      const configuredWage = Number(dailyWage);
      const shiftPay =
        Number.isFinite(configuredWage) && configuredWage > 0
          ? formatPayAmount(configuredWage)
          : "P0.00";
      let assigned = 0;
      while (day <= endDate) {
        const key = getAttendanceKey(
          day.getMonth(),
          day.getDate(),
          day.getFullYear(),
        );
        updates[key] =
          template.id === "rest-day"
            ? {
                type: "Rest Day",
                shift: "Rest Day",
                wageRate: "0%",
                base: "P0.00",
                ot: "P0.00",
                penalty: "P0.00",
                est: "P0.00 PHP",
                assigned: "Rest Day",
                in: "—",
                out: "—",
                workStartTime: "",
                workEndTime: "",
                dots: [],
                badges: [
                  { text: "Rest Day", color: "bg-slate-200 text-slate-700" },
                ],
              }
            : {
                type: "Regular",
                shift: template.label || template.name,
                wageRate: "100%",
                base: shiftPay,
                ot: "P0.00",
                penalty: "P0.00",
                est: `${shiftPay} PHP`,
                assigned: template.assigned,
                workStartTime: "",
                workEndTime: "",
                shiftStartTime: template.startTime || "",
                shiftEndTime: template.endTime || "",
                assignedShiftTemplateId: template.id,
                hasAssignedShift: true,
                in: "—",
                out: "—",
                customIcon: template.icon,
                customIconColor: template.iconColor,
                dots: [],
                badges: [
                  {
                    text: template.label || template.name,
                    color: "bg-teal-100 text-teal-800",
                  },
                ],
              };
        assigned += 1;
        day.setDate(day.getDate() + 1);
      }
      setAttendance((state) => ({ ...state, ...updates }));
      setActiveModal(null);
      showToast(
        `Shift "${template.name}" assigned to ${assigned} day(s).`,
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
    const padding = 4 + Math.abs(monthCarouselMotion?.offset ?? 0);
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
          className={`relative z-10 w-11 shrink-0 px-2 py-1 text-center text-xs font-medium rounded-lg transition-colors duration-300 cursor-pointer ${isActive ? "text-white font-bold" : "text-slate-600 hover:text-slate-900"}`}
        >
          {monthAbbreviations[tabMonthIndex]}
        </button>
      );
    });
  }, [monthIndex, monthCarouselMotion, year]);

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
          className="bg-slate-50/50 border border-slate-100 rounded-xl p-0 min-h-[90px] opacity-40"
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
      cells.push(
        <CalendarDay
          key={`${year}-${monthIndex}-${day}`}
          day={day}
          year={year}
          monthIndex={monthIndex}
          shiftTemplates={shiftTemplates}
          record={applyNightDifferential(
            applyHoliday(
              applyConfiguredAttendanceTiming(
                getAutomaticAttendanceStatus(
                  getRecord(attendance, monthIndex, day, year),
                  formatDate(year, monthIndex, day),
                  manilaNow,
                ),
                lateGracePeriodMinutes,
              ),
              getHolidayForDate(
                holidays,
                formatDate(year, monthIndex, day),
                selectedLocality,
              ),
            ),
            nightDifferential,
          )}
          selected={day === selectedDay}
          hasIncentive={incentiveDates.has(formatDate(year, monthIndex, day))}
          onSelect={() => setSelectedDay(day)}
        />,
      );
    }
    return cells;
  }, [
    attendance,
    availableEmployeeIncentives,
    holidays,
    lateGracePeriodMinutes,
    manilaNow,
    monthIndex,
    nightDifferential,
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
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelectedShiftTemplate(template.id);
          setCustomShiftName("");
        }
      }}
      className={`shift-card relative cursor-pointer border-2 rounded-2xl p-3.5 flex flex-col items-center text-center transition ${selectedShiftTemplate === template.id ? "border-indigo-600 bg-indigo-50/30 shadow-xs" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-2">
        <i
          className={`fa-solid ${template.icon} text-sm ${template.iconColor}`}
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
      className="bg-slateBg text-textMain font-sans antialiased min-h-screen flex flex-col selection:bg-teal-500 selection:text-white overflow-x-clip"
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
                const { error } = await supabase.auth.signOut();
                if (error)
                  showToast("Unable to sign out. Please try again.", "error");
              }}
              className="ml-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Sign out
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
                onLogout={async () => {
                  if (!(await flushSalaryVault())) return;
                  if (!(await flushWorkspace())) return;
                  const { error } = await supabase.auth.signOut();
                  if (error)
                    showToast("Unable to sign out. Please try again.", "error");
                  else addToast("Signed out successfully.", "info");
                }}
              />
              {salaryVaultStatus !== "unlocked" && (
                <div
                  className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between"
                  role="status"
                >
                  <span>
                    {salaryVaultStatus === "locked"
                      ? "Salary vault is locked. Unlock it in Settings to view and sync encrypted salary data."
                      : salaryVaultStatus === "unavailable"
                        ? "Apply the pending Supabase migration to enable encrypted salary sync. Other workspace data remains available."
                        : "Create an encrypted salary vault in Settings to sync salary settings and earnings across devices."}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSettingsTab("general");
                      setActiveModal("settingsModal");
                    }}
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold hover:bg-amber-100"
                  >
                    Open salary vault
                  </button>
                </div>
              )}
            </div>
            {salaryVaultError && (
              <div
                className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
                role="alert"
              >
                {salaryVaultError}
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
                    onClick={() => {
                      if (
                        window.confirm(
                          "Reloading will discard unsynced changes. Continue?",
                        )
                      ) {
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
              page={page}
              monthTabs={monthTabs}
              monthCarouselOffset={monthCarouselMotion?.offset ?? 0}
              onMonthCarouselTransitionEnd={finishMonthCarouselMotion}
              yearOptions={yearOptions}
              onYearChange={changeYear}
              calendarCells={calendarCells}
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
              dailyAllowance={dailyAllowance}
              holidayWorkedHours={selectedWorkedHours}
              nightDifferentialPay={selectedNightDifferentialPay}
              overtimePay={selectedOvertimePay}
              overtimeCalculation={selectedOvertimeCalculation}
              configuredDailyWage={dailyWage}
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
              salaryVaultError={salaryVaultError}
              salaryVaultSyncing={salaryVaultSyncing}
              workspaceLoading={workspaceLoading}
              workspaceError={workspaceError}
              workspaceSaveError={workspaceSaveError}
              historicalPayslips={
                salaryVaultStatus === "unlocked" ? historicalPayslips : []
              }
              payslipHistorySaving={payslipHistorySaving}
              salaryVaultStatus={salaryVaultStatus}
              currentPayrollPeriod={payrollPeriod}
              onViewCurrentPayslip={() => {
                setActiveHistoricalPayslip(null);
                setActiveModal("payslipModal");
              }}
              onViewHistoricalPayslip={viewHistoricalPayslip}
              onDeleteHistoricalPayslip={deleteHistoricalPayslip}
            />
            <ManualEntryModal
              key={`manual-${selectedDate}`}
              open={activeModal === "manualEntryModal"}
              selectedDate={selectedDate}
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
              key={`shift-${selectedDate}`}
              open={activeModal === "assignShiftModal"}
              selectedDate={selectedDate}
              shiftTemplateCards={shiftTemplateCards}
              customShiftName={customShiftName}
              setCustomShiftName={setCustomShiftName}
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
                salaryVaultStatus === "unlocked"
                  ? activeHistoricalPayslip
                  : null
              }
              payrollPeriodMode={payslipPeriodMode}
              onPayrollPeriodModeChange={setPayslipPeriodMode}
              payrollPeriod={selectedPayslipPeriod}
              payrollPeriodSummary={selectedPayslipSummary}
              payrollEarningsBreakdown={selectedPayslipBreakdown}
              cutoffPayrollDeductions={selectedPayslipDeductions}
              payrollPeriodNetPay={selectedPayslipNetPay}
              payrollPeriodEarningsAvailable={isPayrollPeriodEarningsAvailable(
                salaryVaultStatus,
              )}
              dailyWage={dailyWage}
              formatCurrency={formatCurrency}
              canSavePayslip={salaryVaultStatus === "unlocked"}
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
              payrollSettings={salaryVaultExtraSettings}
              payrollDeductions={payrollDeductions}
              nightDifferential={nightDifferential}
              onDeleteAccount={deleteAccount}
              accountDeletionLoading={accountDeletionLoading}
              salaryVaultStatus={salaryVaultStatus}
              salaryVaultError={salaryVaultError}
              salaryVaultConflict={salaryVaultConflict}
              salaryVaultSyncing={salaryVaultSyncing}
              onUnlockSalaryVault={unlockOrCreateSalaryVault}
              onLockSalaryVault={lockSalaryVault}
              onRotateSalaryVault={rotateSalaryVaultPassphrase}
              onReloadSalaryVault={reloadSalaryVault}
              onSettingsValidationError={(message) =>
                showToast(message, "warning")
              }
              onSaveSettings={async (draft) => {
                const currentPayrollSettings =
                  getPayrollDeductionSettingsDefaults(salaryVaultExtraSettings);
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
                  salaryVaultStatus !== "unlocked"
                ) {
                  addToast(
                    "Unlock or create the encrypted salary vault before changing salary settings.",
                    "warning",
                  );
                  return false;
                }
                if (salaryVaultStatus === "unlocked") {
                  try {
                    await persistPrivateSalaryVault({
                      settings: {
                        ...salaryVaultExtraSettings,
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
                      },
                      attendance: extractPrivateFinancialAttendance(attendance),
                    });
                  } catch (error) {
                    const conflict = error?.code === "40001";
                    const message = conflict
                      ? "Encrypted salary data changed on another device. Unlock the vault again before saving."
                      : "Salary settings could not be saved to the encrypted cloud vault. Your settings were not confirmed as saved.";
                    setSalaryVaultError(message);
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
                setSalaryVaultExtraSettings((current) => ({
                  ...current,
                  ...Object.fromEntries(
                    payrollDeductionSettingKeys.map((key) => [key, draft[key]]),
                  ),
                }));
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
          </>
        )}
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />
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
