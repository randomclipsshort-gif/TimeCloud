import AttendanceDashboard from "./attendance/AttendanceDashboard.jsx";
import FinancialDashboard from "./finance/FinancialDashboard.jsx";

export default function DashboardContent(props) {
  const {
    page,
    monthTabs,
    monthCarouselOffset,
    onMonthCarouselTransitionEnd,
    yearOptions,
    onYearChange,
    calendarCells,
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
    onOpenHolidayPaySettings,
    onTimeClockClick,
    monthLabel,
    year,
    record,
    expenseRows,
    expenses,
    totalExpenses,
    remaining,
    percentage,
    netPay,
    totalHours,
    formatCurrency,
    expenseName,
    setExpenseName,
    expenseAmount,
    setExpenseAmount,
    expenseCategory,
    setExpenseCategory,
  } = props;
  return (
    <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 flex flex-col gap-6">
      <div className="relative w-full overflow-x-clip">
        <div
          id="sliderTrack"
          className="flex transition-transform duration-500 ease-in-out w-full"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          <AttendanceDashboard
            record={record}
            selectedDate={selectedDate}
            isTimedIn={isTimedIn}
            canRecordAttendance={canRecordAttendance}
            canTimeIn={canTimeIn}
            canTimeOut={canTimeOut}
            earlyPunchWindowMinutes={earlyPunchWindowMinutes}
            holidayPayEstimate={holidayPayEstimate}
            estimatedEarnings={estimatedEarnings}
            dailyAllowance={dailyAllowance}
            holidayWorkedHours={holidayWorkedHours}
            nightDifferentialPay={nightDifferentialPay}
            overtimePay={overtimePay}
            overtimeCalculation={overtimeCalculation}
            configuredDailyWage={configuredDailyWage}
            onOpenHolidayPaySettings={onOpenHolidayPaySettings}
            onTimeClockClick={onTimeClockClick}
            monthTabs={monthTabs}
            monthCarouselOffset={monthCarouselOffset}
            onMonthCarouselTransitionEnd={onMonthCarouselTransitionEnd}
            yearOptions={yearOptions}
            onYearChange={onYearChange}
            calendarCells={calendarCells}
            monthLabel={monthLabel}
            year={year}
          />
          <FinancialDashboard
            expenseRows={expenseRows}
            expenses={expenses}
            totalExpenses={totalExpenses}
            remaining={remaining}
            percentage={percentage}
            netPay={netPay}
            totalHours={totalHours}
            monthLabel={monthLabel}
            formatCurrency={formatCurrency}
            expenseName={expenseName}
            setExpenseName={setExpenseName}
            expenseAmount={expenseAmount}
            setExpenseAmount={setExpenseAmount}
            expenseCategory={expenseCategory}
            setExpenseCategory={setExpenseCategory}
          />
        </div>
      </div>
      <div className="flex items-center justify-center pb-2 ">
        <div className="bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm flex items-center space-x-3">
          <button
            data-action="slidePage(0)"
            id="navDot0"
            className={
              page === 0
                ? "flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-teal-600 text-white shadow-xs"
                : "flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }
          >
            <i className="fa-solid fa-calendar-days"></i>
            <span>Time &amp; Calendar Hub</span>
          </button>
          <button
            data-action="slidePage(1)"
            id="navDot1"
            className={
              page === 1
                ? "flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-teal-600 text-white shadow-xs"
                : "flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }
          >
            <i className="fa-solid fa-wallet"></i>
            <span>Quick Stats &amp; Finance Hub</span>
          </button>
        </div>
      </div>
    </main>
  );
}
