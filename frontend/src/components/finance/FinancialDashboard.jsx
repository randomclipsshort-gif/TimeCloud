import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  CarFront,
  CalendarDays,
  ChartPie,
  ChevronDown,
  Copy,
  Filter,
  FileText,
  History,
  Plane,
  Pencil,
  Plus,
  Receipt,
  Search,
  ShoppingBasket,
  Tag,
  Trash2,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import {
  getBudgetUtilization,
  getExpenseDate,
} from "../../utils/expenseTracker.js";
import EmployeeIncentives from "./EmployeeIncentives.jsx";
import TravelBudgetPlanner from "./TravelBudgetPlanner.jsx";
import { formatPayrollPeriod } from "../../utils/payrollPeriods.js";

const EXPENSE_CATEGORY_PRESENTATION = {
  Utilities: { label: "Bills & Utilities", color: "bg-amber-500" },
  "Food & Dining": { label: "Food & Dining", color: "bg-emerald-500" },
  "Food & Groceries": { label: "Food & Groceries", color: "bg-emerald-500" },
  Groceries: { label: "Groceries", color: "bg-emerald-500" },
  Transport: { label: "Transport & Commute", color: "bg-sky-500" },
  "Transport & Commute": {
    label: "Transport & Commute",
    color: "bg-sky-500",
  },
  "Travel & Accommodation": {
    label: "Travel & Accommodation",
    color: "bg-indigo-500",
  },
  Miscellaneous: { label: "Miscellaneous", color: "bg-slate-500" },
};

const FINANCE_TRANSITION_DURATION_MS = 520;
const GHOST_TRAIL_DURATION_MS = 650;
const CATEGORY_SHARE_TRANSITION_DURATION_MS = 650;
const CATEGORY_SHARE_STAGGER_MS = 90;

const EXPENSE_LEDGER_CATEGORIES = [
  {
    key: "utilities",
    label: "Bills & Utilities",
    categories: ["Utilities"],
    Icon: Zap,
    color: "bg-amber-50 text-amber-600",
  },
  {
    key: "food",
    label: "Food & Dining",
    categories: ["Food & Dining"],
    Icon: ShoppingBasket,
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "groceries",
    label: "Groceries",
    categories: ["Food & Groceries", "Groceries"],
    Icon: ShoppingBasket,
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "transport",
    label: "Transport & Commute",
    categories: ["Transport", "Transport & Commute"],
    Icon: CarFront,
    color: "bg-sky-50 text-sky-600",
  },
  {
    key: "travel",
    label: "Travel & Accommodation",
    categories: ["Travel & Accommodation"],
    Icon: Plane,
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    key: "miscellaneous",
    label: "Miscellaneous",
    categories: ["Miscellaneous"],
    Icon: Tag,
    color: "bg-purple-50 text-purple-600",
  },
];

function getExpenseLedgerCategory(category) {
  return (
    EXPENSE_LEDGER_CATEGORIES.find((item) =>
      item.categories.includes(category),
    ) || {
      key: `other:${category || "unknown"}`,
      label: category || "Other",
      Icon: Receipt,
      color: "bg-slate-100 text-slate-600",
    }
  );
}

function formatExpenseLedgerDate(dateKey, options) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

function formatExpenseLedgerTime(expense) {
  const timestamp = Date.parse(expense.createdAt || expense.timestamp || "");
  if (Number.isFinite(timestamp)) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(timestamp));
  }
  return typeof expense.time === "string" ? expense.time : "";
}

function useAnimatedNumber(
  value,
  duration = FINANCE_TRANSITION_DURATION_MS,
  initialValue,
  delay = 0,
) {
  const targetValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const startingValue = Number.isFinite(Number(initialValue))
    ? Number(initialValue)
    : targetValue;
  const displayValueRef = useRef(startingValue);
  const [displayValue, setDisplayValue] = useState(startingValue);

  useEffect(() => {
    const startValue = displayValueRef.current;
    if (startValue === targetValue) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      displayValueRef.current = targetValue;
      setDisplayValue(targetValue);
      return undefined;
    }

    let frameId;
    let timeoutId;
    const startAnimation = () => {
      const startTime = window.performance.now();
      const animate = (timestamp) => {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const easedProgress = 1 - (1 - progress) ** 3;
        const nextValue =
          startValue + (targetValue - startValue) * easedProgress;
        displayValueRef.current = nextValue;
        setDisplayValue(nextValue);
        if (progress < 1) {
          frameId = window.requestAnimationFrame(animate);
        } else {
          displayValueRef.current = targetValue;
        }
      };

      frameId = window.requestAnimationFrame(animate);
    };

    if (delay > 0) {
      timeoutId = window.setTimeout(startAnimation, delay);
    } else {
      startAnimation();
    }
    return () => {
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(frameId);
    };
  }, [delay, duration, targetValue]);

  return displayValue;
}

function AnimatedCurrency({
  value,
  formatCurrency,
  initialValue,
  duration = FINANCE_TRANSITION_DURATION_MS,
  delay = 0,
}) {
  return formatCurrency(
    useAnimatedNumber(value, duration, initialValue, delay),
  );
}

