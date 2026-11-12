import { useState } from "react";
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
  canClearShift,
  canRecordAttendance,
  privateFinancialDataStatus,
  holidayPayEstimate,
  estimatedEarnings,
  selectedDateIncentives = [],
  onAddIncentive,
  dailyAllowance,
  nightDifferentialPay,
  overtimePay,
  overtimeCalculation,
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
  const [isTimeAttendanceExpanded, setIsTimeAttendanceExpanded] =
    useState(false);
  const [isIncentiveFormOpen, setIsIncentiveFormOpen] = useState(false);
  const [newIncentiveName, setNewIncentiveName] = useState("");
  const [newIncentiveAmount, setNewIncentiveAmount] = useState("");
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
  const breakdownTitle =
    record.holidayName ||
    (record.type === "Rest Day"
      ? "Scheduled Rest Day"
      : record.type === "Regular"
        ? "Regular Work Day"
        : shiftTitle);
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
  const wageRateIndicator = (
    <span
      id="wageRateText"
      className={`inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold ${
        record.type === "Absent" ? "text-rose-600" : "text-teal-700"
      }`}
    >
      <i className="fa-solid fa-percent text-[9px]" aria-hidden="true"></i>
      {`Wage Rate: ${holidayRateLabel}`}
    </span>
  );
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
  const entryButtonDisabled = !canRecordAttendance;
  const isAbsent = record.type === "Absent";
  const canMarkAbsent =
    !isAbsent &&
    !record.clockedIn &&
    ["Unassigned", "Regular"].includes(record.type);
  const breakdownCardStyle = isAbsent
    ? "border-rose-200 bg-rose-50/70"
    : record.type === "Leave"
      ? "border-amber-200 bg-amber-50/60"
      : "border-slate-200 bg-slate-50";

  return (
    <div className="w-full shrink-0 grid grid-cols-1 items-start md:grid-cols-12 gap-6">
      <section className="md:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200 bg-cardBg p-5 shadow-sm">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <i
                  className="fa-regular fa-file-lines text-lg"
                  aria-hidden="true"
                ></i>
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-textMain">
                  Attendance Breakdown
                </h2>
                <p className="mt-0.5 text-[11px] text-textMuted">
                  Selected day summary
                </p>
              </div>
            </div>
            <span
              id="selectedDateBadge"
              className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"
            >
              {selectedDate}
            </span>
          </div>

          <div className={`mb-3 flex min-h-[76px] flex-col justify-center rounded-xl border p-4 ${breakdownCardStyle}`}>
            <div className="flex items-start justify-between gap-2">
              <div
                id="shiftTitle"
                className={`min-w-0 text-sm font-bold ${shiftTitleColor}`}
              >
                {isAbsent ? "Marked Absent" : breakdownTitle}
              </div>
              {wageRateIndicator}
            </div>
            {isAbsent ? (
              <div className="mt-1 text-[11px] leading-relaxed text-rose-700">
                {record.holidayName
                  ? `${record.holidayName} · No attendance recorded`
                  : "Unexcused Absence — No Basic Pay"}
              </div>
            ) : shiftSubtitle ? (
              <div
                id="shiftSubTitle"
                className="mt-1 text-[11px] leading-relaxed text-textMuted"
              >
                {shiftSubtitle}
              </div>
            ) : null}
          </div>

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

          {/* Earnings and pay components */}
          <div
            className={`mb-3 min-h-[58px] rounded-xl border p-4 ${
              isAbsent
                ? "border-rose-200 bg-rose-50/40"
                : "border-teal-200 bg-teal-50/20"
            }`}
          >
            <div
              className={`flex items-center justify-between ${
                isPayComponentsExpanded
                  ? "mb-2 border-b border-slate-100 pb-2"
                  : "mb-0"
              }`}
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
              className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
              style={{
                gridTemplateRows: isPayComponentsExpanded ? "1fr" : "0fr",
                opacity: isPayComponentsExpanded ? 1 : 0,
              }}
              aria-hidden={!isPayComponentsExpanded}
            >
              <div
                id="payComponentsDetails"
                className="min-h-0 overflow-hidden"
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

          <div className="min-h-[46px] rounded-xl border border-slate-200 bg-white p-3">
            <div
              className={`flex items-center gap-2 transition-[margin] duration-300 ease-in-out ${
                isTimeAttendanceExpanded ? "mb-3" : ""
              }`}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400">
                <i className="fa-regular fa-clock text-sm" aria-hidden="true"></i>
              </span>
              <button
                type="button"
                aria-expanded={isTimeAttendanceExpanded}
                aria-controls="timeAttendanceDetails"
                onClick={() =>
                  setIsTimeAttendanceExpanded((expanded) => !expanded)
                }
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-700"
              >
                <span>Time &amp; Attendance</span>
                <i
                  className={`fa-solid fa-chevron-right text-[9px] transition-transform duration-300 ${
                    isTimeAttendanceExpanded ? "rotate-90" : ""
                  }`}
                  aria-hidden="true"
                ></i>
              </button>
              <span className={`ml-auto shrink-0 text-right text-[10px] font-bold ${isAbsent ? "text-rose-700" : "text-textMain"}`}>
                {isAbsent
                  ? "ABSENT"
                  : record.type === "Rest Day"
                    ? "--:-- -- - --:-- --"
                    : record.assigned}
              </span>
            </div>
            <div
              className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
              style={{
                gridTemplateRows: isTimeAttendanceExpanded ? "1fr" : "0fr",
                opacity: isTimeAttendanceExpanded ? 1 : 0,
              }}
              aria-hidden={!isTimeAttendanceExpanded}
            >
              <div
                id="timeAttendanceDetails"
                className="min-h-0 overflow-hidden space-y-2.5 text-[11px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-textMuted">First Time In</span>
                  <span
                    id="firstTimeIn"
                    className="text-right font-semibold text-teal-700"
                  >
                    {record.in}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-textMuted">Last Time Out</span>
                  <span
                    id="lastTimeOut"
                    className="text-right font-semibold text-teal-700"
                  >
                    {record.clockedIn ? "Tracking" : record.out}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                  <span className="text-textMuted">Status</span>
                  <div
                    id="statusBadgesContainer"
                    className="flex flex-wrap justify-end gap-1.5"
                  >
                    {record.badges.map((badge) => (
                      <span
                        key={badge.text}
                        title={badge.title}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${badge.color}`}
                      >
                        {badge.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              data-action="openManualEntryModal()"
              disabled={entryButtonDisabled}
              title={
                entryButtonDisabled
                  ? "Assign a shift to enable manual attendance entry"
                  : undefined
              }
              className="group flex min-h-[38px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:hover:border-slate-200 disabled:hover:bg-slate-100"
            >
              <i className="fa-solid fa-pen-to-square text-slate-400 group-hover:text-teal-600" aria-hidden="true"></i>
              <span>Manual Entry</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              data-action="openAssignShiftModal()"
              className="flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              <i
                className="fa-regular fa-calendar-days text-teal-600"
                aria-hidden="true"
              ></i>
              <span>Assign Shift</span>
            </button>
            <button
              type="button"
              data-action="clearSelectedShift()"
              disabled={!canClearShift}
              title={
                canClearShift
                  ? `Clear the shift, attendance, and leave for ${selectedDate}`
                  : "Clear is available for dates with a shift, attendance, or leave record and no active Time In"
              }
              className="flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none disabled:hover:bg-slate-50"
            >
              <i
                className="fa-regular fa-circle-xmark"
                aria-hidden="true"
              ></i>
              <span>Clear Shift</span>
            </button>
            <button
              type="button"
              data-action="openModal('grantLeaveModal')"
              className="flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
            >
              <i
                className="fa-solid fa-umbrella-beach text-amber-600"
                aria-hidden="true"
              ></i>
              <span>Grant Leave</span>
            </button>
            <button
              type="button"
              data-action="openMarkAbsentModal()"
              disabled={!canMarkAbsent}
              title={
                canMarkAbsent
                  ? `Mark ${selectedDate} absent`
                  : "This date cannot be marked absent"
              }
              className="flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-[11px] font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-slate-50"
            >
              <ShiftIcon
                icon="fa-user-xmark"
                size={14}
                className="text-rose-600"
              />
              <span>Mark Absent</span>
            </button>
          </div>
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
