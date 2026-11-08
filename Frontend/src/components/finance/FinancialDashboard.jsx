import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  CarFront,
  ChartPie,
  FileText,
  Plane,
  Plus,
  Receipt,
  ShoppingBasket,
  Tag,
  Trash2,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { getExpenseDate } from "../../utils/expenseTracker.js";
import EmployeeIncentives from "./EmployeeIncentives.jsx";
import TravelBudgetPlanner from "./TravelBudgetPlanner.jsx";
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
  onAddIncentive,
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
  travelPlans,
  today,
  onCreateTravelPlan,
  onUpdateTravelPlan,
  onCompleteTravelPlan,
  onDeleteTravelPlan,
  onAddTravelExpense,
  onUpdateTravelExpense,
  onDeleteTravelExpense,
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
  const financeTabs = [
    {
      id: "expenses",
      label: "Expenses",
      icon: "fa-receipt",
      iconColor: "text-rose-500",
    },
    {
      id: "travel",
      label: "Travel Budgets",
      icon: "fa-plane",
      iconColor: "text-blue-500",
    },
    {
      id: "incentives",
      label: "Incentives",
      icon: "fa-award",
      iconColor: "text-amber-500",
    },
    {
      id: "payslips",
      label: "Payslips",
      icon: "fa-file-invoice",
      iconColor: "text-emerald-600",
    },
  ];

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
  const filteredExpenses = useMemo(
    () =>
      validExpenses
        .filter((expense) => {
          const date = getExpenseDate(expense);
          if (
            expenseCategoryFilter !== "all" &&
            expense.category !== expenseCategoryFilter
          ) {
            return false;
          }
          if (expenseFilterMode === "period") {
            return monthExpenses.some((item) => item.id === expense.id);
          }
          if (expenseFilterMode === "month")
            return date.startsWith(`${expenseMonth}-`);
          if (expenseFilterMode === "year")
            return date.startsWith(`${expenseYear}-`);
          if (expenseFilterMode === "range") {
            return (
              (!rangeStart || date >= rangeStart) &&
              (!rangeEnd || date <= rangeEnd)
            );
          }
          return true;
        })
        .sort((left, right) =>
          (getExpenseDate(right) || "").localeCompare(
            getExpenseDate(left) || "",
          ),
        ),
    [
      expenseCategoryFilter,
      expenseFilterMode,
      expenseMonth,
      expenseYear,
      monthExpenses,
      rangeEnd,
      rangeStart,
      validExpenses,
    ],
  );
  const privateSalaryDataHidden = ["locked", "unavailable", "loading"].includes(
    salaryVaultStatus,
  );
  const expensesHidden = salaryVaultStatus !== "unlocked";
  const filteredPayslips = historicalPayslips
    .filter((snapshot) => {
      const endDate = snapshot.period.endDate;
      if (
        payslipFilterMode === "month" &&
        !endDate.startsWith(`${payslipMonth}-`)
      ) {
        return false;
      }
      if (
        payslipFilterMode === "year" &&
        !endDate.startsWith(`${payslipYear}-`)
      )
        return false;
      if (payslipCutoff === "10" && !endDate.endsWith("-10")) return false;
      if (payslipCutoff === "25" && !endDate.endsWith("-25")) return false;
      return true;
    })
    .sort((left, right) =>
      right.period.endDate.localeCompare(left.period.endDate),
    );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="relative flex min-h-[115px] flex-col items-start justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 px-5 py-4 text-white shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-5">
        <div
          className="pointer-events-none absolute inset-y-0 right-[31%] w-[34%] -skew-x-12 bg-slate-950/55"
          aria-hidden="true"
        ></div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-[32%] bg-teal-900/25"
          aria-hidden="true"
        ></div>
        <div className="relative z-10 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              Current payroll cutoff
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-200">
              <i
                className="fa-regular fa-clock text-emerald-400"
                aria-hidden="true"
              ></i>
              {formatPayrollPeriod(currentPayrollPeriod)}
            </span>
          </div>
          <h1 className="mt-2 text-lg font-extrabold leading-tight text-white">
            Financial &amp; Time Management Hub
          </h1>
          <p className="mt-1 text-[11px] leading-4 text-slate-200">
            Estimate calculation based on current logged shifts &amp;
            incentives. Snapshot updates automatically every cutoff.
          </p>
        </div>
        <button
          type="button"
          onClick={onViewCurrentPayslip}
          className="relative z-10 inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-600"
        >
          <i className="fa-regular fa-eye" aria-hidden="true"></i>
          View Current Estimate
        </button>
      </div>
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:p-4">
          <div className="flex min-w-0 flex-col gap-3 lg:w-full lg:flex-row lg:items-center lg:justify-between">
            <div
              className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1"
              role="tablist"
              aria-label="Financial history sections"
            >
              {financeTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                    activeTab === tab.id
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <i
                    className={`fa-solid ${tab.icon} ${activeTab === tab.id ? "text-white" : tab.iconColor}`}
                    aria-hidden="true"
                  ></i>
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTab === "expenses" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <span className="text-left text-xs font-semibold text-slate-500 sm:text-right">
                  {`Recorded earnings and expenses · ${financePeriodLabel}`}
                </span>
                <div
                  className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
                  aria-label="Finance tracking period"
                >
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
            )}
          </div>
        </div>
        {activeTab === "expenses" ? (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-600">
                    Gross Earnings Estimate
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-500">
                    <Wallet size={13} aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-base font-extrabold tabular-nums text-slate-900">
                  {privateSalaryDataHidden
                    ? "Private — unlock vault"
                    : formatCurrency(grossPay)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{`${totalHours.toFixed(2)} Total Hours`}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-600">
                    {financeTrackingScope === "month"
                      ? "Estimated Monthly Deductions"
                      : "Estimated Cutoff Deductions"}
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-500">
                    <FileText size={13} aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-base font-extrabold tabular-nums text-slate-900">
                  {privateSalaryDataHidden
                    ? "Private — unlock vault"
                    : formatCurrency(payrollDeductions.total)}
                </p>
                <p className="mt-0.5 text-[10px] text-rose-500">
                  SSS · PhilHealth · Pag-IBIG
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-600">
                    Net Earnings Estimate
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                    <TrendingUp size={13} aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-base font-extrabold tabular-nums text-emerald-600">
                  {privateSalaryDataHidden
                    ? "Private — unlock vault"
                    : formatCurrency(netPay)}
                </p>
                <span className="mt-0.5 inline-block rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-medium text-emerald-700">
                  Estimate only
                </span>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-rose-700">
                    {financeTrackingScope === "month"
                      ? "Expenses this month"
                      : "Expenses this cutoff"}
                  </span>
                  <ArrowDownRight
                    size={13}
                    className="text-rose-500"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 text-base font-extrabold tabular-nums text-rose-600">
                  {expensesHidden
                    ? "Private — unlock vault"
                    : formatCurrency(totalExpenses)}
                </p>
                <p className="mt-0.5 text-[10px] text-rose-500">
                  {financePeriodLabel}
                </p>
              </div>
              <div
                className={`rounded-xl border p-3.5 ${remaining < 0 ? "border-rose-200 bg-rose-50/40" : "border-emerald-200 bg-emerald-50/30"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-medium ${remaining < 0 ? "text-rose-700" : "text-emerald-700"}`}
                  >
                    Remaining balance
                  </span>
                  <Wallet
                    size={13}
                    className={
                      remaining < 0 ? "text-rose-500" : "text-emerald-600"
                    }
                    aria-hidden="true"
                  />
                </div>
                <p
                  className={`mt-2 text-base font-extrabold tabular-nums ${remaining < 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  {expensesHidden
                    ? "Private — unlock vault"
                    : formatCurrency(remaining)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  After period expenses
                </p>
              </div>
            </div>
            {expensesHidden ? (
              <div
                className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
                role="status"
              >
                <p className="font-semibold">
                  Expenses and ledger are private.
                </p>
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
                  <div className="min-w-[150px]">
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                        Expense History
                      </h3>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Filter records by period and category
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                      History range
                      <select
                        value={expenseFilterMode}
                        onChange={(event) =>
                          setExpenseFilterMode(event.target.value)
                        }
                        className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                      >
                        <option value="period">{`Selected payroll period · ${financePeriodLabel}`}</option>
                        <option value="month">Month</option>
                        <option value="year">Year</option>
                        <option value="range">Date range</option>
                        <option value="all">All history</option>
                      </select>
                    </label>
                    {expenseFilterMode === "month" && (
                      <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                        Month
                        <input
                          type="month"
                          value={expenseMonth}
                          onChange={(event) =>
                            setExpenseMonth(event.target.value)
                          }
                          className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                        />
                      </label>
                    )}
                    {expenseFilterMode === "year" && (
                      <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                        Year
                        <input
                          type="number"
                          min="2000"
                          max="9999"
                          value={expenseYear}
                          onChange={(event) =>
                            setExpenseYear(event.target.value)
                          }
                          className="w-24 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                        />
                      </label>
                    )}
                    {expenseFilterMode === "range" && (
                      <>
                        <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                          From
                          <input
                            type="date"
                            value={rangeStart}
                            onChange={(event) =>
                              setRangeStart(event.target.value)
                            }
                            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                          />
                        </label>
                        <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                          To
                          <input
                            type="date"
                            value={rangeEnd}
                            onChange={(event) =>
                              setRangeEnd(event.target.value)
                            }
                            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                          />
                        </label>
                      </>
                    )}
                    <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                      Category
                      <select
                        value={expenseCategoryFilter}
                        onChange={(event) =>
                          setExpenseCategoryFilter(event.target.value)
                        }
                        className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                      >
                        <option value="all">All categories</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Food & Groceries">
                          Food &amp; Groceries
                        </option>
                        <option value="Transport">Transport</option>
                        <option value="Travel & Accommodation">
                          Travel &amp; Accommodation
                        </option>
                        <option value="Miscellaneous">Miscellaneous</option>
                      </select>
                    </label>
                  </div>
                </div>
                {workspaceLoading && (
                  <p
                    className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500"
                    role="status"
                  >
                    Loading saved expenses…
                  </p>
                )}
                {workspaceError && (
                  <p
                    className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
                    role="alert"
                  >
                    {`Expense history could not be loaded. ${workspaceError}`}
                  </p>
                )}
                {workspaceSaveError && (
                  <p
                    className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
                    role="alert"
                  >
                    {`Expense changes are not confirmed as saved. ${workspaceSaveError}`}
                  </p>
                )}
                <div className="mb-5 rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[11px]">
                    <span className="flex items-center gap-2 font-semibold text-slate-700">
                      <ChartPie
                        size={14}
                        className="text-emerald-600"
                        aria-hidden="true"
                      />
                      Budget utilization
                    </span>
                    <span className="font-bold text-emerald-600">
                      {privateSalaryDataHidden
                        ? "Private"
                        : `${percentage.toFixed(1)}% spent`}
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label="Budget utilization"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={
                      privateSalaryDataHidden ? 0 : Math.min(percentage, 100)
                    }
                  >
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                      style={{
                        width: privateSalaryDataHidden
                          ? "0%"
                          : `${Math.min(percentage, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[9px] text-slate-400">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                        <Plus size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Add an expense
                        </h3>
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
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
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
                          onChange={(event) =>
                            setExpenseAmount(event.target.value)
                          }
                          placeholder="0.00"
                          min="0.01"
                          step="0.01"
                          className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
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
                          onChange={(event) =>
                            setExpenseCategory(event.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                        >
                          <option value="Utilities">Utilities</option>
                          <option value="Food & Groceries">
                            Food &amp; Groceries
                          </option>
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
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                    <button
                      type="button"
                      data-action="addExpense()"
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                    >
                      <Plus size={14} aria-hidden="true" />
                      Save expense
                    </button>
                  </section>
                  <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-8">
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Recent expenses
                        </h3>
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
                    <div className="max-h-[420px] overflow-y-auto">
                      {filteredExpenses.length === 0 ? (
                        <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <i
                              className="fa-solid fa-receipt"
                              aria-hidden="true"
                            ></i>
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
                        <div
                          id="expenseTableBody"
                          className="space-y-2.5"
                        >
                          {filteredExpenses.map((expense) => {
                            const categoryStyles = {
                              Utilities: {
                                Icon: Zap,
                                color: "bg-indigo-50 text-indigo-600",
                              },
                              "Food & Groceries": {
                                Icon: ShoppingBasket,
                                color: "bg-emerald-50 text-emerald-600",
                              },
                              Transport: {
                                Icon: CarFront,
                                color: "bg-amber-50 text-amber-600",
                              },
                              "Travel & Accommodation": {
                                Icon: Plane,
                                color: "bg-sky-50 text-sky-600",
                              },
                              Miscellaneous: {
                                Icon: Tag,
                                color: "bg-purple-50 text-purple-600",
                              },
                            };
                            const categoryStyle = categoryStyles[
                              expense.category
                            ] || {
                              Icon: Receipt,
                              color: "bg-slate-100 text-slate-600",
                            };
                            return (
                              <div
                                key={expense.id}
                                className="group flex min-h-[66px] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 transition hover:border-slate-200 hover:bg-slate-50/50 sm:px-4"
                              >
                                <span
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${categoryStyle.color}`}
                                >
                                  <categoryStyle.Icon
                                    size={16}
                                    aria-hidden="true"
                                  />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold text-slate-800">
                                    {expense.name}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                                    <span>
                                      {getExpenseDate(expense) || "—"}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>{expense.category}</span>
                                  </div>
                                </div>
                                <span className="shrink-0 text-xs font-bold tabular-nums text-rose-500">
                                  −{formatCurrency(expense.amount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onDeleteExpense(expense.id)}
                                  className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                  title="Delete expense"
                                  aria-label={`Delete ${expense.name}`}
                                >
                                  <Trash2 size={15} aria-hidden="true" />
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
            )}
          </>
        ) : activeTab === "incentives" ? (
          <EmployeeIncentives
            incentives={employeeIncentives}
            onAddIncentive={onAddIncentive}
            onDeleteIncentive={onDeleteIncentive}
            requestConfirmation={requestConfirmation}
            salaryVaultStatus={salaryVaultStatus}
            salaryVaultError={salaryVaultError}
            formatCurrency={formatCurrency}
          />
        ) : activeTab === "travel" ? (
          <TravelBudgetPlanner
            travelPlans={travelPlans}
            today={today}
            workspaceLoading={workspaceLoading}
            workspaceError={workspaceError}
            workspaceSaveError={workspaceSaveError}
            requestConfirmation={requestConfirmation}
            onCreatePlan={onCreateTravelPlan}
            onUpdatePlan={onUpdateTravelPlan}
            onCompletePlan={onCompleteTravelPlan}
            onDeletePlan={onDeleteTravelPlan}
            onAddExpense={onAddTravelExpense}
            onUpdateExpense={onUpdateTravelExpense}
            onDeleteExpense={onDeleteTravelExpense}
          />
        ) : (
          <div className="space-y-4">
            {salaryVaultStatus !== "unlocked" ? (
              <div
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"
                role="status"
              >
                {salaryVaultStatus === "locked"
                  ? "Unlock the encrypted salary vault in Settings to browse historical payslips."
                  : salaryVaultStatus === "unavailable"
                    ? "The encrypted salary vault is unavailable until the required Supabase migration is applied."
                    : "Create and unlock the encrypted salary vault in Settings to save and browse payslip history."}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:px-4">
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                    <i
                      className="fa-solid fa-filter text-slate-400"
                      aria-hidden="true"
                    ></i>
                    Show payslips:
                    <select
                      value={payslipFilterMode}
                      onChange={(event) =>
                        setPayslipFilterMode(event.target.value)
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                    >
                      <option value="all">All history</option>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                    </select>
                  </label>
                  {payslipFilterMode === "month" && (
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                      Month
                      <input
                        type="month"
                        value={payslipMonth}
                        onChange={(event) =>
                          setPayslipMonth(event.target.value)
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                      />
                    </label>
                  )}
                  {payslipFilterMode === "year" && (
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                      Year
                      <input
                        type="number"
                        min="2000"
                        max="9999"
                        value={payslipYear}
                        onChange={(event) => setPayslipYear(event.target.value)}
                        className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                    Cutoff:
                    <select
                      value={payslipCutoff}
                      onChange={(event) => setPayslipCutoff(event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                    >
                      <option value="all">Both cutoffs</option>
                      <option value="10">1st cutoff · 26–10</option>
                      <option value="25">2nd cutoff · 11–25</option>
                    </select>
                  </label>
                  <span className="ml-auto text-[11px] font-medium text-slate-400">
                    {`Showing ${filteredPayslips.length} finalized record${filteredPayslips.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full min-w-[760px] text-left text-[11px]">
                    <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600">
                      <tr>
                        <th scope="col" className="px-3 py-3 font-bold">
                          Employee
                        </th>
                        <th scope="col" className="px-3 py-3 font-bold">
                          Pay period
                        </th>
                        <th scope="col" className="px-3 py-3 font-bold">
                          Saved on
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3 text-right font-bold"
                        >
                          Gross pay
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3 text-right font-bold"
                        >
                          Statutory deductions
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3 text-right font-bold"
                        >
                          Net pay
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3 text-center font-bold"
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredPayslips.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-10 text-center">
                            <p className="text-xs font-semibold text-slate-700">
                              No saved payslip snapshots match this filter.
                            </p>
                            <p className="mt-1 text-[10px] text-slate-500">
                              View the current estimate and choose “Save to
                              history” to preserve its calculations.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredPayslips.map((snapshot) => (
                          <tr
                            key={snapshot.id}
                            className="transition hover:bg-slate-50/70"
                          >
                            <td className="whitespace-nowrap px-3 py-3.5 font-bold uppercase text-slate-900">
                              {snapshot.employeeName}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3.5">
                              <span className="block">
                                {formatPayrollPeriod(snapshot.period)}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-slate-400">
                                {snapshot.period.endDate.endsWith("-10")
                                  ? "10th Cutoff"
                                  : snapshot.period.endDate.endsWith("-25")
                                    ? "25th Cutoff"
                                    : "Monthly"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3.5 text-slate-500">
                              {new Date(
                                snapshot.generatedAt,
                              ).toLocaleDateString()}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3.5 text-right font-medium text-slate-900">
                              {formatCurrency(
                                snapshot.summary.recordedEarnings,
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3.5 text-right">
                              <span className="block font-medium text-rose-600">
                                −
                                {formatCurrency(
                                  snapshot.deductions.employeeContributionTotal,
                                )}
                              </span>
                              <span className="mt-0.5 block text-[9px] text-slate-400">
                                SSS, PhilHealth, Pag-IBIG
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3.5 text-right font-extrabold text-emerald-600">
                              {formatCurrency(snapshot.netPay)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  onViewHistoricalPayslip(snapshot)
                                }
                                className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-200"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete saved payslip for ${formatPayrollPeriod(snapshot.period)}`}
                                title="Delete saved payslip"
                                disabled={payslipHistorySaving}
                                onClick={async () => {
                                  if (
                                    await requestConfirmation({
                                      title: "Delete saved payslip?",
                                      message: `Delete the saved payslip for ${formatPayrollPeriod(snapshot.period)}? This cannot be undone.`,
                                      confirmLabel: "Delete payslip",
                                      variant: "danger",
                                    })
                                  ) {
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
