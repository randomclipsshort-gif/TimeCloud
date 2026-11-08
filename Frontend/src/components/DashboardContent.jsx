import AttendanceDashboard from "./attendance/AttendanceDashboard.jsx";
import FinancialDashboard from "./finance/FinancialDashboard.jsx";

export default function DashboardContent(props) {
  const {
    page,
    requestConfirmation,
    monthTabs,
    monthCarouselOffset,
    onMonthCarouselTransitionEnd,
    yearOptions,
    onYearChange,
    calendarCells,
    selectedDate,
    canClearShift,
    canRecordAttendance,
    salaryVaultStatus,
    holidayPayEstimate,
    estimatedEarnings,
    selectedDateIncentives,
    dailyAllowance,
    holidayWorkedHours,
    nightDifferentialPay,
    overtimePay,
    overtimeCalculation,
    configuredDailyWage,
    onOpenHolidayPaySettings,
    monthLabel,
    monthValue,
    year,
    record,
    monthExpenses,
    expenses,
    financeTrackingScope,
    setFinanceTrackingScope,
    financePeriodLabel,
    totalExpenses,
    remaining,
    percentage,
    netPay,
    grossPay,
    payrollDeductions,
    totalHours,
    formatCurrency,
    expenseName,
    setExpenseName,
    expenseAmount,
    setExpenseAmount,
    expenseDate,
    setExpenseDate,
    expenseCategory,
    setExpenseCategory,
    onDeleteExpense,
    employeeIncentives,
    onAddIncentive,
    onDeleteIncentive,
    salaryVaultError,
    workspaceLoading,
    workspaceError,
    workspaceSaveError,
    historicalPayslips,
    payslipHistorySaving,
    currentPayrollPeriod,
    onViewCurrentPayslip,
    onViewHistoricalPayslip,
    onDeleteHistoricalPayslip,
    travelPlans,
    today,
    onCreateTravelPlan,
    onUpdateTravelPlan,
    onCompleteTravelPlan,
    onDeleteTravelPlan,
    onAddTravelExpense,
    onUpdateTravelExpense,
    onDeleteTravelExpense,
  } = props;
  return (
    <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 flex flex-col gap-6">
      <nav
        className="flex justify-center"
        aria-label="Dashboard pages"
      >
        <div className="flex items-center space-x-3 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            data-action="slidePage(0)"
            id="navDot0"
            aria-current={page === 0 ? "page" : undefined}
            className={
              page === 0
                ? "flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-teal-600 text-white shadow-xs"
                : "flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }
          >
            <i className="fa-solid fa-calendar-days" aria-hidden="true"></i>
            <span>Time &amp; Calendar Hub</span>
          </button>
          <button
            type="button"
            data-action="slidePage(1)"
            id="navDot1"
            aria-current={page === 1 ? "page" : undefined}
            className={
              page === 1
                ? "flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-teal-600 text-white shadow-xs"
                : "flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }
          >
            <i className="fa-solid fa-wallet" aria-hidden="true"></i>
            <span>Quick Stats &amp; Finance Hub</span>
          </button>
        </div>
      </nav>
      <div className="relative w-full overflow-x-clip overflow-y-clip">
        <div
          id="sliderTrack"
          className={`w-full transition-transform duration-500 ease-in-out ${
            page === 0
              ? "relative translate-x-0"
              : "absolute left-0 top-0 -translate-x-full"
          }`}
        >
          <AttendanceDashboard
            record={record}
            selectedDate={selectedDate}
            canClearShift={canClearShift}
            canRecordAttendance={canRecordAttendance}
            salaryVaultStatus={salaryVaultStatus}
            holidayPayEstimate={holidayPayEstimate}
            estimatedEarnings={estimatedEarnings}
            selectedDateIncentives={selectedDateIncentives}
            onAddIncentive={onAddIncentive}
            dailyAllowance={dailyAllowance}
            holidayWorkedHours={holidayWorkedHours}
            nightDifferentialPay={nightDifferentialPay}
            overtimePay={overtimePay}
            overtimeCalculation={overtimeCalculation}
            configuredDailyWage={configuredDailyWage}
            onOpenHolidayPaySettings={onOpenHolidayPaySettings}
            monthTabs={monthTabs}
            monthCarouselOffset={monthCarouselOffset}
            onMonthCarouselTransitionEnd={onMonthCarouselTransitionEnd}
            yearOptions={yearOptions}
            onYearChange={onYearChange}
            calendarCells={calendarCells}
            monthLabel={monthLabel}
            year={year}
          />
        </div>
        <div
          className={`w-full transition-transform duration-500 ease-in-out ${
            page === 1
              ? "relative translate-x-0"
              : "absolute left-0 top-0 translate-x-full"
          }`}
        >
          <FinancialDashboard
            requestConfirmation={requestConfirmation}
            monthExpenses={monthExpenses}
            expenses={expenses}
            financeTrackingScope={financeTrackingScope}
            setFinanceTrackingScope={setFinanceTrackingScope}
            financePeriodLabel={financePeriodLabel}
            totalExpenses={totalExpenses}
            remaining={remaining}
            percentage={percentage}
            netPay={netPay}
            grossPay={grossPay}
            payrollDeductions={payrollDeductions}
            totalHours={totalHours}
            monthValue={monthValue}
            formatCurrency={formatCurrency}
            expenseName={expenseName}
            setExpenseName={setExpenseName}
            expenseAmount={expenseAmount}
            setExpenseAmount={setExpenseAmount}
            expenseDate={expenseDate}
            setExpenseDate={setExpenseDate}
            expenseCategory={expenseCategory}
            setExpenseCategory={setExpenseCategory}
            onDeleteExpense={onDeleteExpense}
            employeeIncentives={employeeIncentives}
            onDeleteIncentive={onDeleteIncentive}
            workspaceLoading={workspaceLoading}
            workspaceError={workspaceError}
            workspaceSaveError={workspaceSaveError}
            historicalPayslips={historicalPayslips}
            payslipHistorySaving={payslipHistorySaving}
            salaryVaultStatus={salaryVaultStatus}
            salaryVaultError={salaryVaultError}
            currentPayrollPeriod={currentPayrollPeriod}
            onViewCurrentPayslip={onViewCurrentPayslip}
            onViewHistoricalPayslip={onViewHistoricalPayslip}
            onDeleteHistoricalPayslip={onDeleteHistoricalPayslip}
            travelPlans={travelPlans}
            today={today}
            onCreateTravelPlan={onCreateTravelPlan}
            onUpdateTravelPlan={onUpdateTravelPlan}
            onCompleteTravelPlan={onCompleteTravelPlan}
            onDeleteTravelPlan={onDeleteTravelPlan}
            onAddTravelExpense={onAddTravelExpense}
            onUpdateTravelExpense={onUpdateTravelExpense}
            onDeleteTravelExpense={onDeleteTravelExpense}
          />
        </div>
      </div>
    </main>
  );
}
