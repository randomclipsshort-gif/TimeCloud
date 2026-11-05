import { useState } from "react";

export default function AttendanceDashboard({
  record,
  selectedDate,
  canClearShift,
  canRecordAttendance,
  salaryVaultStatus,
  holidayPayEstimate,
  estimatedEarnings,
  selectedDateIncentives,
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
  monthLabel,
  year,
}) {
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [isPayComponentsExpanded, setIsPayComponentsExpanded] = useState(false);
  const [isTimeAttendanceExpanded, setIsTimeAttendanceExpanded] = useState(false);
  const salaryDataPrivate = salaryVaultStatus !== "unlocked";
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
  const displayedHolidayPayRateLabel =
    salaryDataPrivate
      ? "Private — unlock salary vault"
      : record.holidayClassification === "Special Non-Working Day"
      ? record.holidayUnworked || record.type === "Absent"
        ? "0% total including base wage"
        : holidayPayEstimate?.regularPayRateLabel ||
          `${record.type === "Rest Day" ? 150 : 130}% total including base wage`
      : holidayPayRateLabel;
  const workdayBadgeLabel = record.holidayClassification || record.type;
  const workdayBadgeTextColor = record.holidayClassification
    ? holidayTextColors[record.holidayClassification] || "text-slate-700"
    : "text-slate-700";
  const shiftTitleColor = record.holidayName
    ? holidayTextColors[record.holidayClassification]
    : "text-textMain";
  const shiftTitle = record.shift === "Manual Entry Adjustment"
    ? record.assignedShiftName || "Assigned Shift"
    : record.shift;
  const breakdownTitle = record.holidayName ||
    (record.type === "Regular" ? "Regular Work Day" : shiftTitle);
  const shiftSubtitle = record.holidayName
    ? `${record.holidayDutyLabel === "Holiday Duty" ? record.assignedShiftName || record.shift : record.holidayDutyLabel} · ${record.shift}${record.holidayDescription ? ` · ${record.holidayDescription}` : ""}`
    : record.type === "Regular"
      ? [record.assignedShiftName || shiftTitle, record.shift !== (record.assignedShiftName || shiftTitle) ? record.shift : null]
          .filter(Boolean)
          .join(" · ")
      : null;
  const wageRateIndicator = (
    <span
      id="wageRateText"
      className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-teal-700"
    >
      <i
        className="fa-solid fa-percent text-[9px]"
        aria-hidden="true"
      ></i>
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

  return (
    <div className="w-full shrink-0 grid grid-cols-1 items-start md:grid-cols-12 gap-6">
      <section className="md:col-span-4 bg-cardBg rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <i
                  className="fa-solid fa-clipboard-list text-lg"
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

          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              {!record.holidayName &&
                !["Regular", "Unassigned"].includes(record.type) && (
                <span
                  id="workdayTypeBadge"
                  className={`rounded-full bg-white px-2.5 py-1 text-[10px] font-bold tracking-wide ring-1 ring-slate-200 ${workdayBadgeTextColor}`}
                >
                  {workdayBadgeLabel}
                </span>
              )}
            </div>
            <div className="flex items-start justify-between gap-2">
              <div
                id="shiftTitle"
                className={`min-w-0 text-sm font-bold ${shiftTitleColor}`}
              >
                {breakdownTitle}
              </div>
              {wageRateIndicator}
            </div>
            {shiftSubtitle && (
              <div
                id="shiftSubTitle"
                className="mt-1 text-[11px] leading-relaxed text-textMuted"
              >
                {shiftSubtitle}
              </div>
            )}
          </div>

          {/* Earnings and pay components */}
          <div className="mb-4 rounded-2xl border border-teal-100 bg-white p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
              <button
                type="button"
                aria-expanded={isPayComponentsExpanded}
                aria-controls="payComponentsDetails"
                onClick={() => setIsPayComponentsExpanded((expanded) => !expanded)}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                <span>Pay Components Breakdown</span>
                <i
                  className={`fa-solid ${isPayComponentsExpanded ? "fa-chevron-down" : "fa-chevron-right"} text-[9px] transition-transform duration-300`}
                  aria-hidden="true"
                ></i>
              </button>
              {!isPayComponentsExpanded ? (
                <span className="shrink-0 text-right text-xs font-extrabold tabular-nums text-teal-800">
                  {salaryDataPrivate
                    ? "Private — unlock salary vault"
                    : estimatedEarnings != null
                      ? `₱${estimatedEarnings.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
              <div id="payComponentsDetails" className="min-h-0 overflow-hidden">
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
                    className="font-semibold text-slate-800 shrink-0 tabular-nums"
                  >
                    {salaryDataPrivate ? "Private" : `+₱${allowanceAmount.toFixed(2)}`}
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
                    className="font-semibold text-slate-800 shrink-0 tabular-nums"
                  >
                    {salaryDataPrivate ? "Private" : `+₱${nightDifferentialAmount.toFixed(2)}`}
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
                    {salaryDataPrivate ? "Private" : `+₱${overtimeAmount.toFixed(2)}`}
                  </span>
                </div>
              )}

              {selectedDateIncentives.map((incentive) => (
                <div
                  key={incentive.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <span className="font-semibold text-slate-800">
                    {incentive.name}
                  </span>
                  <span className="shrink-0 font-semibold text-emerald-700 tabular-nums">
                    {salaryDataPrivate
                      ? "Private"
                      : `+₱${Number(incentive.amount).toFixed(2)}`}
                  </span>
                </div>
              ))}

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
                    ? "Private — unlock salary vault"
                    : estimatedEarnings != null
                    ? `₱${estimatedEarnings.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                  <span className="text-slate-600">{attendanceExceptions}</span>
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div
              className={`flex items-center gap-2 transition-[margin] duration-300 ease-in-out ${
                isTimeAttendanceExpanded ? "mb-3" : ""
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <i className="fa-regular fa-clock" aria-hidden="true"></i>
              </span>
              <button
                type="button"
                aria-expanded={isTimeAttendanceExpanded}
                aria-controls="timeAttendanceDetails"
                onClick={() => setIsTimeAttendanceExpanded((expanded) => !expanded)}
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
              <span className="ml-auto shrink-0 text-right text-[11px] font-semibold text-textMain">
                {record.assigned}
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

        <div className="space-y-3 pt-6 border-t border-slate-100 mt-6">
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
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2.5 px-3 rounded-xl text-xs transition border border-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:hover:bg-slate-100"
            >
              <i className="fa-solid fa-pen-to-square"></i>
              <span>Manual Entry</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-action="openAssignShiftModal()"
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium py-2 px-3 rounded-xl text-xs transition border border-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <i className="fa-regular fa-calendar-days text-teal-600"></i>
              <span>Assign Shift</span>
            </button>
            <button
              type="button"
              data-action="clearSelectedShift()"
              disabled={!canClearShift}
              title={
                canClearShift
                  ? `Clear the shift assigned to ${selectedDate}`
                  : "Clear is available only for dates with an assigned shift and no active Time In"
              }
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium py-2 px-3 rounded-xl text-xs transition border border-rose-200 flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:hover:bg-slate-50"
            >
              <i className="fa-regular fa-circle-xmark"></i>
              <span>Clear Shift</span>
            </button>
            <button
              type="button"
              data-action="openModal('grantLeaveModal')"
              className="col-span-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium py-2 px-3 rounded-xl text-xs transition border border-amber-200/60 flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-umbrella-beach text-amber-600"></i>
              <span>Grant Leave</span>
            </button>
          </div>
        </div>
      </section>

      <section className="md:col-span-8 lg:sticky md:top-20 md:self-start bg-cardBg rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
              Statutory Monthly Schedule
            </span>
            <div className="flex items-center space-x-2 mt-0.5">
              <h2
                id="calendarTitleMonth"
                className="text-lg font-bold text-textMain"
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
                className="flex items-center space-x-1 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
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
            <div
              id="monthTabsContainer"
              aria-label="Month navigation"
              className="relative flex w-[342px] max-w-full shrink-0 items-center overflow-hidden bg-slate-100 p-1 rounded-xl border border-slate-200"
            >
              <span aria-hidden="true" className="month-carousel-highlight" />
              <div className="w-full overflow-hidden">
                <div
                  className={`flex w-max shrink-0 gap-1 ${monthCarouselOffset ? "month-carousel-transition" : ""}`}
                  onTransitionEnd={onMonthCarouselTransitionEnd}
                  style={{
                    transform: `translateX(-${(1 + Math.abs(monthCarouselOffset) + monthCarouselOffset) * 48}px)`,
                  }}
                >
                  {monthTabs}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1 border-l border-slate-200 pl-2">
              <button
                type="button"
                aria-label="Previous month"
                title="Previous month"
                data-action="changeMonth(-1)"
                className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <button
                type="button"
                aria-label="Next month"
                title="Next month"
                data-action="changeMonth(1)"
                className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-bold text-textMuted py-3 border-b border-slate-100">
          <div>SUN</div>
          <div>MON</div>
          <div>TUE</div>
          <div>WED</div>
          <div>THU</div>
          <div>FRI</div>
          <div>SAT</div>
        </div>
        <div id="calendarGrid" className="grid grid-cols-7 gap-2.5 mt-3 flex-1">
          {calendarCells}
        </div>
      </section>
    </div>
  );
}
