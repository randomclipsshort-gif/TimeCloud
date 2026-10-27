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

  return (
    <div className="w-full shrink-0 grid grid-cols-1 items-start md:grid-cols-12 gap-6">
      <section className="md:col-span-4 bg-cardBg rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div>
              <h2 className="text-lg font-bold text-textMain">
                Attendance Breakdown
              </h2>
            </div>
            <span
              id="selectedDateBadge"
              className="text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md"
            >
              {selectedDate}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <span
                id="workdayTypeBadge"
                className={`text-xs font-bold tracking-wider ${workdayBadgeTextColor}`}
              >
                {workdayBadgeLabel}
              </span>
              <span
                id="wageRateText"
                className="text-xs font-semibold text-teal-700"
              >
                {`Wage Rate: ${holidayRateLabel}`}
              </span>
            </div>
            <div
              id="shiftTitle"
              className={`text-base font-bold ${shiftTitleColor}`}
            >
              {record.holidayName || record.shift}
            </div>
            <div id="shiftSubTitle" className="text-xs text-textMuted mt-0.5">
              {record.holidayName
                ? `${record.holidayDutyLabel} · ${record.shift}${record.holidayDescription ? ` · ${record.holidayDescription}` : ""}`
                : record.wageRate}
            </div>
          </div>
          <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4 mb-6">
            <div className="mb-3 border-b border-teal-100/60 pb-4">
              <div className="flex flex-col items-start gap-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-teal-800">
                  Estimated Daily Earnings
                </span>
                <span
                  id="estEarnings"
                  className="text-2xl leading-tight font-extrabold tracking-tight text-teal-800"
                >
                  {estimatedEarnings != null
                    ? `₱${estimatedEarnings.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : record.holidayClassification
                      ? "Estimate unavailable"
                      : record.est}
                </span>
              </div>
              {record.holidayClassification && (
                <div className="mt-1 text-xs font-medium text-teal-700">
                  {`${record.holidayClassification} · ${holidayWorkedHours ?? 0} ${holidayWorkedHours === 1 ? "hour" : "hours"} worked`}
                </div>
              )}
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between py-1.5 font-semibold text-slate-700">
                <span>Base Daily Wage (8 hrs):</span>
                <span id="baseWage" className="text-slate-900">
                  {record.holidayClassification || record.type === "Unassigned"
                    ? Number(configuredDailyWage) > 0
                      ? `₱${Number(configuredDailyWage).toFixed(2)}`
                      : record.holidayClassification
                        ? "Required for estimate"
                        : record.base
                    : record.base}
                </span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Co. Allowance:</span>
                <span
                  id="companyAllowance"
                  className="font-medium text-slate-800"
                >
                  {!["Absent", "Rest Day"].includes(record.type) &&
                  !record.holidayUnworked &&
                  Number.isFinite(Number(dailyAllowance)) &&
                  Number(dailyAllowance) >= 0
                    ? `₱${Number(dailyAllowance).toFixed(2)}`
                    : "—"}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t border-teal-100/80 pt-2 text-slate-600">
                <span className="flex flex-col">
                  <span>Holiday Pay:</span>
                  {displayedHolidayPayRateLabel && (
                    <span className="text-[10px] text-teal-700">
                      {displayedHolidayPayRateLabel}
                    </span>
                  )}
                </span>
                <span id="holidayPay" className="font-medium text-teal-700">
                  {record.holidayClassification
                    ? holidayPayEstimate?.regularPay != null
                      ? `₱${holidayPayEstimate.regularPay.toFixed(2)}`
                      : "See estimate details"
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Night Differential:</span>
                <span
                  id="nightDifferentialPay"
                  className="font-medium text-teal-700"
                >
                  {nightDifferentialPay != null
                    ? `₱${nightDifferentialPay.toFixed(2)}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span className="flex flex-col">
                  <span>Overtime:</span>
                  {overtimeCalculation && (
                    <span className="text-[10px] text-slate-500">
                      {overtimeCalculation}
                    </span>
                  )}
                </span>
                <span id="overtimePay" className="font-medium text-teal-700">
                  {overtimePay != null
                    ? `₱${overtimePay.toFixed(2)}`
                    : record.holidayClassification &&
                        holidayPayEstimate?.amount === null
                      ? "See estimate details"
                      : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Late / Undertime Penalty:</span>
                <span id="penaltyPay" className="font-medium text-slate-700">
                  —
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-3 text-xs border-t border-slate-100 pt-5">
            <div className="flex justify-between py-1">
              <span className="text-textMuted">Assigned Shift:</span>
              <span
                id="assignedShiftTime"
                className="font-semibold text-textMain"
              >
                {record.assigned}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-textMuted">First Time In:</span>
              <span id="firstTimeIn" className="font-semibold text-teal-700">
                {record.in}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-textMuted">Last Time Out:</span>
              <span id="lastTimeOut" className="font-semibold text-teal-700">
                {record.clockedIn ? "Tracking" : record.out}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-textMuted">Status Badges:</span>
              <div
                id="statusBadgesContainer"
                className="flex space-x-1.5 flex-wrap gap-y-1"
              >
                {record.badges.map((badge) => (
                  <span
                    key={badge.text}
                    title={badge.title}
                    className={`px-2 py-0.5 text-[10px] font-bold ${badge.color} rounded`}
                  >
                    {badge.text}
                  </span>
                ))}
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
