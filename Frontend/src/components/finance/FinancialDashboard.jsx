export default function FinancialDashboard({
  expenseRows,
  monthExpenses,
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
              Tracking Period
            </span>
            <h4 className="text-[14px] font-bold text-slate-800 mt-0.5">
              {financePeriodLabel}
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
              {financeTrackingScope === "month"
                ? "Estimated Monthly Deductions"
                : "Estimated Cutoff Deductions"}
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
          <div className="flex flex-col sm:items-end gap-2">
            <span className="text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1 rounded-lg">
              {`Recorded earnings and expenses · ${financePeriodLabel}`}
            </span>
            <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Finance tracking period">
              {[
                { value: "cutoff-10", label: "1st cutoff (26–10)" },
                { value: "cutoff-25", label: "2nd cutoff (11–25)" },
                { value: "month", label: "Full month" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={financeTrackingScope === option.value}
                  onClick={() => setFinanceTrackingScope(option.value)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    financeTrackingScope === option.value
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
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
              style={{ width: `${Math.min(percentage, 100)}%` }}
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
                htmlFor="expenseDate"
              >
                Expense Date
              </label>
              <input
                type="date"
                id="expenseDate"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
              />
            </div>
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
                {`${monthExpenses.length} item${monthExpenses.length === 1 ? "" : "s"}`}
              </span>
            </div>
            <div className="overflow-y-auto max-h-[260px] border border-slate-200 rounded-xl bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 font-semibold">Description</th>
                    <th className="p-3 font-semibold">Date</th>
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
