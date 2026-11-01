import {
  formatPayrollPeriod,
  getNextPayrollPeriod,
  getPreviousPayrollPeriod,
} from "../../utils/payrollPeriods.js";

export default function FinancialDashboard({
  expenseRows,
  expenses,
  totalExpenses,
  remaining,
  percentage,
  netPay,
  grossPay,
  payrollDeductions,
  totalHours,
  monthLabel,
  payrollPeriod,
  payrollPeriodSummary,
  cutoffPayrollDeductions,
  payrollPeriodNetPay,
  payrollPeriodEarningsAvailable,
  salaryVaultStatus,
  currentDate,
  isCurrentPayrollPeriod,
  onPayrollPeriodChange,
  onPayrollPeriodSelect,
  formatCurrency,
  expenseName,
  setExpenseName,
  expenseAmount,
  setExpenseAmount,
  expenseCategory,
  setExpenseCategory,
}) {
  return (
    <div className="w-full shrink-0 flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-cardBg rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl">
            <i className="fa-solid fa-calendar-check"></i>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">
              Selected Month
            </span>
            <h4 className="text-[14px] font-bold text-slate-800 mt-0.5">
              {monthLabel}
            </h4>
            <span className="text-[10px] text-teal-600 font-semibold bg-teal-50 px-1.5 py-0.5 rounded">
              Earnings estimates
            </span>
          </div>
        </div>
        <div className="bg-cardBg rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
            <i className="fa-solid fa-money-bill-wave"></i>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">
              Gross Earnings Estimate
            </span>
            <h4 className="text-sm font-bold text-slate-800 mt-0.5">
              {formatCurrency(grossPay)}
            </h4>
            <span className="text-[10px] text-slate-400">
              {`${totalHours.toFixed(2)} Total Hours`}
            </span>
          </div>
        </div>
        <div className="bg-cardBg rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
            <i className="fa-solid fa-file-invoice-dollar"></i>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">
              Estimated Monthly Deductions
            </span>
            <h4 className="text-sm font-bold text-slate-800 mt-0.5">
              {formatCurrency(payrollDeductions.total)}
            </h4>
            <span className="text-[10px] text-rose-500 font-medium">
              SSS · PhilHealth · Pag-IBIG
            </span>
          </div>
        </div>
        <div className="bg-cardBg rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            <i className="fa-solid fa-wallet"></i>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">
              Net Earnings Estimate
            </span>
            <h4 className="text-sm font-bold text-emerald-600 mt-0.5">
              {formatCurrency(netPay)}
            </h4>
            <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
              Estimate only
            </span>
          </div>
        </div>
      </div>
      <section
        aria-labelledby="payroll-period-heading"
        className="bg-cardBg rounded-2xl border border-slate-200 p-5 shadow-sm"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
              Semi-monthly payroll
            </span>
            <h2 id="payroll-period-heading" className="text-lg font-bold text-textMain">
              Payroll cutoff period
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {formatPayrollPeriod(payrollPeriod)}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${isCurrentPayrollPeriod
                ? "bg-teal-50 text-teal-700"
                : "bg-slate-100 text-slate-600"
              }`}>
                {isCurrentPayrollPeriod ? "Current period" : "Selected period"}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Inclusive dates · Today: {new Intl.DateTimeFormat("en-PH", {
                timeZone: "Asia/Manila",
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(new Date(`${currentDate}T00:00:00Z`))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label="Previous payroll period"
              onClick={() => onPayrollPeriodChange(getPreviousPayrollPeriod(payrollPeriod))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <label className="sr-only" htmlFor="payroll-period-month">Payroll period month</label>
            <input
              id="payroll-period-month"
              type="month"
              value={payrollPeriod.endDate.slice(0, 7)}
              onChange={(event) => onPayrollPeriodSelect(
                event.target.value,
                Number(payrollPeriod.endDate.slice(8, 10)),
              )}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            />
            <label className="sr-only" htmlFor="payroll-period-cutoff">Payroll cutoff</label>
            <select
              id="payroll-period-cutoff"
              value={Number(payrollPeriod.endDate.slice(8, 10))}
              onChange={(event) => onPayrollPeriodSelect(
                payrollPeriod.endDate.slice(0, 7),
                Number(event.target.value),
              )}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="10">Cutoff: 10th</option>
              <option value="25">Cutoff: 25th</option>
            </select>
            <button
              type="button"
              aria-label="Next payroll period"
              onClick={() => onPayrollPeriodChange(getNextPayrollPeriod(payrollPeriod))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="block text-xs font-medium text-slate-500">Eligible workdays</span>
            <span className="mt-1 block text-xl font-bold text-slate-800">
              {payrollPeriodSummary.eligibleWorkdays}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="block text-xs font-medium text-slate-500">Regular hours</span>
            <span className="mt-1 block text-xl font-bold text-slate-800">
              {payrollPeriodSummary.regularHours.toFixed(2)}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="block text-xs font-medium text-slate-500">Recorded overtime</span>
            <span className="mt-1 block text-xl font-bold text-slate-800">
              {payrollPeriodSummary.overtimeHours.toFixed(2)}
            </span>
          </div>
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
            <span className="block text-xs font-medium text-teal-800">Gross earnings estimate</span>
            <span className="mt-1 block text-xl font-bold text-teal-800">
              {payrollPeriodEarningsAvailable
                ? formatCurrency(payrollPeriodSummary.recordedEarnings)
                : "Private"}
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
            <span className="block text-xs font-medium text-rose-800">Total cutoff deductions</span>
            <span className="mt-1 block text-xl font-bold text-rose-800">
              {payrollPeriodEarningsAvailable
                ? formatCurrency(cutoffPayrollDeductions.total)
                : "Private"}
            </span>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <span className="block text-xs font-medium text-amber-800">Employee contributions</span>
            <span className="mt-1 block text-xl font-bold text-amber-800">
              {payrollPeriodEarningsAvailable
                ? formatCurrency(cutoffPayrollDeductions.employeeContributionTotal)
                : "Private"}
            </span>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <span className="block text-xs font-medium text-emerald-800">Net pay after cutoff deductions</span>
            <span className="mt-1 block text-xl font-bold text-emerald-800">
              {payrollPeriodEarningsAvailable
                ? formatCurrency(payrollPeriodNetPay)
                : "Private"}
            </span>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">
            Cutoff deduction breakdown
          </h3>
          <div className="mt-3 divide-y divide-slate-100">
            {cutoffPayrollDeductions.items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <span className="font-semibold text-slate-700">
                  {item.label} employee contribution
                </span>
                <span className="text-slate-500">{item.frequencyLabel}</span>
                <span className="font-bold text-slate-800">
                  {payrollPeriodEarningsAvailable
                    ? formatCurrency(item.amount)
                    : "Private"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Only configured employee-paid contributions reduce net pay. Employer contributions are not modeled or deducted.
          </p>
        </div>
        {!payrollPeriodEarningsAvailable && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
            {salaryVaultStatus === "locked"
              ? "Unlock the salary vault to view private earnings estimates. Hours and workdays remain available."
              : "Private earnings estimates are unavailable until the salary vault is ready."}
          </p>
        )}
        {payrollPeriodSummary.incompleteClockOuts > 0 && (
          <p className="mt-3 text-xs text-amber-700" role="status">
            {payrollPeriodSummary.incompleteClockOuts} incomplete clock-out
            {payrollPeriodSummary.incompleteClockOuts === 1 ? "" : "s"} excluded from hours and earnings.
          </p>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Overnight shifts are split at cutoff boundaries, with recorded earnings apportioned by minutes worked. Workdays follow the shift-start date. These are estimates, not finalized payroll or a confirmed payday.
        </p>
      </section>
      <section className="bg-cardBg rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
              Financial Management Hub
            </span>
            <h2 className="text-lg font-bold text-textMain">
              Earnings Estimate &amp; Expense Tracker
            </h2>
          </div>
          <span className="text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1 rounded-lg">
            Recorded earnings and expenses
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-medium block">
              Net Earnings Estimate
            </span>
            <span
              id="trackerNetPay"
              className="text-2xl font-extrabold text-slate-800 mt-1 block"
            >
              {formatCurrency(netPay)}
            </span>
          </div>
          <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4">
            <span className="text-xs text-rose-700 font-medium block">
              Total Recorded Expenses
            </span>
            <span
              id="trackerTotalExpenses"
              className="text-2xl font-extrabold text-rose-600 mt-1 block"
            >
              {formatCurrency(totalExpenses)}
            </span>
          </div>
          <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4">
            <span className="text-xs text-teal-800 font-medium block">
              Remaining Balance
            </span>
            <span
              id="trackerRemaining"
              className={
                remaining < 0
                  ? "text-2xl font-extrabold text-rose-600 mt-1 block"
                  : "text-2xl font-extrabold text-teal-700 mt-1 block"
              }
            >
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>
        <div className="mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
            <span className="flex items-center space-x-1.5">
              <i className="fa-solid fa-chart-pie text-teal-600"></i>
              <span>Budget Utilization</span>
            </span>
            <span id="trackerPercentage" className="text-teal-700 font-bold">
              {`${percentage.toFixed(1)}% Spent`}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-300">
            <div
              id="trackerProgressBar"
              className={`h-full rounded-full transition-all duration-500 ${percentage > 85 ? "bg-rose-500" : percentage > 60 ? "bg-amber-500" : "bg-teal-600"}`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <i className="fa-solid fa-circle-plus text-teal-600 text-sm"></i>
              <span>Add New Expense Entry</span>
            </h3>
            <div>
              <label
                className="block text-[11px] font-semibold text-slate-600 mb-1"
                htmlFor="expenseName"
              >
                Expense Description
              </label>
              <input
                type="text"
                id="expenseName"
                value={expenseName}
                onChange={(event) => setExpenseName(event.target.value)}
                placeholder="e.g., Weekly Groceries, Electricity"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                  htmlFor="expenseAmount"
                >
                  Amount (₱)
                </label>
                <input
                  type="number"
                  id="expenseAmount"
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
                />
              </div>
              <div>
                <label
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                  htmlFor="expenseCategory"
                >
                  Category
                </label>
                <select
                  id="expenseCategory"
                  value={expenseCategory}
                  onChange={(event) => setExpenseCategory(event.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
                >
                  <option value="Utilities">Utilities</option>
                  <option value="Food &amp; Groceries">
                    Food &amp; Groceries
                  </option>
                  <option value="Transport">Transport</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              data-action="addExpense()"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-lg text-xs transition shadow-sm cursor-pointer flex items-center justify-center space-x-2"
            >
              <i className="fa-solid fa-plus"></i>
              <span>Save Expense Record</span>
            </button>
          </div>
          <div className="lg:col-span-7 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <i className="fa-solid fa-list text-teal-600"></i>
                <span>Itemized Expense Ledger</span>
              </h3>
              <span
                id="expenseCountBadge"
                className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium"
              >
                {`${expenses.length} item${expenses.length === 1 ? "" : "s"}`}
              </span>
            </div>
            <div className="overflow-y-auto max-h-[260px] border border-slate-200 rounded-xl bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 font-semibold">Description</th>
                    <th className="p-3 font-semibold">Category</th>
                    <th className="p-3 font-semibold text-right">Amount</th>
                    <th className="p-3 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody
                  id="expenseTableBody"
                  className="divide-y divide-slate-100 text-slate-700"
                >
                  {expenseRows}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
