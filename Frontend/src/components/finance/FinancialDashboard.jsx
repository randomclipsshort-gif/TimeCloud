import { useEffect, useMemo, useState } from "react";
import { getExpenseDate } from "../../utils/expenseTracker.js";
import EmployeeIncentives from "./EmployeeIncentives.jsx";
import { formatPayrollPeriod } from "../../utils/payrollPeriods.js";

export default function FinancialDashboard({
  requestConfirmation,
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
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-700">
                {financeTrackingScope === "month"
                  ? "Expenses this month"
                  : "Expenses this cutoff"}
              </span>
              <i className="fa-solid fa-arrow-trend-down text-rose-400" aria-hidden="true"></i>
            </div>
            <span className="mt-2 block text-xl font-extrabold tabular-nums text-rose-700">
              {formatCurrency(totalExpenses)}
            </span>
            <span className="mt-1 block text-[10px] text-rose-500">
              {financePeriodLabel}
            </span>
          </div>
          <div className={`rounded-2xl border p-4 ${remaining < 0 ? "border-rose-100 bg-rose-50/50" : "border-teal-100 bg-teal-50/60"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold ${remaining < 0 ? "text-rose-700" : "text-teal-800"}`}>
                Remaining balance
              </span>
              <i className={`fa-solid fa-wallet ${remaining < 0 ? "text-rose-400" : "text-teal-500"}`} aria-hidden="true"></i>
            </div>
            <span className={`mt-2 block text-xl font-extrabold tabular-nums ${remaining < 0 ? "text-rose-600" : "text-teal-700"}`}>
              {privateSalaryDataHidden ? "Private — unlock vault" : formatCurrency(remaining)}
            </span>
            <span className="mt-1 block text-[10px] text-slate-500">
              After period expenses
            </span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Filtered history</span>
              <i className="fa-solid fa-filter text-slate-300" aria-hidden="true"></i>
            </div>
            <span className="mt-2 block text-xl font-extrabold tabular-nums text-slate-800">
              {formatCurrency(filteredExpenseTotal)}
            </span>
            <span className="mt-1 block text-[10px] text-slate-400">
              {`${filteredExpenses.length} matching · ${validExpenses.length} saved total`}
            </span>
          </div>
        </div>
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800">Expense history</h3>
              <p className="mt-0.5 text-[10px] text-slate-400">Filter records by period and category</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
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
                <option value="Travel & Accommodation">Travel &amp; Accommodation</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </label>
            </div>
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
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 font-semibold text-slate-600">
              <i className="fa-solid fa-chart-pie text-teal-600" aria-hidden="true"></i>
              Budget utilization
            </span>
            <span className="font-bold text-teal-700">
              {privateSalaryDataHidden ? "Private" : `${percentage.toFixed(1)}% spent`}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${percentage > 85 ? "bg-rose-500" : percentage > 60 ? "bg-amber-500" : "bg-teal-600"}`}
              style={{ width: privateSalaryDataHidden ? "0%" : `${Math.min(percentage, 100)}%` }}
            ></div>
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <i className="fa-solid fa-plus" aria-hidden="true"></i>
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Add an expense</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Record a purchase or bill.
                </p>
              </div>
            </div>
            <div>
              <label
                className="mb-1 block text-[11px] font-semibold text-slate-600"
                htmlFor="expenseName"
              >
                Description
              </label>
              <input
                type="text"
                id="expenseName"
                value={expenseName}
                onChange={(event) => setExpenseName(event.target.value)}
                placeholder="e.g., Weekly groceries"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1 block text-[11px] font-semibold text-slate-600"
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
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-[11px] font-semibold text-slate-600"
                  htmlFor="expenseCategory"
                >
                  Category
                </label>
                <select
                  id="expenseCategory"
                  value={expenseCategory}
                  onChange={(event) => setExpenseCategory(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="Utilities">Utilities</option>
                  <option value="Food & Groceries">Food &amp; Groceries</option>
                  <option value="Transport">Transport</option>
                  <option value="Travel & Accommodation">
                    Travel &amp; Accommodation
                  </option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>
            </div>
            <div>
              <label
                className="mb-1 block text-[11px] font-semibold text-slate-600"
                htmlFor="expenseDate"
              >
                Expense date
              </label>
              <input
                type="date"
                id="expenseDate"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <button
              type="button"
              data-action="addExpense()"
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              <i className="fa-solid fa-plus" aria-hidden="true"></i>
              Save expense
            </button>
          </section>
          <section className="flex min-w-0 flex-col lg:col-span-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Recent expenses</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Sorted by most recent
                </p>
              </div>
              <span
                id="expenseCountBadge"
                className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500"
              >
                {`${filteredExpenses.length} item${filteredExpenses.length === 1 ? "" : "s"}`}
              </span>
            </div>
            <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              {filteredExpenses.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <i className="fa-solid fa-receipt" aria-hidden="true"></i>
                  </span>
                  <p className="mt-3 text-xs font-semibold text-slate-600">
                    {validExpenses.length === 0
                      ? "No expenses recorded yet"
                      : "No matching expenses"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {validExpenses.length === 0
                      ? "Add an expense to start tracking your spending."
                      : "Try adjusting the date or category filters."}
                  </p>
                </div>
              ) : (
                <div id="expenseTableBody" className="divide-y divide-slate-100">
                  {filteredExpenses.map((expense) => {
                    const categoryStyles = {
                      Utilities: {
                        icon: "fa-bolt",
                        color: "bg-indigo-50 text-indigo-600",
                      },
                      "Food & Groceries": {
                        icon: "fa-basket-shopping",
                        color: "bg-emerald-50 text-emerald-600",
                      },
                      Transport: {
                        icon: "fa-car",
                        color: "bg-amber-50 text-amber-600",
                      },
                      "Travel & Accommodation": {
                        icon: "fa-plane",
                        color: "bg-sky-50 text-sky-600",
                      },
                      Miscellaneous: {
                        icon: "fa-receipt",
                        color: "bg-purple-50 text-purple-600",
                      },
                    };
                    const categoryStyle = categoryStyles[expense.category] || {
                      icon: "fa-receipt",
                      color: "bg-slate-100 text-slate-600",
                    };
                    return (
                      <div
                        key={expense.id}
                        className="group flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/80"
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${categoryStyle.color}`}>
                          <i className={`fa-solid ${categoryStyle.icon} text-sm`} aria-hidden="true"></i>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {expense.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                            <span>{getExpenseDate(expense) || "—"}</span>
                            <span aria-hidden="true">·</span>
                            <span>{expense.category}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-rose-600">
                          −{formatCurrency(expense.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await requestConfirmation({
                              title: "Delete expense?",
                              message: `Delete "${expense.name}" dated ${getExpenseDate(expense)}? This cannot be undone.`,
                              confirmLabel: "Delete expense",
                              variant: "danger",
                            })) {
                              onDeleteExpense(expense.id);
                            }
                          }}
                          className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          title="Delete expense"
                          aria-label={`Delete ${expense.name}`}
                        >
                          <i className="fa-solid fa-trash-can" aria-hidden="true"></i>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
          </>
        )
        ) : activeTab === "incentives" ? (
          <EmployeeIncentives
            incentives={employeeIncentives}
            onDeleteIncentive={onDeleteIncentive}
            requestConfirmation={requestConfirmation}
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
                                onClick={async () => {
                                  if (await requestConfirmation({
                                    title: "Delete saved payslip?",
                                    message: `Delete the saved payslip for ${formatPayrollPeriod(snapshot.period)}? This cannot be undone.`,
                                    confirmLabel: "Delete payslip",
                                    variant: "danger",
                                  })) {
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
