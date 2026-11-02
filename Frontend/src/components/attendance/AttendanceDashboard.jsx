import { useState } from "react";

export default function AttendanceDashboard({
  record,
  selectedDate,
  isTimedIn,
  canRecordAttendance,
  canTimeIn,
  canTimeOut,
  earlyPunchWindowMinutes,
  holidayPayEstimate,
  estimatedEarnings,
  dailyAllowance,
  holidayWorkedHours,
  nightDifferentialPay,
  nightDifferentialCalculation,
  overtimePay,
  overtimeCalculation,
  configuredDailyWage,
  onTimeClockClick,
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
    record.holidayClassification === "Special Non-Working Day"
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
  const timeClockDisabled = isTimedIn ? !canTimeOut : !canTimeIn;
  const entryButtonDisabled = !canRecordAttendance;
  const getNumericAmount = (value) => {
    const amount = Number(String(value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(amount) ? amount : 0;
  };
  const displayedOvertimePay = overtimePay != null && Number.isFinite(Number(overtimePay))
    ? Number(overtimePay)
    : null;
  const displayedNightDifferentialPay =
    nightDifferentialPay != null && Number.isFinite(Number(nightDifferentialPay))
    ? Number(nightDifferentialPay)
    : null;
  const allowanceAmount = Number(dailyAllowance);
  const allowanceIncluded = record.holidayClassification
    ? record.type !== "Absent" && Number.isFinite(allowanceAmount) && allowanceAmount >= 0
    : !["Absent", "Rest Day"].includes(record.type) &&
      !record.holidayUnworked &&
      Number.isFinite(allowanceAmount) &&
      allowanceAmount >= 0;
  const startingPay = record.holidayClassification
    ? holidayPayEstimate?.regularPay
    : Math.max(
      0,
      getNumericAmount(record.est) -
        (Number(record.overtimeAmount) || 0) -
        (displayedNightDifferentialPay || 0),
    );
  const hasAllowance = allowanceIncluded && allowanceAmount > 0;
  const hasNightDifferential = displayedNightDifferentialPay > 0;
  const hasOvertime = displayedOvertimePay > 0;
  const lateMinutes = Number(record.lateMinutes);
  const undertimeMinutes = Number(record.undertimeMinutes);
  const hasLateOrUndertime = Boolean(
    record.late || record.undertime ||
    (Number.isFinite(lateMinutes) && lateMinutes > 0) ||
    (Number.isFinite(undertimeMinutes) && undertimeMinutes > 0),
  );

  return (
    <div className="w-full shrink-0 grid grid-cols-1 items-start md:grid-cols-12 gap-6">
      <section className="md:col-span-4 bg-cardBg rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <i className="fa-solid fa-clipboard-list text-lg" aria-hidden="true"></i>
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
              <span
                id="workdayTypeBadge"
                className={`rounded-full bg-white px-2.5 py-1 text-[10px] font-bold tracking-wide ring-1 ring-slate-200 ${workdayBadgeTextColor}`}
              >
                {workdayBadgeLabel}
              </span>
              <span
                id="wageRateText"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700"
              >
                <i className="fa-solid fa-percent text-[9px]" aria-hidden="true"></i>
                {`Wage Rate: ${holidayRateLabel}`}
              </span>
            </div>
            <div
              id="shiftTitle"
              className={`text-sm font-bold ${shiftTitleColor}`}
            >
              {record.holidayName || record.shift}
            </div>
            <div id="shiftSubTitle" className="mt-1 text-[11px] leading-relaxed text-textMuted">
              {record.holidayName
                ? `${record.holidayDutyLabel} · ${record.shift}${record.holidayDescription ? ` · ${record.holidayDescription}` : ""}`
                : record.wageRate}
            </div>
          </div>
          <div className="mb-4 overflow-hidden rounded-2xl border border-teal-100 bg-white">
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800">
                    Estimated Daily Earnings
                  </span>
                  <span
                    id="estEarnings"
                    className="mt-1 block text-2xl font-extrabold leading-tight tracking-tight text-teal-800"
                  >
                    {estimatedEarnings != null
                      ? `₱${estimatedEarnings.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : record.holidayClassification
                        ? "Estimate unavailable"
                        : record.est}
                  </span>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-teal-700 shadow-sm">
                  <i className="fa-solid fa-wallet" aria-hidden="true"></i>
                </span>
              </div>
              {record.holidayClassification && (
                <div className="mt-2 text-[10px] font-medium text-teal-700">
                  {`${record.holidayClassification} · ${holidayWorkedHours ?? 0} ${holidayWorkedHours === 1 ? "hour" : "hours"} worked`}
                </div>
              )}
              <div className="mt-2 text-[10px] text-slate-600">
                Starting pay + additions − deductions
              </div>
            </div>
            <div className="space-y-4 p-4 text-[11px]">
              {record.holidayClassification && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Holiday calculation reference · not added separately
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">Base daily wage · 8 hrs</span>
                    <span id="baseWage" className="font-semibold text-slate-800">
                      {Number(configuredDailyWage) > 0
                        ? `₱${Number(configuredDailyWage).toFixed(2)}`
                        : "Required for estimate"}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <h4 className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Starting pay
                </h4>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold text-teal-900">
                      {record.holidayClassification ? "Holiday pay total" : "Base pay"}
                    </span>
                    <span className="mt-1 text-[9px] leading-snug text-teal-800">
                      {record.holidayClassification
                        ? `${displayedHolidayPayRateLabel || "Includes base wage"} · replaces base pay`
                        : "For the recorded shift"}
                    </span>
                  </span>
                  <span
                    id={record.holidayClassification ? "holidayPay" : "basePay"}
                    className="shrink-0 text-right font-bold text-teal-800"
                  >
                    {record.holidayClassification
                      ? holidayPayEstimate?.regularPay != null
                        ? `₱${holidayPayEstimate.regularPay.toFixed(2)}`
                        : "See estimate details"
                      : startingPay != null
                        ? `₱${startingPay.toFixed(2)}`
                        : "—"}
                  </span>
                </div>
              </div>

              {(hasAllowance || hasNightDifferential || hasOvertime) && (
              <div>
                <h4 className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Added to starting pay
                </h4>
                <div className="divide-y divide-slate-100">
                  {hasAllowance && (
                  <div className="flex justify-between gap-3 py-2.5">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-slate-700">+ Company allowance</span>
                      <span className="mt-0.5 text-[9px] text-slate-500">Added separately</span>
                    </span>
                    <span id="companyAllowance" className="font-semibold text-slate-800">
                      {allowanceIncluded ? `+₱${allowanceAmount.toFixed(2)}` : "—"}
                    </span>
                  </div>
                  )}
                  {hasNightDifferential && (
                  <div className="flex justify-between gap-3 py-2.5">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-slate-700">+ Night differential</span>
                      <span className="mt-0.5 text-[9px] leading-snug text-slate-500">
                        {nightDifferentialCalculation || "No night differential calculated"}
                      </span>
                    </span>
                    <span id="nightDifferentialPay" className="shrink-0 font-semibold text-slate-800">
                      {displayedNightDifferentialPay != null
                        ? `+₱${displayedNightDifferentialPay.toFixed(2)}`
                        : "—"}
                    </span>
                  </div>
                  )}
                  {hasOvertime && (
                  <div className="flex justify-between gap-3 py-2.5">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-slate-700">+ Overtime</span>
                      <span className="mt-0.5 text-[9px] leading-snug text-slate-500">
                        {overtimeCalculation ||
                          (displayedOvertimePay > 0
                            ? "Recorded overtime amount"
                            : "No overtime recorded")}
                      </span>
                    </span>
                    <span id="overtimePay" className="shrink-0 font-semibold text-slate-800">
                      {displayedOvertimePay != null
                        ? `+₱${displayedOvertimePay.toFixed(2)}`
                        : record.holidayClassification &&
                            holidayPayEstimate?.amount === null
                          ? "See estimate details"
                          : "—"}
                    </span>
                  </div>
                  )}
                </div>
              </div>
              )}

              {hasLateOrUndertime && (
              <div className="border-t border-slate-200 pt-3">
                <h4 className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Deductions
                </h4>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                  <span className="flex flex-col">
                    <span className="text-slate-700">Late / undertime</span>
                    <span className="mt-0.5 text-[9px] text-slate-500">
                      No deduction configured
                    </span>
                  </span>
                  <span id="penaltyPay" className="font-semibold text-slate-500">
                    Not deducted
                  </span>
                </div>
              </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <i className="fa-regular fa-clock" aria-hidden="true"></i>
              </span>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Time &amp; Attendance
              </h3>
            </div>
            <div className="space-y-2.5 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-textMuted">Assigned Shift</span>
                <span id="assignedShiftTime" className="text-right font-semibold text-textMain">
                  {record.assigned}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-textMuted">First Time In</span>
                <span id="firstTimeIn" className="text-right font-semibold text-teal-700">
                  {record.in}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-textMuted">Last Time Out</span>
                <span id="lastTimeOut" className="text-right font-semibold text-teal-700">
                  {record.clockedIn ? "Tracking" : record.out}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                <span className="text-textMuted">Status</span>
                <div id="statusBadgesContainer" className="flex flex-wrap justify-end gap-1.5">
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
        <div className="space-y-3 pt-6 border-t border-slate-100 mt-6">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onTimeClockClick}
              disabled={timeClockDisabled}
              title={
                timeClockDisabled
                  ? isTimedIn
                    ? "Time Out is available until the assigned shift ends"
                    : `Time In is available on the scheduled date, from ${earlyPunchWindowMinutes} minutes before the shift until shift end`
                  : undefined
              }
              className={`${isTimedIn ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-600 hover:bg-teal-700"} text-white font-medium py-2.5 px-3 rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:hover:bg-slate-300`}
            >
              <i
                className={`fa-solid ${isTimedIn ? "fa-right-from-bracket" : "fa-right-to-bracket"}`}
              ></i>
              <span>{isTimedIn ? "Time Out" : "Time In"}</span>
            </button>
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
              data-action="openAssignShiftModal()"
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium py-2 px-3 rounded-xl text-xs transition border border-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <i className="fa-regular fa-calendar-days text-teal-600"></i>
              <span>Assign Shift</span>
            </button>
            <button
              data-action="openModal(&#x27;grantLeaveModal&#x27;)"
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium py-2 px-3 rounded-xl text-xs transition border border-amber-200/60 flex items-center justify-center space-x-1.5 cursor-pointer"
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
