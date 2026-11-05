import { useEffect, useMemo, useState } from "react";
import { getExpenseDate } from "../../utils/expenseTracker.js";
import EmployeeIncentives from "./EmployeeIncentives.jsx";
import { formatPayrollPeriod } from "../../utils/payrollPeriods.js";

export default function FinancialDashboard({
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
  monthValue,
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
  onDeleteIncentive,
  workspaceLoading,
  workspaceError,
  workspaceSaveError,
  historicalPayslips,
  payslipHistorySaving,
  salaryVaultStatus,
  salaryVaultError,
  currentPayrollPeriod,
  onViewCurrentPayslip,
  onViewHistoricalPayslip,
  onDeleteHistoricalPayslip,
}) {
  const [activeTab, setActiveTab] = useState("expenses");
  const [expenseFilterMode, setExpenseFilterMode] = useState("month");
  const [expenseMonth, setExpenseMonth] = useState(monthValue);
  const [expenseYear, setExpenseYear] = useState(monthValue.slice(0, 4));
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [payslipFilterMode, setPayslipFilterMode] = useState("all");
  const [payslipMonth, setPayslipMonth] = useState(monthValue);
  const [payslipYear, setPayslipYear] = useState(monthValue.slice(0, 4));
  const [payslipCutoff, setPayslipCutoff] = useState("all");

  useEffect(() => {
    if (expenseFilterMode === "month") setExpenseMonth(monthValue);
    if (expenseFilterMode === "year") setExpenseYear(monthValue.slice(0, 4));
    if (payslipFilterMode === "month") setPayslipMonth(monthValue);
    if (payslipFilterMode === "year") setPayslipYear(monthValue.slice(0, 4));
  }, [expenseFilterMode, monthValue, payslipFilterMode]);

  const validExpenses = useMemo(
    () => expenses.filter((expense) => getExpenseDate(expense)),
    [expenses],
  );
  const filteredExpenses = useMemo(() => validExpenses.filter((expense) => {
    const date = getExpenseDate(expense);
    if (expenseCategoryFilter !== "all" && expense.category !== expenseCategoryFilter) {
      return false;
    }
    if (expenseFilterMode === "period") {
      return monthExpenses.some((item) => item.id === expense.id);
    }
    if (expenseFilterMode === "month") return date.startsWith(`${expenseMonth}-`);
    if (expenseFilterMode === "year") return date.startsWith(`${expenseYear}-`);
    if (expenseFilterMode === "range") {
      return (!rangeStart || date >= rangeStart) && (!rangeEnd || date <= rangeEnd);
    }
    return true;
  }).sort((left, right) =>
    (getExpenseDate(right) || "").localeCompare(getExpenseDate(left) || ""),
  ), [
    expenseCategoryFilter,
    expenseFilterMode,
    expenseMonth,
    expenseYear,
    monthExpenses,
    rangeEnd,
    rangeStart,
    validExpenses,
  ]);
  const filteredExpenseTotal = filteredExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0,
  );
  const historicalExpenseTotal = validExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0,
  );
  const privateSalaryDataHidden = ["locked", "unavailable", "loading"].includes(
    salaryVaultStatus,
  );
  const expensesHidden = salaryVaultStatus !== "unlocked";
  const filteredPayslips = historicalPayslips.filter((snapshot) => {
    const endDate = snapshot.period.endDate;
    if (payslipFilterMode === "month" && !endDate.startsWith(`${payslipMonth}-`)) {
      return false;
    }
    if (payslipFilterMode === "year" && !endDate.startsWith(`${payslipYear}-`)) return false;
    if (payslipCutoff === "10" && !endDate.endsWith("-10")) return false;
    if (payslipCutoff === "25" && !endDate.endsWith("-25")) return false;
    return true;
  }).sort((left, right) =>
    right.period.endDate.localeCompare(left.period.endDate),
  );

  return (
    <div className="w-full shrink-0 flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-cardBg rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
            <i className="fa-solid fa-money-bill-wave"></i>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">
              Gross Earnings Estimate
            </span>
            <h4 className="text-sm font-bold text-slate-800 mt-0.5">
              {privateSalaryDataHidden ? "Private — unlock vault" : formatCurrency(grossPay)}
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
              {privateSalaryDataHidden ? "Private — unlock vault" : formatCurrency(payrollDeductions.total)}
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
              {privateSalaryDataHidden ? "Private — unlock vault" : formatCurrency(netPay)}
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
        <div className="mb-6 flex gap-2 border-b border-slate-100 pb-3" role="tablist" aria-label="Financial history sections">
          {[
            { id: "expenses", label: "Expenses", icon: "fa-receipt" },
            { id: "incentives", label: "Incentives", icon: "fa-gift" },
            { id: "payslips", label: "Payslips", icon: "fa-file-invoice-dollar" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                activeTab === tab.id
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <i className={`fa-solid ${tab.icon}`} aria-hidden="true"></i>
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === "expenses" ? (
          expensesHidden ? (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
              role="status"
            >
              <p className="font-semibold">Expenses and ledger are private.</p>
              <p className="mt-1 text-xs">
                {salaryVaultStatus === "unavailable"
                  ? "The salary vault is unavailable until the required Supabase migration is applied."
                  : salaryVaultStatus === "uninitialized"
                    ? "Create and unlock the encrypted salary vault in Settings to view and manage expense history."
                    : "Unlock the encrypted salary vault in Settings to view and manage expense history."}
              </p>
            </div>
          ) : (
          <>
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <span className="block text-xs font-medium text-slate-500">Historical expense total</span>
            <span className="mt-1 block text-xl font-extrabold text-slate-800">
              {formatCurrency(historicalExpenseTotal)}
            </span>
            <span className="text-[10px] text-slate-400">{`${validExpenses.length} saved records`}</span>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
            <span className="block text-xs font-medium text-rose-700">Filtered expense total</span>
            <span className="mt-1 block text-xl font-extrabold text-rose-700">
              {formatCurrency(filteredExpenseTotal)}
            </span>
            <span className="text-[10px] text-rose-500">{`${filteredExpenses.length} matching records`}</span>
          </div>
        </div>
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
              History range
              <select
                value={expenseFilterMode}
                onChange={(event) => setExpenseFilterMode(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
              >
                <option value="period">{`Selected payroll period · ${financePeriodLabel}`}</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
                <option value="range">Date range</option>
                <option value="all">All history</option>
              </select>
            </label>
            {expenseFilterMode === "month" && (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                Month
                <input
                  type="month"
                  value={expenseMonth}
                  onChange={(event) => setExpenseMonth(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                />
              </label>
            )}
            {expenseFilterMode === "year" && (
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                Year
                <input
                  type="number"
                  min="2000"
                  max="9999"
                  value={expenseYear}
                  onChange={(event) => setExpenseYear(event.target.value)}
                  className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                />
              </label>
            )}
            {expenseFilterMode === "range" && (
              <>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                  From
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                  To
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                  />
                </label>
              </>
            )}
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
              Category
              <select
                value={expenseCategoryFilter}
                onChange={(event) => setExpenseCategoryFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
              >
                <option value="all">All categories</option>
                <option value="Utilities">Utilities</option>
                <option value="Food & Groceries">Food &amp; Groceries</option>
                <option value="Transport">Transport</option>
                <option value="Travel &amp; Accommodation">Travel &amp; Accommodation</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </label>
          </div>
        </div>
        {workspaceLoading && (
          <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500" role="status">
            Loading saved expenses…
          </p>
        )}
        {workspaceError && (
          <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
            {`Expense history could not be loaded. ${workspaceError}`}
          </p>
        )}
        {workspaceSaveError && (
          <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
            {`Expense changes are not confirmed as saved. ${workspaceSaveError}`}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-medium block">
              Net Earnings Estimate
            </span>
            <span
              id="trackerNetPay"
              className="text-2xl font-extrabold text-slate-800 mt-1 block"
            >
              {privateSalaryDataHidden ? "Private — unlock vault" : formatCurrency(netPay)}
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
              {privateSalaryDataHidden ? "Private — unlock vault" : formatCurrency(remaining)}
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
              {privateSalaryDataHidden ? "Private" : `${percentage.toFixed(1)}% Spent`}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-300">
            <div
              id="trackerProgressBar"
              className={`h-full rounded-full transition-all duration-500 ${percentage > 85 ? "bg-rose-500" : percentage > 60 ? "bg-amber-500" : "bg-teal-600"}`}
              style={{ width: privateSalaryDataHidden ? "0%" : `${Math.min(percentage, 100)}%` }}
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
                  <option value="Travel &amp; Accommodation">
                    Travel &amp; Accommodation
                  </option>
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
                {`${filteredExpenses.length} item${filteredExpenses.length === 1 ? "" : "s"}`}
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
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-slate-400 italic">
                        {validExpenses.length === 0
                          ? "No expenses have been recorded yet."
                          : "No expenses match these filters."}
                      </td>
                    </tr>
                  ) : filteredExpenses.map((expense) => {
                    const categoryClass = {
                      Utilities: "bg-indigo-50 text-indigo-700",
                      "Food & Groceries": "bg-emerald-50 text-emerald-700",
                      Transport: "bg-amber-50 text-amber-700",
                      "Travel & Accommodation": "bg-sky-50 text-sky-700",
                      Miscellaneous: "bg-purple-50 text-purple-700",
                    }[expense.category] || "bg-slate-100 text-slate-700";
                    return (
                      <tr key={expense.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">{expense.name}</td>
                        <td className="p-3 text-slate-500">{getExpenseDate(expense) || "—"}</td>
                        <td className="p-3">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${categoryClass}`}>
                            {expense.category}
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold text-rose-600">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete "${expense.name}" dated ${getExpenseDate(expense)}? This cannot be undone.`)) {
                                onDeleteExpense(expense.id);
                              }
                            }}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Delete expense"
                            aria-label={`Delete ${expense.name}`}
                          >
                            <i className="fa-solid fa-trash-can" aria-hidden="true"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
          </>
        )
        ) : activeTab === "incentives" ? (
          <EmployeeIncentives
            incentives={employeeIncentives}
            onDeleteIncentive={onDeleteIncentive}
            salaryVaultStatus={salaryVaultStatus}
            salaryVaultError={salaryVaultError}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-xl border border-teal-100 bg-teal-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Current payroll period</h3>
                <p className="mt-1 text-xs text-slate-600">
                  {`${formatPayrollPeriod(currentPayrollPeriod)} · Estimate only until you explicitly save a snapshot`}
                </p>
              </div>
              <button
                type="button"
                onClick={onViewCurrentPayslip}
                className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                View current estimate
              </button>
            </div>
            {salaryVaultStatus !== "unlocked" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900" role="status">
                {salaryVaultStatus === "locked"
                  ? "Unlock the encrypted salary vault in Settings to browse historical payslips."
                  : salaryVaultStatus === "unavailable"
                    ? "The encrypted salary vault is unavailable until the required Supabase migration is applied."
                    : "Create and unlock the encrypted salary vault in Settings to save and browse payslip history."}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                    Show payslips
                    <select
                      value={payslipFilterMode}
                      onChange={(event) => setPayslipFilterMode(event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                    >
                      <option value="all">All history</option>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                    </select>
                  </label>
                  {payslipFilterMode === "month" && (
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                      Month
                      <input
                        type="month"
                        value={payslipMonth}
                        onChange={(event) => setPayslipMonth(event.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                      />
                    </label>
                  )}
                  {payslipFilterMode === "year" && (
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                      Year
                      <input
                        type="number"
                        min="2000"
                        max="9999"
                        value={payslipYear}
                        onChange={(event) => setPayslipYear(event.target.value)}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                      />
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                    Cutoff
                    <select
                      value={payslipCutoff}
                      onChange={(event) => setPayslipCutoff(event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
                    >
                      <option value="all">Both cutoffs</option>
                      <option value="10">1st cutoff · 26–10</option>
                      <option value="25">2nd cutoff · 11–25</option>
                    </select>
                  </label>
                </div>
                {filteredPayslips.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                    <p className="text-sm font-semibold text-slate-700">No saved payslip snapshots match this filter.</p>
                    <p className="mt-1 text-xs text-slate-500">
                      View the current estimate and choose “Save to history” to preserve its calculations.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="p-3 font-semibold">Employee</th>
                          <th className="p-3 font-semibold">Pay period</th>
                          <th className="p-3 font-semibold">Saved on</th>
                          <th className="p-3 text-right font-semibold">Gross</th>
                          <th className="p-3 text-right font-semibold">Net</th>
                          <th className="p-3 text-center font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredPayslips.map((snapshot) => (
                          <tr key={snapshot.id}>
                            <td className="p-3 font-semibold uppercase">{snapshot.employeeName}</td>
                            <td className="p-3">{formatPayrollPeriod(snapshot.period)}</td>
                            <td className="p-3 text-slate-500">
                              {new Date(snapshot.generatedAt).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-right font-medium">{formatCurrency(snapshot.summary.recordedEarnings)}</td>
                            <td className="p-3 text-right font-bold text-emerald-700">{formatCurrency(snapshot.netPay)}</td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => onViewHistoricalPayslip(snapshot)}
                                className="rounded-lg bg-teal-50 px-3 py-1.5 font-semibold text-teal-700 hover:bg-teal-100"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete saved payslip for ${formatPayrollPeriod(snapshot.period)}`}
                                title="Delete saved payslip"
                                disabled={payslipHistorySaving}
                                onClick={() => {
                                  if (window.confirm(
                                    `Delete the saved payslip for ${formatPayrollPeriod(snapshot.period)}? This cannot be undone.`,
                                  )) {
                                    onDeleteHistoricalPayslip(snapshot);
                                  }
                                }}
                                className="ml-1 rounded-lg bg-rose-50 px-3 py-1.5 text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <i
                                  className={`fa-solid ${payslipHistorySaving ? "fa-spinner fa-spin" : "fa-trash"}`}
                                  aria-hidden="true"
                                ></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
