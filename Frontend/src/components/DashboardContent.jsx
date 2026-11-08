import AttendanceDashboard from "./attendance/AttendanceDashboard.jsx";
import FinancialDashboard from "./finance/FinancialDashboard.jsx";
import { CalendarDays, Wallet } from "lucide-react";

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
    <main className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-1 flex-col gap-6 p-4 sm:p-6">
      <nav className="flex justify-center" aria-label="Dashboard pages">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
          {[
            { pageIndex: 0, label: "Time & Calendar Hub", Icon: CalendarDays },
            { pageIndex: 1, label: "Quick Stats & Finance Hub", Icon: Wallet },
          ].map(({ pageIndex, label, Icon }) => (
            <button
              key={pageIndex}
              type="button"
              data-action={`slidePage(${pageIndex})`}
              id={`navDot${pageIndex}`}
              aria-current={page === pageIndex ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                page === pageIndex
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </nav>
      <div className="relative isolate w-full overflow-x-clip overflow-y-visible">
        <div
          id="sliderTrack"
          className={`w-full transition-transform duration-500 ease-in-out ${
            page === 0
              ? "relative z-10 translate-x-0 bg-slate-50"
              : "absolute left-0 top-0 z-0 -translate-x-full"
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
              ? "relative z-10 translate-x-0 bg-slate-50"
              : "absolute left-0 top-0 z-0 translate-x-full"
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
            onAddIncentive={onAddIncentive}
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