function StableAnimatedCurrency({
  value,
  formatCurrency,
  initialValue,
  duration,
  delay,
}) {
  const previousValueRef = useRef(value);
  const previousValue = previousValueRef.current;
  const startingValue = initialValue ?? value;

  useEffect(() => {
    previousValueRef.current = value;
  }, [value]);

  return (
    <span className="inline-grid align-baseline whitespace-nowrap tabular-nums">
      {[previousValue, startingValue, value].map((reservedValue, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1"
        >
          {formatCurrency(reservedValue)}
        </span>
      ))}
      <span className="col-start-1 row-start-1">
        <AnimatedCurrency
          value={value}
          formatCurrency={formatCurrency}
          initialValue={initialValue}
          duration={duration}
          delay={delay}
        />
      </span>
    </span>
  );
}

function AnimatedCategoryShare({
  category,
  index,
  total,
  activeSelection,
  formatCurrency,
}) {
  const [isFadeActive, setIsFadeActive] = useState(true);
  const previousSelectionRef = useRef(activeSelection);
  const share = total > 0 ? (category.amount / total) * 100 : 0;
  const staggerDelay = index * CATEGORY_SHARE_STAGGER_MS;
  const animatedShare = useAnimatedNumber(
    share,
    CATEGORY_SHARE_TRANSITION_DURATION_MS,
    0,
    staggerDelay,
  );

  useEffect(() => {
    if (previousSelectionRef.current === activeSelection) return undefined;
    previousSelectionRef.current = activeSelection;
    setIsFadeActive(false);
    const frameId = window.requestAnimationFrame(() =>
      setIsFadeActive(true),
    );
    return () => window.cancelAnimationFrame(frameId);
  }, [activeSelection]);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] text-slate-600 ${
        isFadeActive ? "budget-category-fade" : ""
      }`}
      style={{ animationDelay: `${staggerDelay}ms` }}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${category.color}`}
        aria-hidden="true"
      />
      <span>
        {EXPENSE_CATEGORY_PRESENTATION[category.category]?.label ??
          category.category}
        :
      </span>
      <strong className="font-bold tabular-nums text-slate-800">
        <StableAnimatedCurrency
          value={category.amount}
          formatCurrency={formatCurrency}
          initialValue={0}
          duration={CATEGORY_SHARE_TRANSITION_DURATION_MS}
          delay={staggerDelay}
        />
      </strong>
      <span className="inline-block min-w-[4ch] text-right tabular-nums text-slate-400">
        {`${Math.round(animatedShare)}%`}
      </span>
    </span>
  );
}

