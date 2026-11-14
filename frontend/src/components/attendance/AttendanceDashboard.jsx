import { useEffect, useState } from "react";
import { MousePointerClick, RotateCcw } from "lucide-react";
import ShiftIcon from "../ui/ShiftIcon.jsx";
import { groupIncentiveEarningsItems } from "../../utils/payrollEarningsBreakdown.js";
import {
  getAttendanceBasePay,
  getStoredAttendanceBasePay,
} from "../../utils/attendancePay.js";

export default function AttendanceDashboard({
  record,
  selectedDate,
  selectedRange,
  leaveBalances = {},
  canClearShift,
  canMarkAbsent,
  privateFinancialDataStatus,
  holidayPayEstimate,
  estimatedEarnings,
  selectedDateIncentives = [],
  onAddIncentive,
  dailyAllowance,
  nightDifferentialPay,
  overtimePay,
  overtimeCalculation,
  workHours,
  configuredDailyWage,
  monthTabs,
  monthCarouselOffset,
  onMonthCarouselTransitionEnd,
  yearOptions,
  onYearChange,
  calendarCells,
  calendarRangeMode,
  calendarRangeStatus,
  onCalendarRangeModeToggle,
  monthLabel,
  year,
}) {
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [resetAnimationKey, setResetAnimationKey] = useState(0);
  const [isPayComponentsExpanded, setIsPayComponentsExpanded] = useState(false);
  const [isLeaveTypeSelectorOpen, setIsLeaveTypeSelectorOpen] =
    useState(false);
  const [isIncentiveFormOpen, setIsIncentiveFormOpen] = useState(false);
  const [newIncentiveName, setNewIncentiveName] = useState("");
  const [newIncentiveAmount, setNewIncentiveAmount] = useState("");
  useEffect(() => {
    setIsLeaveTypeSelectorOpen(false);
  }, [selectedDate]);

  const salaryDataPrivate = privateFinancialDataStatus !== "ready";
  const resolvedBasePay = getAttendanceBasePay(record, configuredDailyWage);
  const useConfiguredBasePay =
    getStoredAttendanceBasePay(record) === 0 && resolvedBasePay > 0;
  const selectedDateIncentiveTotal = selectedDateIncentives.reduce(
    (total, incentive) => total + Number(incentive.amount),
    0,
  );
  const groupedSelectedDateIncentives = groupIncentiveEarningsItems(
    selectedDateIncentives.map((incentive) => ({
      id: incentive.id,
      label: incentive.name,
      date: selectedDate,
      total: Number(incentive.amount),
    })),
  );
  const holidayTextColors = {
    "Regular Holiday": "text-rose-700",
    "Special Non-Working Day": "text-indigo-700",
    "Special Working Day": "text-teal-700",
    "Local Holiday": "text-violet-700",
    "Ordinary Working Day": "text-slate-700",
    "Company Break": "text-emerald-700",
  };
  const hasRecordedAttendance = Boolean(
    record.clockedIn ||
    record.workStartTime ||
    record.workEndTime ||
    (record.in && record.in !== "—") ||
    (record.out && record.out !== "—"),
  );
  const hasWorkedAttendance = Boolean(
    hasRecordedAttendance &&
    record.type !== "Absent" &&
    !record.holidayUnworked,
  );
  const holidayRateLabel = (() => {
    const isRestDay = record.type === "Rest Day";
    if (record.holidayClassification === "Regular Holiday") {
      return record.holidayUnworked || record.type === "Absent"
        ? "100%"
        : "200%";
    }
    if (record.holidayClassification === "Special Non-Working Day") {
      if (record.holidayUnworked || record.type === "Absent") return "0%";
      return `${isRestDay ? 150 : 130}%`;
    }

    const workedMultiplier = {
      "Special Working Day": 100,
      "Ordinary Working Day": 100,
    }[record.holidayClassification];

    return workedMultiplier && hasWorkedAttendance
      ? `${workedMultiplier}%`
      : record.wageRate;
  })();
  const holidayPayRateLabel =
    record.holidayClassification === "Regular Holiday"
      ? record.holidayUnworked || record.type === "Absent"
        ? "100% total including base wage"
        : hasWorkedAttendance && holidayPayEstimate?.regularPayRateLabel
          ? holidayPayEstimate.regularPayRateLabel
          : "200% total including base wage"
      : holidayPayEstimate?.regularPayRateLabel;
  const displayedHolidayPayRateLabel = salaryDataPrivate
    ? "Private data unavailable"
    : record.holidayClassification === "Special Non-Working Day"
      ? record.holidayUnworked || record.type === "Absent"
        ? "0% total including base wage"
        : holidayPayEstimate?.regularPayRateLabel ||
          `${record.type === "Rest Day" ? 150 : 130}% total including base wage`
      : holidayPayRateLabel;
  const shiftTitleColor = record.holidayName
    ? holidayTextColors[record.holidayClassification]
    : "text-textMain";
  const shiftTitle =
    record.shift === "Manual Entry Adjustment"
      ? record.assignedShiftName || "Assigned Shift"
      : record.shift;
  const shiftSubtitle = record.holidayName
    ? `${record.holidayDutyLabel === "Holiday Duty" ? record.assignedShiftName || record.shift : record.holidayDutyLabel} · ${record.shift}${record.holidayDescription ? ` · ${record.holidayDescription}` : ""}`
    : record.type === "Rest Day"
      ? "Rest Day — Schedule Assigned"
      : record.type === "Regular"
        ? [
            record.assignedShiftName || shiftTitle,
            record.shift !== (record.assignedShiftName || shiftTitle)
              ? record.shift
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : null;
  const allowanceAmount = Number(dailyAllowance);
  const hasAllowance =
    !["Absent", "Rest Day"].includes(record.type) &&
    !record.holidayUnworked &&
    Number.isFinite(allowanceAmount) &&
    allowanceAmount > 0;
  const nightDifferentialAmount = Number(nightDifferentialPay);
  const hasNightDifferential =
    Number.isFinite(nightDifferentialAmount) && nightDifferentialAmount > 0;
  const overtimeAmount = Number(overtimePay);
  const hasOvertime = Number.isFinite(overtimeAmount) && overtimeAmount > 0;
  const lateMinutes = Number(record.lateMinutes);
  const undertimeMinutes = Number(record.undertimeMinutes);
  const hasLateOrUndertime =
    record.late ||
    record.undertime ||
    (Number.isFinite(lateMinutes) && lateMinutes > 0) ||
    (Number.isFinite(undertimeMinutes) && undertimeMinutes > 0);
  const attendanceExceptions = [
    Number.isFinite(lateMinutes) && lateMinutes > 0
      ? `Late ${lateMinutes} min`
      : record.late
        ? "Late"
        : null,
    Number.isFinite(undertimeMinutes) && undertimeMinutes > 0
      ? `Undertime ${undertimeMinutes} min`
      : record.undertime
        ? "Undertime"
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const isAbsent = record.type === "Absent";
  const formatClockTime = (value) => {
    if (typeof value !== "string" || !value.trim() || value === "—") return "—";
    const match = value.trim().match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/i);
    if (!match) return value;
    let hour = Number(match[1]);
    const minute = match[2];
    const meridiem = match[3]?.toUpperCase();
    if (meridiem) {
      if (hour < 1 || hour > 12) return value;
    } else {
      if (hour > 23) return value;
      const period = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      return `${String(hour).padStart(2, "0")}:${minute} ${period}`;
    }
    return `${String(hour).padStart(2, "0")}:${minute} ${meridiem}`;
  };
  const formatCompactHours = (minutes) =>
    Number.isFinite(minutes)
      ? `${Number((minutes / 60).toFixed(2))}h`
      : "—";
  const scheduledStartTime = formatClockTime(
    record.assignedShiftSnapshot?.startTime || record.shiftStartTime,
  );
  const scheduledEndTime = formatClockTime(
    record.assignedShiftSnapshot?.endTime || record.shiftEndTime,
  );
  const hasScheduledTime =
    scheduledStartTime !== "—" && scheduledEndTime !== "—";
  const breakSummary =
    !Number.isFinite(workHours?.breakDurationMinutes) || !workHours?.breakType
      ? "Break settings unavailable"
      : workHours.breakDurationMinutes === 0
        ? workHours.breakType === "unpaid"
          ? "No unpaid break"
          : "No break"
        : `${workHours.breakDurationMinutes % 60 === 0 ? `${workHours.breakDurationMinutes / 60}h` : `${workHours.breakDurationMinutes}m`} ${workHours.breakType} break`;
  const dtrStart = formatClockTime(record.workStartTime || record.in);
  const dtrEnd = record.clockedIn
    ? "Clocked in"
    : formatClockTime(record.workEndTime || record.out);
  const actualDtrSummary =
    dtrStart === "—"
      ? record.clockedIn
        ? "Clocked in"
        : "No DTR recorded"
      : `${dtrStart} – ${dtrEnd}`;
  const shiftCardTitle = isAbsent
    ? "Marked Absent"
    : record.type === "Rest Day"
      ? "Rest Day"
      : record.assignedShiftSnapshot?.name ||
        record.assignedShiftName ||
        shiftTitle;
  const shiftCardSubtitle = record.holidayName
    ? record.holidayClassification || shiftSubtitle
    : shiftSubtitle;
  const shiftIcon = isAbsent
    ? "fa-user-xmark"
    : record.type === "Rest Day"
      ? "fa-calendar-xmark"
      : record.assignedShiftSnapshot?.icon ||
        record.customIcon ||
        "fa-clock";

  return (
    <div className="w-full shrink-0 grid grid-cols-1 items-start md:grid-cols-12 gap-6">
      <section className="md:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <i
                  className="fa-regular fa-file-lines text-base"
                  aria-hidden="true"
                ></i>
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-textMain sm:text-base">
                  Attendance Breakdown
                </h2>
                <p className="mt-0.5 text-[11px] text-textMuted">
                  {selectedRange?.dayCount > 1
                    ? `Range selected · daily details for ${selectedDate}`
                    : "Daily shift & pay ledger"}
                </p>
              </div>
            </div>
            <span
              id="selectedDateBadge"
              title={
                selectedRange?.dayCount > 1
                  ? `${selectedRange.startDate} – ${selectedRange.endDate}`
                  : selectedDate
              }
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"
            >
              {selectedRange?.dayCount > 1
                ? `${selectedRange.dayCount} days selected`
                : selectedDate}
            </span>
          </div>

          {record.holidayName && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5 text-[11px] text-indigo-800">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <i className="fa-solid fa-sparkles shrink-0 text-indigo-500" aria-hidden="true" />
                <span className="truncate">{record.holidayName}</span>
              </span>
              <span className="shrink-0 rounded-md bg-white/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-indigo-700">
                {holidayRateLabel || "—"} Rate
              </span>
            </div>
          )}

          <section
            aria-label="Assigned shift summary"
            className={`mb-3 rounded-xl border p-3.5 ${
              isAbsent
                ? "border-rose-200 bg-rose-50/70"
                : record.type === "Leave"
                  ? "border-amber-200 bg-amber-50/60"
                  : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <ShiftIcon
                  icon={shiftIcon}
                  size={17}
                  className={record.customIconColor || record.assignedShiftSnapshot?.iconColor || ""}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h3
                    id="shiftTitle"
                    className={`truncate text-sm font-bold ${shiftTitleColor}`}
                  >
                    {shiftCardTitle}
                  </h3>
                  {!record.holidayName && (
                    <span
                      id="wageRateText"
                      className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold text-slate-600"
                    >
                      {holidayRateLabel} Rate
                    </span>
                  )}
                </div>
                <p
                  id="shiftSubTitle"
                  className="mt-0.5 truncate text-[10px] text-textMuted"
                >
                  {isAbsent
                    ? record.holidayName
                      ? "No attendance recorded"
                      : "Unexcused absence — no basic pay"
                    : shiftCardSubtitle || "No shift assigned"}
                </p>
              </div>
              <button
                type="button"
                data-action="openAssignShiftModal()"
                className="shrink-0 cursor-pointer rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-700 transition hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                Change
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-bold text-slate-800">
              <span>{hasScheduledTime ? scheduledStartTime : "—"}</span>
              <span className="text-right">
                {formatCompactHours(workHours?.expectedPaidMinutes)} paid
                <span className="ml-1 font-medium text-slate-500">
                  · {breakSummary}
                </span>
              </span>
              <span className="text-right">
                {hasScheduledTime ? scheduledEndTime : "—"}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  isAbsent ? "bg-rose-400" : "bg-emerald-500"
                }`}
                style={{
                  width:
                    Number.isFinite(workHours?.actualPaidMinutes) &&
                    Number.isFinite(workHours?.expectedPaidMinutes) &&
                    workHours.expectedPaidMinutes > 0
                      ? `${Math.min(100, (workHours.actualPaidMinutes / workHours.expectedPaidMinutes) * 100)}%`
                      : "0%",
                }}
              />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
              <span className="font-medium text-slate-500">
                <i className="fa-regular fa-clock mr-1 text-slate-400" aria-hidden="true" />
                Actual DTR Log:
              </span>
              <span className="font-bold tabular-nums text-slate-700">
                {actualDtrSummary}
              </span>
            </div>
          </section>

          {!salaryDataPrivate && record.payrollCalculationNotice && (
            <p
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900"
              role="note"
            >
              Payroll estimate note: {record.payrollCalculationNotice}
            </p>
          )}

          {!salaryDataPrivate &&
            record.payrollCalculationStatus === "pending" && (
              <p
                className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900"
                role="status"
              >
                Payroll estimate pending:{" "}
                {record.payrollCalculationMessage ||
                  "required payroll settings are incomplete."}
              </p>
            )}

          <section aria-label="Attendance status" className="mb-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Attendance Status
              </h3>
              <span className="text-[9px] font-medium text-slate-500">
                {selectedRange?.dayCount > 1
                  ? `Apply status to ${selectedRange.dayCount} selected days`
                  : `Span: ${formatCompactHours(workHours?.scheduledMinutes)} · Potential OT: ${formatCompactHours(workHours?.potentialOvertimeMinutes)}`}
              </span>
            </div>
            <div
              role="group"
              aria-label="Set attendance status"
              className="grid grid-cols-4 rounded-xl border border-slate-200 bg-slate-100 p-1"
            >
              {[
                {
                  label: "Present",
                  action: "openManualEntryModal()",
                  selected:
                    hasWorkedAttendance &&
                    !isAbsent &&
                    record.type !== "Leave",
                  selectedClass: "bg-emerald-600 text-white shadow-sm",
                  idleClass: "text-slate-600 hover:bg-white",
                },
                {
                  label: "Leave",
                  selected:
                    record.type === "Leave" || isLeaveTypeSelectorOpen,
                  disabled: false,
                  selectedClass: "bg-amber-500 text-white shadow-sm",
                  idleClass: "text-slate-600 hover:bg-white",
                },
                {
                  label: "Absent",
                  action: "markSelectedDateAbsent()",
                  selected: isAbsent,
                  disabled: !canMarkAbsent && !isAbsent,
                  selectedClass: "bg-rose-600 text-white shadow-sm",
                  idleClass: "text-slate-600 hover:bg-white",
                },
                {
                  label: "Clear",
                  action: "clearSelectedShift()",
                  selected: false,
                  disabled: !canClearShift,
                  selectedClass: "bg-slate-200 text-slate-700",
                  idleClass: "text-slate-600 hover:bg-white",
                },
              ].map((status) => (
                <button
                  key={status.label}
                  type="button"
                  data-action={status.action || undefined}
                  aria-pressed={status.selected}
                  disabled={status.disabled}
                  onClick={() => {
                    if (status.label === "Leave") {
                      if (record.type !== "Leave") {
                        setIsLeaveTypeSelectorOpen(true);
                      }
                    } else {
                      setIsLeaveTypeSelectorOpen(false);
                    }
                  }}
                  className={`min-w-0 cursor-pointer rounded-lg px-1 py-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-40 ${
                    status.selected
                      ? status.selectedClass
                      : status.idleClass
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
            {isLeaveTypeSelectorOpen && record.type !== "Leave" && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/40 p-2.5">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                  Select Leave Type (Paid 8h)
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { code: "SL", label: "Sick" },
                    { code: "VL", label: "Vacation" },
                    { code: "EL", label: "Emergency" },
                  ].map((leaveType) => {
                    const remainingDays = Number(
                      leaveBalances[leaveType.code],
                    );
                    const balanceLabel =
                      Number.isFinite(remainingDays) && remainingDays >= 0
                        ? `${remainingDays} ${remainingDays === 1 ? "day" : "days"} left`
                        : "Balance unavailable";
                    return (
                      <button
                        key={leaveType.code}
                        type="button"
                        data-action={`grantSelectedDateLeave('${leaveType.code}')`}
                        aria-label={`${leaveType.label}, ${balanceLabel}`}
                        onClick={() => setIsLeaveTypeSelectorOpen(false)}
                        className="flex cursor-pointer flex-col items-center rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        <span>{leaveType.label}</span>
                        <span className="mt-0.5 text-[9px] font-medium text-slate-500">
                          {balanceLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Earnings and pay components */}
          <div
            className={`mb-3 flex min-h-[58px] flex-col justify-center rounded-xl border p-4 ${
              isAbsent
                ? "border-rose-200 bg-rose-50/40"
                : "border-teal-200 bg-teal-50/20"
            }`}
          >
            <div
              className="flex min-h-6 items-center justify-between"
            >
              <button
                type="button"
                aria-expanded={isPayComponentsExpanded}
                aria-controls="payComponentsDetails"
                onClick={() =>
                  setIsPayComponentsExpanded((expanded) => !expanded)
                }
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${
                  isAbsent ? "text-rose-700" : "text-slate-500"
                }`}
              >
                <span>Pay Components Breakdown</span>
                <i
                  className={`fa-solid ${isPayComponentsExpanded ? "fa-chevron-down" : "fa-chevron-right"} text-[9px] transition-transform duration-300`}
                  aria-hidden="true"
                ></i>
              </button>
              {!isPayComponentsExpanded ? (
                <span className={`shrink-0 text-right text-xs font-extrabold tabular-nums ${isAbsent ? "text-rose-600" : "text-teal-800"}`}>
                  {salaryDataPrivate
                    ? "Private data unavailable"
                    : estimatedEarnings != null
                      ? `₱${estimatedEarnings.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : record.payrollCalculationStatus === "pending"
                        ? "Payroll pending"
                      : record.holidayClassification
                        ? "Estimate unavailable"
                        : record.est}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-normal normal-case text-teal-700">
                  <i
                    className="fa-regular fa-circle-question text-[10px]"
                    aria-hidden="true"
                  ></i>
                  Calculation Info
                </span>
              )}
            </div>

            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${
                isPayComponentsExpanded ? "mt-2" : "mt-0"
              }`}
              style={{
                gridTemplateRows: isPayComponentsExpanded ? "1fr" : "0fr",
                opacity: isPayComponentsExpanded ? 1 : 0,
              }}
              aria-hidden={!isPayComponentsExpanded}
            >
              <div
                id="payComponentsDetails"
                className={`min-h-0 overflow-hidden ${
                  isPayComponentsExpanded
                    ? "border-t border-slate-100 pt-2"
                    : ""
                }`}
              >
                {/* Pay Components Borderless List */}
                <div className="divide-y divide-slate-100 text-[11px]">
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <span className="flex flex-col min-w-0">
                      <span className="font-semibold text-slate-800">
                        Base Daily Wage (8 hrs)
                      </span>
                      <span className="text-[10px] italic text-slate-500 mt-0.5">
                        {record.holidayClassification
                          ? "Reference rate · Factored into rate below"
                          : "Reference rate · Not added separately"}
                      </span>
                    </span>
                    <span
                      id="baseWage"
                      className="shrink-0 text-right font-semibold text-slate-500 tabular-nums"
                    >
                      {record.holidayClassification
                        ? "Included in Total"
                        : salaryDataPrivate
                          ? "Private"
                          : record.type === "Unassigned"
                            ? Number(configuredDailyWage) > 0
                              ? `₱${Number(configuredDailyWage).toFixed(2)}`
                              : record.base
                            : useConfiguredBasePay
                              ? `P${resolvedBasePay.toFixed(2)}`
                              : record.base}
                    </span>
                  </div>

                  {record.holidayClassification && (
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <span className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-800">
                          Holiday Pay Total
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          {displayedHolidayPayRateLabel ||
                            "130% total including base wage"}
                        </span>
                      </span>
                      <span
                        id="holidayPay"
                        className="font-bold text-slate-800 shrink-0 tabular-nums"
                      >
                        {salaryDataPrivate
                          ? "Private"
                          : holidayPayEstimate?.regularPay != null
                            ? `₱${holidayPayEstimate.regularPay.toFixed(2)}`
                            : "Estimate unavailable"}
                      </span>
                    </div>
                  )}

                  {hasAllowance && (
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <span className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-800">
                          Co. Allowance
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          Standard daily stipend
                        </span>
                      </span>
                      <span
                        id="companyAllowance"
                        className="font-semibold text-teal-600 shrink-0 tabular-nums"
                      >
                        {salaryDataPrivate
                          ? "Private"
                          : `+₱${allowanceAmount.toFixed(2)}`}
                      </span>
                    </div>
                  )}

                  {hasNightDifferential && (
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <span className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-800">
                          Night Differential
                        </span>
                      </span>
                      <span
                        id="nightDifferentialPay"
                        className="font-semibold text-teal-600 shrink-0 tabular-nums"
                      >
                        {salaryDataPrivate
                          ? "Private"
                          : `+₱${nightDifferentialAmount.toFixed(2)}`}
                      </span>
                    </div>
                  )}

                  {hasOvertime && (
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <span className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-800">
                          Overtime
                        </span>
                        {!salaryDataPrivate && overtimeCalculation && (
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            {overtimeCalculation}
                          </span>
                        )}
                      </span>
                      <span
                        id="overtimePay"
                        className="font-semibold text-slate-800 shrink-0 tabular-nums"
                      >
                        {salaryDataPrivate
                          ? "Private"
                          : `+₱${overtimeAmount.toFixed(2)}`}
                      </span>
                    </div>
                  )}

                  {selectedDateIncentives.length > 0 && (
                    <div className="py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-800">
                          Incentives
                        </span>
                        <span className="shrink-0 font-semibold text-teal-600 tabular-nums">
                          {salaryDataPrivate
                            ? "Private"
                            : `+₱${selectedDateIncentiveTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </span>
                      </div>
                      <ul className="mt-0.5 space-y-0.5 pl-3 text-[10px] text-slate-400">
                        {groupedSelectedDateIncentives.map((incentive) => (
                          <li key={incentive.id}>
                            {`${incentive.label} — ${incentive.count} @ ₱${(incentive.total / incentive.count).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ea (₱${incentive.total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="py-2">
                    <button
                      type="button"
                      disabled={salaryDataPrivate}
                      onClick={() =>
                        setIsIncentiveFormOpen((isOpen) => !isOpen)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      title={
                        salaryDataPrivate
                          ? "Private financial data is not available"
                          : undefined
                      }
                      aria-expanded={isIncentiveFormOpen}
                    >
                      <i
                        className={`fa-solid ${isIncentiveFormOpen ? "fa-minus" : "fa-plus"} text-[10px]`}
                        aria-hidden="true"
                      ></i>
                      {salaryDataPrivate
                        ? "Private data unavailable"
                        : "Add incentive"}
                    </button>
                    {isIncentiveFormOpen && (
                      <form
                        className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const added = onAddIncentive({
                            name: newIncentiveName,
                            amount: newIncentiveAmount,
                            date: selectedDate,
                          });
                          if (added) {
                            setNewIncentiveName("");
                            setNewIncentiveAmount("");
                            setIsIncentiveFormOpen(false);
                          }
                        }}
                      >
                        <p className="text-[10px] text-slate-500">
                          This incentive will be recorded for {selectedDate}.
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <label className="text-[10px] font-semibold text-slate-600">
                            Description
                            <input
                              type="text"
                              value={newIncentiveName}
                              onChange={(event) =>
                                setNewIncentiveName(event.target.value)
                              }
                              placeholder="e.g., INCENTIVES"
                              maxLength={80}
                              required
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </label>
                          <label className="text-[10px] font-semibold text-slate-600">
                            Amount (₱)
                            <input
                              type="number"
                              value={newIncentiveAmount}
                              onChange={(event) =>
                                setNewIncentiveAmount(event.target.value)
                              }
                              placeholder="0.00"
                              min="0.01"
                              step="0.01"
                              required
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </label>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsIncentiveFormOpen(false)}
                            className="rounded-lg px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="rounded-lg bg-teal-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-teal-700"
                          >
                            Save incentive
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Total Daily Earnings Summary Row */}
                  <div className="pt-3 pb-1 flex items-center justify-between gap-3 mt-1">
                    <span className="flex items-center gap-1.5 font-bold text-slate-900">
                      <i
                        className="fa-regular fa-circle-check text-teal-600 text-xs"
                        aria-hidden="true"
                      ></i>
                      Total Daily Earnings
                    </span>
                    <span className="font-extrabold text-teal-800 text-sm tabular-nums">
                      {salaryDataPrivate
                        ? "Private data unavailable"
                        : estimatedEarnings != null
                          ? `₱${estimatedEarnings.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : record.payrollCalculationStatus === "pending"
                            ? "Payroll pending"
                          : record.holidayClassification
                            ? "Estimate unavailable"
                            : record.est}
                    </span>
                  </div>
                </div>

                {/* Attendance Exceptions */}
                {hasLateOrUndertime && (
                  <div className="mt-3 border-t border-slate-100 pt-2.5 text-[11px]">
                    <h4 className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Attendance Exceptions
                    </h4>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-600">
                        {attendanceExceptions}
                      </span>
                      <span
                        id="penaltyPay"
                        className="shrink-0 font-medium text-slate-400 text-[10px]"
                      >
                        No deduction
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              data-action="openAssignShiftModal()"
              className="flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <i
                className="fa-regular fa-calendar-days text-white"
                aria-hidden="true"
              ></i>
              <span>Assign Shift</span>
            </button>
            <button
              type="button"
              data-action="openManualEntryModal()"
              className="flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>
              <span>Manual DTR</span>
            </button>
        </div>
      </section>

      <section className="md:col-span-8 lg:sticky md:top-20 md:self-start flex flex-col rounded-2xl border border-slate-200 bg-cardBg p-5 shadow-sm sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 pb-0 sm:flex-row sm:items-center">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
              Statutory Monthly Schedule
            </span>
            <div className="flex items-center space-x-2 mt-0.5">
              <h2
                id="calendarTitleMonth"
                className="text-xl font-bold text-textMain"
              >
                {monthLabel}
              </h2>
            </div>
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap gap-2">
            <div className="relative">
              <button
                id="calendarTitleYear"
                type="button"
                aria-label="Select calendar year"
                aria-expanded={isYearPickerOpen}
                aria-controls="calendarYearPicker"
                onClick={() => setIsYearPickerOpen((isOpen) => !isOpen)}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <i className="fa-regular fa-calendar text-teal-600"></i>
                <span>{year}</span>
                <i
                  className={`fa-solid fa-chevron-down text-[9px] text-slate-500 transition-transform ${isYearPickerOpen ? "rotate-180" : ""}`}
                ></i>
              </button>
              {isYearPickerOpen && (
                <div
                  id="calendarYearPicker"
                  aria-label="Choose calendar year"
                  className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
                >
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Select Year
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {yearOptions.map((optionYear) => (
                      <button
                        key={optionYear}
                        type="button"
                        aria-pressed={optionYear === year}
                        onClick={() => {
                          onYearChange(optionYear);
                          setIsYearPickerOpen(false);
                        }}
                        className={`rounded-lg px-2 py-2 text-xs font-semibold transition cursor-pointer ${
                          optionYear === year
                            ? "bg-teal-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        {optionYear}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <div
                id="monthTabsContainer"
                aria-label="Month navigation"
                className="relative flex w-[294px] max-w-full shrink-0 items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1"
              >
                <span aria-hidden="true" className="month-carousel-highlight" />
                <div className="relative h-6 w-full overflow-hidden">
                  <div
                    className={`absolute left-1/2 top-1/2 flex w-max shrink-0 gap-0 ${monthCarouselOffset ? "month-carousel-transition" : ""}`}
                    onTransitionEnd={onMonthCarouselTransitionEnd}
                    style={{
                      transform: `translate(-${(Math.max(4, Math.abs(monthCarouselOffset)) + monthCarouselOffset) * 40 + 20}px, -50%)`,
                    }}
                  >
                    {monthTabs}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setResetAnimationKey((animationKey) => animationKey + 1)
                }
                data-action="resetCalendar()"
                className="group inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 active:scale-90 motion-reduce:transition-none"
                title="Reset View"
                aria-label="Reset view"
              >
                <RotateCcw
                  key={resetAnimationKey}
                  size={16}
                  className={`transition-transform transition-colors duration-300 ease-out group-hover:-rotate-45 group-hover:text-emerald-600 motion-reduce:transition-none ${resetAnimationKey ? "reset-view-reverse-spin" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-[11px] text-indigo-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label={
                calendarRangeMode
                  ? "Exit range selection mode"
                  : "Select a date range without dragging"
              }
              aria-pressed={calendarRangeMode}
              title={
                calendarRangeMode
                  ? "Exit range selection mode"
                  : "Activate to choose a range by touch or keyboard"
              }
              onClick={onCalendarRangeModeToggle}
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                calendarRangeMode
                  ? "bg-indigo-600 text-white"
                  : "text-indigo-600 hover:bg-indigo-100"
              }`}
            >
              <MousePointerClick
                size={16}
                className={`h-4 w-4 shrink-0 ${calendarRangeMode ? "text-white" : "text-indigo-600"}`}
                aria-hidden="true"
              />
            </button>
            <p className="min-w-0">
              <span className="font-semibold">Tip:</span> Click, hold, and drag
              across multiple calendar days (or{" "}
              <kbd className="rounded border border-indigo-200 bg-white px-1.5 py-0.5 font-mono text-[10px]">
                Shift + Click
              </kbd>
              ) to assign shifts, leaves, or absences.
            </p>
          </div>
          {calendarRangeStatus !== "Single-click any day to inspect" && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 font-semibold ${
                calendarRangeStatus.startsWith("Selecting:")
                  ? "bg-indigo-500 text-white"
                  : "text-indigo-700"
              }`}
              role="status"
            >
              {calendarRangeStatus}
            </span>
          )}
        </div>
        <div className="grid grid-cols-7 border-b border-slate-100 py-3 text-center text-[11px] font-semibold tracking-wide text-textMuted">
          <div>SUN</div>
          <div>MON</div>
          <div>TUE</div>
          <div>WED</div>
          <div>THU</div>
          <div>FRI</div>
          <div>SAT</div>
        </div>
        <div id="calendarGrid" role="group" aria-label={`${monthLabel} ${year} calendar`} className="mt-3 grid flex-1 grid-cols-7 gap-2">
          {calendarCells}
        </div>
      </section>
    </div>
  );
}