function formatCutoffHistoryPeriod(period) {
  const formatDate = (dateKey) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${dateKey}T00:00:00Z`));
  const start = formatDate(period.startDate);
  const end = formatDate(period.endDate);
  const startYear = period.startDate.slice(0, 4);
  const endYear = period.endDate.slice(0, 4);
  return startYear === endYear
    ? `${start}–${end}`
    : `${start}, ${startYear}–${end}, ${endYear}`;
}

export default function FinancialDashboard({
  requestConfirmation,
  monthExpenses,
  expenses,
  financeTrackingScope,
  setFinanceTrackingScope,
  financeCustomRange = { startDate: "", endDate: "" },
  setFinanceCustomRange,
  financePeriodLabel,
  financeCutoffHistory = [],
  totalExpenses,
  remaining,
  percentage,
  netPay,
  grossPay,
  payrollDeductions,
  pendingPayrollRecords = 0,
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
  expensePaymentMethod,
  setExpensePaymentMethod,
  expenseNote,
  setExpenseNote,
  editingExpenseId,
  onEditExpense,
  onDuplicateExpense,
  onCancelExpenseEdit,
  onDeleteExpense,
  employeeIncentives,
  onAddIncentive,
  onDeleteIncentive,
  workspaceLoading,
  workspaceError,
  workspaceSaveError,
  historicalPayslips,
  payslipHistorySaving,
  privateFinancialDataStatus,
  privateFinancialDataError,
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
  const [isCutoffHistoryVisible, setIsCutoffHistoryVisible] = useState(true);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [expenseSort, setExpenseSort] = useState("newest");
  const [collapsedExpenseDays, setCollapsedExpenseDays] = useState(
    () => new Set(),
  );
  const [payslipFilterMode, setPayslipFilterMode] = useState("all");
  const [payslipMonth, setPayslipMonth] = useState(monthValue);
  const [payslipYear, setPayslipYear] = useState(monthValue.slice(0, 4));
  const [payslipCutoff, setPayslipCutoff] = useState("all");
  const [cutoffDirection, setCutoffDirection] = useState(0);
  const activeFinancePeriodSelection =
    financeTrackingScope === "current"
      ? `period:${financeCutoffHistory[0]?.period.endDate || ""}`
      : financeTrackingScope;
  const selectFinanceTrackingScope = (nextScope) => {
    const nextSelection =
      nextScope === "current"
        ? `period:${financeCutoffHistory[0]?.period.endDate || ""}`
        : nextScope;
    const previousEndDate = activeFinancePeriodSelection.startsWith("period:")
      ? activeFinancePeriodSelection.slice("period:".length)
      : "";
    const nextEndDate = nextSelection.startsWith("period:")
      ? nextSelection.slice("period:".length)
      : "";
    setCutoffDirection(
      previousEndDate && nextEndDate
        ? nextEndDate < previousEndDate
          ? 1
          : nextEndDate > previousEndDate
            ? -1
            : 0
        : 0,
    );
    setFinanceTrackingScope(nextScope);
  };
  const animatedPercentage = useAnimatedNumber(percentage);
  const financeTabs = [
    {
      id: "incentives",
      label: "Incentives",
      icon: "fa-award",
      iconColor: "text-amber-500",
    },
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
      id: "payslips",
      label: "Payslips",
      icon: "fa-file-invoice",
      iconColor: "text-emerald-600",
    },
  ];

  useEffect(() => {
    if (payslipFilterMode === "month") setPayslipMonth(monthValue);
    if (payslipFilterMode === "year") setPayslipYear(monthValue.slice(0, 4));
  }, [monthValue, payslipFilterMode]);

  const validExpenses = useMemo(
    () => expenses.filter((expense) => getExpenseDate(expense)),
    [expenses],
  );
  const displayedExpenses = useMemo(
    () => {
      let scopedExpenses = validExpenses;
      if (financeTrackingScope === "custom-range") {
        const hasValidRange =
          /^\d{4}-\d{2}-\d{2}$/.test(financeCustomRange.startDate) &&
          /^\d{4}-\d{2}-\d{2}$/.test(financeCustomRange.endDate) &&
          financeCustomRange.startDate <= financeCustomRange.endDate;
        scopedExpenses = hasValidRange
          ? validExpenses.filter((expense) => {
              const date = getExpenseDate(expense);
              return (
                date >= financeCustomRange.startDate &&
                date <= financeCustomRange.endDate
              );
            })
          : [];
      } else if (financeTrackingScope !== "all-history") {
        const periodExpenseIds = new Set(
          monthExpenses.map((expense) => String(expense.id)),
        );
        scopedExpenses = validExpenses.filter((expense) =>
          periodExpenseIds.has(String(expense.id)),
        );
      }

      return scopedExpenses.sort((left, right) =>
        (getExpenseDate(right) || "").localeCompare(
          getExpenseDate(left) || "",
        ),
      );
    },
    [
      financeCustomRange,
      financeTrackingScope,
      monthExpenses,
      validExpenses,
    ],
  );
  const expenseCategoryFilters = useMemo(() => {
    const categoryCounts = new Map();
    const knownCategories = new Set(
      EXPENSE_LEDGER_CATEGORIES.flatMap((item) => item.categories),
    );
    for (const expense of displayedExpenses) {
      const category = getExpenseLedgerCategory(expense.category);
      categoryCounts.set(category.key, (categoryCounts.get(category.key) || 0) + 1);
    }

    const knownFilters = EXPENSE_LEDGER_CATEGORIES
      .filter((item) => categoryCounts.has(item.key))
      .map((item) => ({
        key: item.key,
        label: item.label,
        count: categoryCounts.get(item.key),
      }));
    const otherFilters = [...categoryCounts.entries()]
      .filter(([key]) => key.startsWith("other:"))
      .map(([key, count]) => ({
        key,
        label: key.slice("other:".length),
        count,
      }));

    return [
      { key: "all", label: "All", count: displayedExpenses.length },
      ...knownFilters,
      ...otherFilters.filter((item) => !knownCategories.has(item.label)),
    ];
  }, [displayedExpenses]);
  useEffect(() => {
    if (
      !expenseCategoryFilters.some(
        (filter) => filter.key === expenseCategoryFilter,
      )
    ) {
      setExpenseCategoryFilter("all");
    }
  }, [expenseCategoryFilter, expenseCategoryFilters]);
  const filteredExpenses = useMemo(() => {
    const query = expenseSearch.trim().toLocaleLowerCase();
    return displayedExpenses.filter((expense) => {
      const category = getExpenseLedgerCategory(expense.category);
      if (
        expenseCategoryFilter !== "all" &&
        category.key !== expenseCategoryFilter
      ) {
        return false;
      }
      if (!query) return true;
      return [
        expense.name,
        expense.category,
        expense.notes,
        expense.note,
        expense.method,
        expense.paymentMethod,
      ]
        .filter((value) => typeof value === "string")
        .some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [displayedExpenses, expenseCategoryFilter, expenseSearch]);
  const expenseLedgerGroups = useMemo(() => {
    const groups = new Map();
    for (const expense of filteredExpenses) {
      const date = getExpenseDate(expense);
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date).push(expense);
    }

    return [...groups.entries()].map(([date, items]) => {
      if (expenseSort !== "newest") {
        items.sort((left, right) => {
          const amountDifference = Number(left.amount) - Number(right.amount);
          return expenseSort === "highest"
            ? -amountDifference
            : amountDifference;
        });
      } else {
        items.sort((left, right) =>
          (right.createdAt || "").localeCompare(left.createdAt || ""),
        );
      }
      const period = financeCutoffHistory.find(
        ({ period: cutoff }) =>
          date >= cutoff.startDate && date <= cutoff.endDate,
      )?.period;
      return {
        date,
        items,
        subtotal: items.reduce((total, item) => {
          const amount = Number(item.amount);
          return Number.isFinite(amount) ? total + amount : total;
        }, 0),
        cutoffLabel: period
          ? formatCutoffHistoryPeriod(period)
          : formatExpenseLedgerDate(date, { month: "short", day: "numeric" }),
      };
    });
  }, [expenseSort, filteredExpenses, financeCutoffHistory]);
  const expenseLedgerRangeLabel = useMemo(() => {
    if (displayedExpenses.length === 0) return financePeriodLabel;
    const dates = displayedExpenses
      .map((expense) => getExpenseDate(expense))
      .sort();
    const first = dates[0];
    const last = dates[dates.length - 1];
    const formatDate = (date) =>
      formatExpenseLedgerDate(date, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    return first === last ? formatDate(first) : `${formatDate(first)}–${formatDate(last)}`;
  }, [displayedExpenses, financePeriodLabel]);
  const filteredExpenseTotal = filteredExpenses.reduce((total, expense) => {
    const amount = Number(expense.amount);
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);
  const expensesHidden = privateFinancialDataStatus !== "ready";
  const privateFinancialDataHidden = expensesHidden;
  const expenseCategoryShares = useMemo(() => {
    if (expensesHidden) return [];
    const categoryTotals = new Map();
    for (const expense of monthExpenses) {
      const amount = Number(expense.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const category =
        typeof expense.category === "string" && expense.category.trim()
          ? expense.category
          : "Other";
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
    }

    const categoryOrder = Object.keys(EXPENSE_CATEGORY_PRESENTATION);
    return [...categoryTotals.entries()]
      .map(([category, amount]) => ({
        category,
        amount,
        color:
          EXPENSE_CATEGORY_PRESENTATION[category]?.color ?? "bg-slate-400",
      }))
      .sort((left, right) => {
        const leftIndex = categoryOrder.indexOf(left.category);
        const rightIndex = categoryOrder.indexOf(right.category);
        if (leftIndex < 0) return rightIndex < 0 ? 0 : 1;
        if (rightIndex < 0) return -1;
        return leftIndex - rightIndex;
      });
  }, [expensesHidden, monthExpenses]);
  const categorySpendingTotal = expenseCategoryShares.reduce(
    (total, category) => total + category.amount,
    0,
  );
  const utilizationBarWidth =
    privateFinancialDataHidden || categorySpendingTotal <= 0
      ? 0
      : Math.min(Math.max(percentage, 0), 100);
  const previousUtilizationWidthRef = useRef(utilizationBarWidth);
  const previousFinancePeriodRef = useRef(activeFinancePeriodSelection);
  const [ghostPercent, setGhostPercent] = useState(null);
  useEffect(() => {
    const previousWidth = previousUtilizationWidthRef.current;
    const previousSelection = previousFinancePeriodRef.current;
    previousUtilizationWidthRef.current = utilizationBarWidth;
    previousFinancePeriodRef.current = activeFinancePeriodSelection;
    if (
      !previousSelection.startsWith("period:") ||
      !activeFinancePeriodSelection.startsWith("period:") ||
      previousSelection === activeFinancePeriodSelection ||
      Math.abs(previousWidth - utilizationBarWidth) < 0.1 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setGhostPercent(null);
      return undefined;
    }

    setGhostPercent(previousWidth);
    const timeoutId = window.setTimeout(
      () => setGhostPercent(null),
      GHOST_TRAIL_DURATION_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [activeFinancePeriodSelection, utilizationBarWidth]);
  const utilizationBarSegments = useMemo(() => {
    let left = 0;
    const segments = expenseCategoryShares.map((category) => {
      const width =
        categorySpendingTotal > 0
          ? utilizationBarWidth * (category.amount / categorySpendingTotal)
          : 0;
      const segment = { ...category, left, width };
      left += width;
      return segment;
    });
    const activeIndexes = segments
      .map((segment, index) => (segment.width > 0 ? index : -1))
      .filter((index) => index >= 0);
    const firstActiveIndex = activeIndexes[0] ?? -1;
    const lastActiveIndex = activeIndexes[activeIndexes.length - 1] ?? -1;
    return segments.map((segment, index) => ({
      ...segment,
      borderRadius:
        index === firstActiveIndex && index === lastActiveIndex
          ? "9999px"
          : index === firstActiveIndex
            ? "9999px 0 0 9999px"
            : index === lastActiveIndex
              ? "0 9999px 9999px 0"
              : "0",
    }));
  }, [categorySpendingTotal, expenseCategoryShares, utilizationBarWidth]);
  const cutoffHistoryCards = useMemo(
    () =>
      (financeCutoffHistory || []).map((item) => {
        const spent = validExpenses.reduce((total, expense) => {
          const date = getExpenseDate(expense);
          const amount = Number(expense.amount);
          return date >= item.period.startDate &&
            date <= item.period.endDate &&
            Number.isFinite(amount) &&
            amount > 0
            ? total + amount
            : total;
        }, 0);
        return {
          ...item,
          spent,
          ...getBudgetUtilization(item.netPay, spent),
        };
      }),
    [financeCutoffHistory, validExpenses],
  );
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
      {activeTab !== "expenses" && (
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
      )}
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:justify-end">
                <span className="shrink-0 text-[11px] font-medium text-slate-400">
                  Active Period:
                </span>
                <div
                  className="flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
                  aria-label="Active finance period"
                >
                  {financeCutoffHistory.map((item) => {
                    const value = `period:${item.period.endDate}`;
                    const isSelected = activeFinancePeriodSelection === value;
                    return (
                      <button
                        key={item.period.endDate}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => selectFinanceTrackingScope(value)}
                        className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${
                          isSelected
                            ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200"
                            : "text-slate-600 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        {item.isCurrent ? "Current: " : ""}
                        {formatCutoffHistoryPeriod(item.period)}
                      </button>
                    );
                  })}
                  {[
                    { value: "all-history", label: "All History" },
                    { value: "custom-range", label: "Custom Range" },
                  ].map((option) => {
                    const isSelected =
                      activeFinancePeriodSelection === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          if (
                            option.value === "custom-range" &&
                            !financeCustomRange.startDate &&
                            !financeCustomRange.endDate &&
                            financeCutoffHistory[0]
                          ) {
                            setFinanceCustomRange({
                              startDate:
                                financeCutoffHistory[0].period.startDate <= today
                                  ? financeCutoffHistory[0].period.startDate
                                  : today,
                              endDate: today,
                            });
                          }
                          selectFinanceTrackingScope(option.value);
                        }}
                        className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${
                          isSelected
                            ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200"
                            : "text-slate-600 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        {activeTab === "expenses" &&
          activeFinancePeriodSelection === "custom-range" && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-700">
                <CalendarDays size={14} aria-hidden="true" />
                <h3>Custom Expense History Range</h3>
              </div>
              <div className="flex items-center gap-2">
                <label>
                  <span className="sr-only">Custom range start date</span>
                  <input
                    type="date"
                    value={financeCustomRange.startDate}
                    max={today}
                    onChange={(event) =>
                      setFinanceCustomRange((range) => ({
                        ...range,
                        startDate: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>
                <span className="text-[10px] text-slate-400">to</span>
                <label>
                  <span className="sr-only">Custom range end date</span>
                  <input
                    type="date"
                    value={financeCustomRange.endDate}
                    min={financeCustomRange.startDate || undefined}
                    max={today}
                    onChange={(event) =>
                      setFinanceCustomRange((range) => ({
                        ...range,
                        endDate: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>
              </div>
            </section>
          )}
        {activeTab === "expenses" ? (
          <>
            {privateFinancialDataStatus === "ready" &&
              pendingPayrollRecords > 0 && (
                <p
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900"
                  role="status"
                >
                  {`${pendingPayrollRecords} attendance record(s) in this finance period still need payroll settings or complete time data. Those records are excluded from calculated totals until resolved.`}
                </p>
              )}
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
                  {privateFinancialDataHidden
                    ? "Private data unavailable"
                    : formatCurrency(grossPay)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{`${totalHours.toFixed(2)} Total Hours`}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-600">
                    Estimated Period Deductions
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-500">
                    <FileText size={13} aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-base font-extrabold tabular-nums text-slate-900">
                  {privateFinancialDataHidden
                    ? "Private data unavailable"
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
                  {privateFinancialDataHidden
                    ? "Private data unavailable"
                    : formatCurrency(netPay)}
                </p>
                <span className="mt-0.5 inline-block rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-medium text-emerald-700">
                  Estimate only
                </span>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-rose-700">
                    Expenses in active period
                  </span>
                  <ArrowDownRight
                    size={13}
                    className="text-rose-500"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 text-base font-extrabold tabular-nums text-rose-600">
                  {expensesHidden
                    ? "Private data unavailable"
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
                    ? "Private data unavailable"
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
                  {privateFinancialDataStatus === "migration-required"
                    ? "Migrate existing private financial data in Settings to view and manage expense history."
                    : privateFinancialDataStatus === "unavailable"
                      ? "Private financial storage is not configured on this server."
                      : "Private financial data is not available. Retry cloud loading to view and manage expense history."}
                </p>
              </div>
            ) : (
              <>
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
                <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <ChartPie
                        size={14}
                        className="shrink-0 text-teal-600"
                        aria-hidden="true"
                      />
                      <h3 className="text-[11px] font-bold text-slate-800">
                        Budget utilization &amp; category share
                      </h3>
                      <span
                        key={activeFinancePeriodSelection}
                        className="budget-period-date-slide text-[10px] text-slate-400"
                        style={{
                          "--period-slide-offset": `${cutoffDirection * 10}px`,
                        }}
                      >
                        ({financePeriodLabel})
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {!privateFinancialDataHidden && (
                        <button
                          type="button"
                          aria-expanded={isCutoffHistoryVisible}
                          onClick={() =>
                            setIsCutoffHistoryVisible((visible) => !visible)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100"
                        >
                          <History size={12} aria-hidden="true" />
                          {isCutoffHistoryVisible
                            ? "Hide Cutoff History"
                            : "Show Cutoff History"}
                        </button>
                      )}
                      <span
                        className={`flex items-center gap-2 text-[11px] font-extrabold ${
                          percentage > 100
                            ? "text-rose-600"
                            : "text-amber-600"
                        }`}
                      >
                        {privateFinancialDataHidden
                          ? "Private"
                          : (
                            <>
                              <span className="text-slate-700">
                                <AnimatedCurrency
                                  value={categorySpendingTotal}
                                  formatCurrency={formatCurrency}
                                />
                              </span>
                              <span>{`${animatedPercentage.toFixed(1)}% spent`}</span>
                            </>
                          )}
                      </span>
                    </div>
                  </div>
                  <div
                    className="budget-track"
                    style={{
                      "--budget-progress": `${utilizationBarWidth}%`,
                    }}
                    role="progressbar"
                    aria-label="Budget utilization by expense category"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={
                      privateFinancialDataHidden
                        ? 0
                        : Math.min(Math.max(percentage, 0), 100)
                    }
                  >
                    {utilizationBarSegments.map((segment) => (
                        <div
                          key={segment.category}
                          className={`cat-segment ${segment.color}`}
                          style={{
                            left: `${segment.left}%`,
                            width: `${segment.width}%`,
                            borderRadius: segment.borderRadius,
                            opacity: segment.width > 0 ? 1 : 0,
                          }}
                          title={`${segment.category}: ${formatCurrency(segment.amount)}`}
                        />
                    ))}
                    {ghostPercent !== null && (
                      <div
                        key={`${activeFinancePeriodSelection}-${ghostPercent}`}
                        className="budget-utilization-ghost pointer-events-none absolute inset-y-0"
                        aria-hidden="true"
                        style={{
                          "--ghost-from": `${ghostPercent}%`,
                          "--ghost-to": `${utilizationBarWidth}%`,
                          width: `${ghostPercent}%`,
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex min-h-6 min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
                      {expenseCategoryShares.length > 0 ? (
                        expenseCategoryShares.map((category, index) => (
                          <AnimatedCategoryShare
                            key={category.category}
                            category={category}
                            index={index}
                            total={categorySpendingTotal}
                            activeSelection={activeFinancePeriodSelection}
                            formatCurrency={formatCurrency}
                          />
                        ))
                      ) : (
                        <span
                          key={activeFinancePeriodSelection}
                          className="budget-category-fade text-[10px] text-slate-400"
                        >
                          {privateFinancialDataHidden
                            ? "Private category data"
                            : "No spending recorded for this cutoff"}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[9px] text-slate-400">
                      Cap:{" "}
                      <strong className="font-medium text-slate-500">
                        {privateFinancialDataHidden
                          ? "Private"
                          : <AnimatedCurrency value={netPay} formatCurrency={formatCurrency} />}
                      </strong>
                    </span>
                  </div>
                  {!privateFinancialDataHidden && (
                    <div
                      aria-hidden={!isCutoffHistoryVisible}
                      inert={!isCutoffHistoryVisible}
                      className={`accordion-wrapper ${
                        isCutoffHistoryVisible ? "" : "is-collapsed"
                      }`}
                    >
                      <div className="accordion-inner">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          {cutoffHistoryCards.map((card) => {
                            const budgetAvailable =
                              card.pendingCount === 0 && card.netPay > 0;
                            const budgetStatus =
                              card.pendingCount > 0
                                ? "Payroll pending"
                                : "Budget unavailable";
                            return (
                              <button
                                type="button"
                                onClick={() =>
                                  selectFinanceTrackingScope(
                                    `period:${card.period.endDate}`,
                                  )
                                }
                                aria-pressed={card.isSelected}
                                key={card.period.startDate}
                                className={`cutoff-card w-full rounded-xl border px-3 py-2.5 text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                                  card.isSelected
                                    ? "is-selected border-emerald-400 bg-emerald-50/40"
                                    : "border-slate-200 bg-slate-50/40"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-[10px]">
                                  <span className="font-semibold text-slate-700">
                                    {card.isCurrent ? "Current: " : ""}
                                    {formatCutoffHistoryPeriod(card.period)}
                                  </span>
                                  <span className="shrink-0 text-slate-400">
                                    {budgetAvailable
                                      ? `${Math.round(card.percentage)}% used`
                                      : budgetStatus}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-extrabold tabular-nums text-slate-900">
                                  <AnimatedCurrency
                                    value={card.spent}
                                    formatCurrency={formatCurrency}
                                  />
                                </p>
                                <p className="mt-0.5 text-[9px] text-slate-500">
                                  {budgetAvailable
                                    ? (
                                      <>
                                        Left:{" "}
                                        <AnimatedCurrency
                                          value={card.remaining}
                                          formatCurrency={formatCurrency}
                                        />
                                      </>
                                    )
                                    : budgetStatus}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4 lg:self-start">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                        <Plus size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          {editingExpenseId ? "Edit expense" : "Add an expense"}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {editingExpenseId
                            ? "Update this purchase or bill."
                            : "Record a purchase or bill."}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-[11px] font-medium text-slate-700"
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
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label
                          className="mb-1 block text-[11px] font-medium text-slate-700"
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
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
                          className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <option value="Utilities">Utilities</option>
                          <option value="Food & Dining">Food &amp; Dining</option>
                          <option value="Food & Groceries">
                            Food &amp; Groceries
                          </option>
                          <option value="Groceries">Groceries</option>
                          <option value="Transport">
                            Transport &amp; Commute
                          </option>
                          <option value="Travel & Accommodation">
                            Travel &amp; Accommodation
                          </option>
                          <option value="Miscellaneous">Miscellaneous</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label
                          className="mb-1 block text-[11px] font-medium text-slate-700"
                          htmlFor="expenseDate"
                        >
                          Expense date
                        </label>
                        <input
                          type="date"
                          id="expenseDate"
                          value={expenseDate}
                          onChange={(event) =>
                            setExpenseDate(event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1 block text-[11px] font-medium text-slate-700"
                          htmlFor="expensePaymentMethod"
                        >
                          Payment Method
                        </label>
                        <select
                          id="expensePaymentMethod"
                          value={expensePaymentMethod}
                          onChange={(event) =>
                            setExpensePaymentMethod(event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <option value="Cash">Cash</option>
                          <option value="GCash">GCash</option>
                          <option value="Maya">Maya</option>
                          <option value="Bank transfer">Bank transfer</option>
                          <option value="Credit card">Credit card</option>
                          <option value="Debit card">Debit card</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-[11px] font-medium text-slate-700"
                        htmlFor="expenseNote"
                      >
                        Note <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <input
                        type="text"
                        id="expenseNote"
                        value={expenseNote}
                        onChange={(event) => setExpenseNote(event.target.value)}
                        maxLength={500}
                        placeholder="e.g., Shift meal, October statement..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <button
                      type="button"
                      data-action="addExpense()"
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      <Plus size={14} aria-hidden="true" />
                      {editingExpenseId ? "Update expense" : "Save expense"}
                    </button>
                    {editingExpenseId && (
                      <button
                        type="button"
                        onClick={onCancelExpenseEdit}
                        className="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Cancel edit
                      </button>
                    )}
                  </section>
                  <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-8">
                  <header className="space-y-3 border-b border-slate-200 p-4 sm:px-5">
                    <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            Past Expenses &amp; Cutoff Ledger
                          </h3>
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                            {displayedExpenses.length} items
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Showing records for {expenseLedgerRangeLabel}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="relative min-w-[190px] flex-1 xl:flex-none">
                          <span className="sr-only">
                            Search merchant, note, or payment method
                          </span>
                          <Search
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            aria-hidden="true"
                          />
                          <input
                            type="search"
                            value={expenseSearch}
                            onChange={(event) =>
                              setExpenseSearch(event.target.value)
                            }
                            placeholder="Search merchant, note, method..."
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 xl:w-56"
                          />
                        </label>
                        <label className="relative">
                          <span className="sr-only">Sort expense records</span>
                          <select
                            value={expenseSort}
                            onChange={(event) =>
                              setExpenseSort(event.target.value)
                            }
                            className="rounded-xl border border-emerald-400 bg-white py-2 pl-8 pr-8 text-[11px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                          >
                            <option value="newest">Newest First</option>
                            <option value="highest">Highest Amount</option>
                            <option value="lowest">Lowest Amount</option>
                          </select>
                          <i
                            className="fa-solid fa-arrow-up-wide-short pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400"
                            aria-hidden="true"
                          ></i>
                        </label>
                      </div>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <Filter
                        size={14}
                        className="shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5">
                        {expenseCategoryFilters.map((filter) => (
                          <button
                            key={filter.key}
                            type="button"
                            aria-pressed={expenseCategoryFilter === filter.key}
                            onClick={() =>
                              setExpenseCategoryFilter(filter.key)
                            }
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition ${
                              expenseCategoryFilter === filter.key
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {filter.label}
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                                expenseCategoryFilter === filter.key
                                  ? "bg-white/15 text-white"
                                  : "bg-slate-200/70 text-slate-600"
                              }`}
                            >
                              {filter.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </header>
                  <div className="min-h-0 max-h-[460px] flex-1 overflow-y-auto">
                    {expenseLedgerGroups.length === 0 ? (
                      <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
                        <Receipt
                          size={20}
                          className="text-slate-400"
                          aria-hidden="true"
                        />
                        <p className="mt-3 text-xs font-semibold text-slate-600">
                          {displayedExpenses.length === 0
                            ? "No expenses recorded in this period"
                            : "No expenses match these filters"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {displayedExpenses.length === 0
                            ? "Add an expense to start tracking your spending."
                            : "Try a different search or category."}
                        </p>
                      </div>
                    ) : (
                      expenseLedgerGroups.map((group) => (
                        <section key={group.date}>
                          <button
                            type="button"
                            aria-expanded={!collapsedExpenseDays.has(group.date)}
                            aria-controls={`expense-day-${group.date}`}
                            onClick={() =>
                              setCollapsedExpenseDays((current) => {
                                const next = new Set(current);
                                if (next.has(group.date)) {
                                  next.delete(group.date);
                                } else {
                                  next.add(group.date);
                                }
                                return next;
                              })
                            }
                            className="sticky top-0 z-10 flex w-full flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-left transition hover:bg-slate-100 sm:px-5"
                          >
                            <span className="flex flex-wrap items-center gap-2">
                              <ChevronDown
                                size={14}
                                className={`text-slate-400 transition-transform ${
                                  collapsedExpenseDays.has(group.date)
                                    ? "-rotate-90"
                                    : ""
                                }`}
                                aria-hidden="true"
                              />
                              <span className="text-[11px] font-bold text-slate-700">
                                {formatExpenseLedgerDate(group.date, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-500">
                                {group.cutoffLabel}
                              </span>
                            </span>
                            <span className="text-[10px] font-semibold text-slate-600">
                              {formatCurrency(group.subtotal)}
                            </span>
                          </button>
                          <div
                            id={`expense-day-${group.date}`}
                            aria-hidden={collapsedExpenseDays.has(group.date)}
                            inert={collapsedExpenseDays.has(group.date)}
                            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${
                              collapsedExpenseDays.has(group.date)
                                ? "grid-rows-[0fr] opacity-0"
                                : "grid-rows-[1fr] opacity-100"
                            }`}
                          >
                            <div className="min-h-0 overflow-hidden">
                              {group.items.map((expense) => {
                                const category = getExpenseLedgerCategory(
                                  expense.category,
                                );
                                const paymentMethod =
                                  expense.method || expense.paymentMethod;
                                const note = expense.notes || expense.note;
                                const metadata = [
                                  formatExpenseLedgerTime(expense),
                                  paymentMethod,
                                  note,
                                ].filter(Boolean);
                                return (
                                  <div
                                    key={expense.id}
                                    className="group flex min-h-[62px] items-center gap-2.5 border-b border-slate-100 px-3.5 py-2.5 last:border-b-0 sm:gap-3 sm:px-5"
                                  >
                                    <span
                                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${category.color}`}
                                    >
                                      <category.Icon
                                        size={15}
                                        aria-hidden="true"
                                      />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                        <p className="max-w-full truncate text-[11px] font-semibold text-slate-900">
                                          {expense.name}
                                        </p>
                                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                                          {category.label}
                                        </span>
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-500">
                                        {metadata.map((value, index) => (
                                          <span
                                            key={`${expense.id}-meta-${index}`}
                                            className="inline-flex items-center gap-2"
                                          >
                                            {index > 0 && (
                                              <span aria-hidden="true">·</span>
                                            )}
                                            <span className="truncate">
                                              {value}
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onDuplicateExpense(expense)
                                        }
                                        className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                                        title="Duplicate expense"
                                        aria-label={`Duplicate ${expense.name}`}
                                      >
                                        <Copy size={14} aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onEditExpense(expense)}
                                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                        title="Edit expense"
                                        aria-label={`Edit ${expense.name}`}
                                      >
                                        <Pencil size={14} aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onDeleteExpense(expense.id)
                                        }
                                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                        title="Delete expense"
                                        aria-label={`Delete ${expense.name}`}
                                      >
                                        <Trash2 size={14} aria-hidden="true" />
                                      </button>
                                    </div>
                                    <span className="min-w-[82px] text-right text-[11px] font-extrabold tabular-nums text-slate-900">
                                      {formatCurrency(expense.amount)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </section>
                      ))
                    )}
                  </div>
                  <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-[10px] text-slate-500 sm:px-5">
                    <span>{`Showing ${filteredExpenses.length} of ${displayedExpenses.length} period transactions`}</span>
                    <span>
                      Filtered Total:{" "}
                      <strong className="ml-1 text-xs font-extrabold tabular-nums text-slate-900">
                        {formatCurrency(filteredExpenseTotal)}
                      </strong>
                    </span>
                  </footer>
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
            privateFinancialDataStatus={privateFinancialDataStatus}
            privateFinancialDataError={privateFinancialDataError}
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
            {privateFinancialDataStatus !== "ready" ? (
              <div
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"
                role="status"
              >
                {privateFinancialDataStatus === "migration-required"
                  ? "Migrate existing private financial data in Settings to browse historical payslips."
                  : privateFinancialDataStatus === "unavailable"
                    ? "Private financial storage is not configured on this server."
                    : "Private financial data is not available. Retry cloud loading to save and browse payslip history."}
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
