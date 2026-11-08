import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatTravelCurrency,
  getTravelBudgetStatus,
  getTravelPlanStatus,
  getTravelPlanTotals,
  normalizeTravelPeople,
  travelExpenseCategories,
  validateTravelExpense,
  validateTravelPlan,
} from "../../utils/travelPlanner.js";

const currencyOptions = [
  ["PHP", "PHP - Philippine peso"],
  ["USD", "USD - US dollar"],
  ["EUR", "EUR - Euro"],
  ["JPY", "JPY - Japanese yen"],
  ["GBP", "GBP - British pound"],
  ["AUD", "AUD - Australian dollar"],
  ["CAD", "CAD - Canadian dollar"],
  ["SGD", "SGD - Singapore dollar"],
];
const paymentMethods = ["Cash", "Credit card", "Debit card", "Bank transfer", "E-wallet", "Other"];
const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20";
const labelClass = "flex flex-col gap-1 text-[11px] font-semibold text-slate-600";

function getLocalDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function emptyPlanDraft(today) {
  return {
    name: "",
    destination: "",
    startDate: today,
    endDate: today,
    budget: "",
    currency: "PHP",
    notes: "",
  };
}

function emptyExpenseDraft(date) {
  return {
    name: "",
    category: "Flights",
    date,
    amount: "",
    paidBy: "",
    forPeopleInput: "",
    splitEqually: false,
    method: "",
    notes: "",
  };
}

function formatDateRange(startDate, endDate) {
  const options = { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" };
  const start = new Intl.DateTimeFormat("en-US", options).format(
    new Date(`${startDate}T00:00:00Z`),
  );
  const end = new Intl.DateTimeFormat("en-US", options).format(
    new Date(`${endDate}T00:00:00Z`),
  );
  return `${start} - ${end}`;
}

function statusStyles(status, selected = false) {
  if (selected) {
    return status === "Completed"
      ? "border border-emerald-200/20 bg-white/10 text-emerald-300"
      : "border border-blue-200/20 bg-white/10 text-blue-200";
  }
  if (status === "Completed") return "border border-emerald-100 bg-emerald-50 text-emerald-700";
  if (status === "Ongoing") return "border border-sky-100 bg-sky-50 text-sky-700";
  return "border border-blue-100 bg-blue-50 text-blue-700";
}

function budgetStyles(percentage) {
  if (percentage > 100) {
    return {
      label: getTravelBudgetStatus(percentage),
      bar: "bg-rose-600",
      text: "text-rose-700",
      surface: "border-rose-200 bg-rose-50 text-rose-800",
    };
  }
  if (percentage >= 90) {
    return {
      label: getTravelBudgetStatus(percentage),
      bar: "bg-orange-500",
      text: "text-orange-700",
      surface: "border-orange-200 bg-orange-50 text-orange-800",
    };
  }
  if (percentage >= 75) {
    return {
      label: getTravelBudgetStatus(percentage),
      bar: "bg-amber-500",
      text: "text-amber-700",
      surface: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  return {
    label: getTravelBudgetStatus(percentage),
    bar: "bg-teal-600",
    text: "text-teal-700",
    surface: "border-teal-200 bg-teal-50 text-teal-800",
  };
}

export default function TravelBudgetPlanner({
  travelPlans,
  today,
  workspaceLoading,
  workspaceError,
  workspaceSaveError,
  requestConfirmation,
  onCreatePlan,
  onUpdatePlan,
  onCompletePlan,
  onDeletePlan,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}) {
  const effectiveToday = today || getLocalDateKey();
  const [selectedTripId, setSelectedTripId] = useState("");
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState("");
  const [planDraft, setPlanDraft] = useState(() => emptyPlanDraft(effectiveToday));
  const [planError, setPlanError] = useState("");
  const [expenseDraft, setExpenseDraft] = useState(() => emptyExpenseDraft(effectiveToday));
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");

  const plans = Array.isArray(travelPlans) ? travelPlans : [];
  const selectedTrip =
    plans.find((plan) => plan.id === selectedTripId) || plans[0] || null;
  const selectedStatus = selectedTrip
    ? getTravelPlanStatus(selectedTrip, effectiveToday)
    : "";
  const selectedTotals = selectedTrip ? getTravelPlanTotals(selectedTrip) : null;
  const expenseCategories = selectedTrip
    ? [...new Set([
        ...travelExpenseCategories,
        ...selectedTrip.expenses.map((expense) => expense.category),
      ])]
    : travelExpenseCategories;
  const filteredExpenses = useMemo(() => {
    if (!selectedTrip) return [];
    return selectedTrip.expenses
      .filter((expense) => {
        if (categoryFilter !== "all" && expense.category !== categoryFilter) return false;
        if (dateFrom && expense.date < dateFrom) return false;
        if (dateTo && expense.date > dateTo) return false;
        return true;
      })
      .sort((left, right) =>
        sortOrder === "newest"
          ? right.date.localeCompare(left.date)
          : left.date.localeCompare(right.date),
      );
  }, [categoryFilter, dateFrom, dateTo, selectedTrip, sortOrder]);
  const planIsLocked = selectedStatus === "Completed";

  const deletePlan = async (plan) => {
    const confirmed = await requestConfirmation({
      title: "Delete travel plan?",
      message: `Delete "${plan.name}" and all ${plan.expenses.length} associated expense${plan.expenses.length === 1 ? "" : "s"}? This cannot be undone.`,
      confirmLabel: "Delete trip",
      variant: "danger",
    });
    if (confirmed && onDeletePlan(plan.id)) {
      if (selectedTripId === plan.id) {
        setSelectedTripId("");
        setShowExpenseForm(false);
        setEditingExpenseId("");
      }
    }
  };

  const beginCreatePlan = () => {
    setPlanDraft(emptyPlanDraft(effectiveToday));
    setPlanError("");
    setEditingPlanId("");
    setShowPlanForm(true);
  };

  const beginEditPlan = (plan) => {
    setPlanDraft({
      name: plan.name,
      destination: plan.destination,
      startDate: plan.startDate,
      endDate: plan.endDate,
      budget: String(plan.budget),
      currency: plan.currency || "PHP",
      notes: plan.notes || "",
    });
    setPlanError("");
    setEditingPlanId(plan.id);
    setShowPlanForm(true);
  };

  const submitPlan = (event) => {
    event.preventDefault();
    const validationError = validateTravelPlan(planDraft);
    if (validationError) {
      setPlanError(validationError);
      return;
    }
    const saved = editingPlanId
      ? onUpdatePlan(editingPlanId, planDraft)
      : onCreatePlan(planDraft);
    if (saved) {
      setShowPlanForm(false);
      setPlanError("");
      setEditingPlanId("");
      if (!editingPlanId) setSelectedTripId(saved);
    }
  };

  const beginAddExpense = () => {
    const date = selectedTrip.startDate > effectiveToday
      ? selectedTrip.startDate
      : effectiveToday > selectedTrip.endDate
        ? selectedTrip.endDate
        : effectiveToday;
    setExpenseDraft(emptyExpenseDraft(date));
    setExpenseError("");
    setEditingExpenseId("");
    setShowExpenseForm(true);
  };

  const beginEditExpense = (expense) => {
    setExpenseDraft({
      name: expense.name,
      category: expense.category,
      date: expense.date,
      amount: String(expense.amount),
      paidBy: expense.paidBy || "",
      forPeopleInput: (expense.forPeople || []).join(", "),
      splitEqually: expense.splitEqually === true,
      method: expense.method || "",
      notes: expense.notes || "",
    });
    setExpenseError("");
    setEditingExpenseId(expense.id);
    setShowExpenseForm(true);
  };

  const submitExpense = (event) => {
    event.preventDefault();
    const forPeople = normalizeTravelPeople(
      expenseDraft.forPeopleInput.split(/[,;\n]/),
    );
    const payload = {
      ...expenseDraft,
      name: expenseDraft.name.trim() || expenseDraft.category.trim() || "Expense",
      forPeople,
      paidBy: expenseDraft.paidBy.trim(),
      splitEqually: expenseDraft.splitEqually && forPeople.length > 1,
    };
    const validationError = validateTravelExpense(payload);
    if (validationError) {
      setExpenseError(validationError);
      return;
    }
    const saved = editingExpenseId
      ? onUpdateExpense(selectedTrip.id, editingExpenseId, payload)
      : onAddExpense(selectedTrip.id, payload);
    if (saved) {
      setExpenseDraft(emptyExpenseDraft(selectedTrip.startDate));
      setEditingExpenseId("");
      setExpenseError("");
      setShowExpenseForm(false);
    }
  };

  return (
    <div className="space-y-4">
      {workspaceLoading && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500" role="status">
          Loading saved travel plans…
        </p>
      )}
      {workspaceError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {`Travel plans could not be loaded. ${workspaceError}`}
        </p>
      )}
      {workspaceSaveError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {`Travel changes are not confirmed as saved. ${workspaceSaveError}`}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <section
          className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm xl:col-span-4"
          aria-label="Travel plans"
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Your trips ({plans.length})
            </h3>
            <button
              type="button"
              disabled={workspaceLoading}
              onClick={beginCreatePlan}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
            >
              <i className="fa-solid fa-plus mr-1" aria-hidden="true"></i>New
            </button>
          </div>
          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <i className="fa-solid fa-suitcase-rolling text-xl text-slate-300" aria-hidden="true"></i>
              <p className="mt-2 text-xs font-semibold text-slate-700">No trips yet</p>
              <p className="mt-1 text-[11px] text-slate-500">Create a trip to start tracking your budget.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {plans.map((plan) => {
                const status = getTravelPlanStatus(plan, effectiveToday);
                const totals = getTravelPlanTotals(plan);
                const style = budgetStyles(totals.percentage);
                const isSelected = selectedTrip?.id === plan.id;
                return (
                  <button
                    type="button"
                    key={plan.id}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedTripId(plan.id);
                      setEditingExpenseId("");
                      setShowExpenseForm(false);
                    }}
                    className={`w-full rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white shadow-md"
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className={`block truncate text-sm font-bold ${isSelected ? "text-white" : "text-slate-900"}`}>{plan.name}</span>
                        <span className={`mt-1 block truncate text-[11px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                          <i className="fa-solid fa-location-dot mr-1.5" aria-hidden="true"></i>{plan.destination}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${statusStyles(status, isSelected)}`}>
                        {status === "Completed" && <i className="fa-regular fa-circle-check mr-1" aria-hidden="true"></i>}
                        {status}
                      </span>
                    </span>
                    <span className={`mt-3 flex justify-between gap-2 text-[10px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                      <span>{plan.startDate}</span>
                      <span className={`font-bold ${isSelected ? "text-white" : style.text}`}>{totals.percentage.toFixed(0)}%</span>
                    </span>
                    <span className={`mt-1.5 block h-1.5 overflow-hidden rounded-full ${isSelected ? "bg-white/15" : "bg-slate-100"}`}>
                      <span
                        className={`block h-full rounded-full ${isSelected ? "bg-emerald-400" : style.bar}`}
                        style={{ width: `${Math.min(totals.percentage, 100)}%` }}
                      />
                    </span>
                    <span className={`mt-2.5 flex justify-between gap-2 text-[10px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                      <span>Spent {formatTravelCurrency(totals.spent, plan.currency)}</span>
                      <span className={`font-semibold ${isSelected ? "text-white" : "text-slate-700"}`}>Budget: {formatTravelCurrency(totals.budget, plan.currency)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="min-w-0 space-y-4 xl:col-span-8">
          {selectedTrip && selectedTotals ? (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-extrabold text-slate-900">{selectedTrip.name}</h3>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${statusStyles(selectedStatus)}`}>
                        {selectedStatus === "Completed" && <i className="fa-regular fa-circle-check mr-1" aria-hidden="true"></i>}
                        {selectedStatus}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span><i className="fa-solid fa-location-dot mr-1.5 text-slate-400" aria-hidden="true"></i>{selectedTrip.destination}</span>
                      <span><i className="fa-regular fa-calendar mr-1.5 text-slate-400" aria-hidden="true"></i>{formatDateRange(selectedTrip.startDate, selectedTrip.endDate)}</span>
                    </p>
                    {selectedTrip.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{selectedTrip.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!planIsLocked && (
                      <>
                        <button
                          type="button"
                          onClick={() => beginEditPlan(selectedTrip)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          <i className="fa-solid fa-pen mr-1.5" aria-hidden="true"></i>Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmed = await requestConfirmation({
                              title: "Complete this trip?",
                              message: "Completing this trip preserves its final spending history and makes the trip read-only.",
                              confirmLabel: "Complete trip",
                              variant: "warning",
                            });
                            if (confirmed) onCompletePlan(selectedTrip.id);
                          }}
                          className="rounded-lg border border-emerald-200 px-3 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          Mark complete
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => deletePlan(selectedTrip)}
                      disabled={workspaceLoading}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <i className="fa-solid fa-trash-can mr-1.5" aria-hidden="true"></i>Delete trip
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {[
                    {
                      label: "Total budget",
                      amount: selectedTotals.budget,
                      caption: "Allocated budget",
                      icon: "fa-wallet",
                      color: "text-slate-900",
                    },
                    {
                      label: "Total spent",
                      amount: selectedTotals.spent,
                      caption: `${selectedTotals.percentage.toFixed(0)}% of budget used`,
                      icon: "fa-arrow-trend-up",
                      color: selectedTotals.percentage > 100 ? "text-rose-700" : "text-slate-900",
                    },
                    {
                      label: selectedTotals.remaining >= 0 ? "Remaining budget" : "Overspent",
                      amount: Math.abs(selectedTotals.remaining),
                      caption: selectedTotals.remaining >= 0 ? "Available to spend" : "Over planned budget",
                      icon: "fa-chart-pie",
                      color: selectedTotals.remaining >= 0 ? "text-emerald-600" : "text-rose-700",
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-slate-500">{item.label}</span>
                        <i className={`fa-solid ${item.icon} text-[11px] text-slate-400`} aria-hidden="true"></i>
                      </div>
                      <span className={`mt-1.5 block break-words text-lg font-extrabold tabular-nums ${item.color}`}>
                        {formatTravelCurrency(item.amount, selectedTrip.currency)}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-400">{item.caption}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Expense Records</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">Track and categorize your trip spending</p>
                  </div>
                  {!planIsLocked && (
                    <button
                      type="button"
                      onClick={beginAddExpense}
                      className="rounded-lg bg-slate-900 px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                    >
                      <i className="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>Add Expense
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                      <i className="fa-solid fa-filter text-slate-400" aria-hidden="true"></i>Filter:
                      <select
                        aria-label="Filter travel expenses by category"
                        className={`${inputClass} w-auto min-w-32 py-1.5`}
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                      >
                        <option value="all">All</option>
                        {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </label>
                    <details className="relative text-[11px] text-slate-500">
                      <summary className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium hover:bg-slate-50">Dates</summary>
                      <div className="absolute left-0 z-10 mt-1 flex w-64 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                        <label className="flex items-center justify-between gap-2">From<input aria-label="Filter travel expenses from date" type="date" className={inputClass} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
                        <label className="flex items-center justify-between gap-2">To<input aria-label="Filter travel expenses to date" type="date" className={inputClass} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
                      </div>
                    </details>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                    <i className="fa-solid fa-arrow-down-wide-short text-slate-400" aria-hidden="true"></i>Sort:
                    <select
                      aria-label="Sort travel expenses"
                      className={`${inputClass} w-auto py-1.5`}
                      value={sortOrder}
                      onChange={(event) => setSortOrder(event.target.value)}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        <th scope="col" className="px-1 py-2.5">Description</th>
                        <th scope="col" className="px-2 py-2.5">Category</th>
                        <th scope="col" className="px-2 py-2.5">Date</th>
                        <th scope="col" className="px-2 py-2.5 text-right">Amount</th>
                        <th scope="col" className="px-2 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-2 py-10 text-center text-xs text-slate-400">
                            {selectedTrip.expenses.length === 0 ? "No expenses recorded for this trip yet." : "No expenses match these filters."}
                          </td>
                        </tr>
                      ) : filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="text-[11px] text-slate-600 transition hover:bg-slate-50/70">
                          <td className="max-w-48 truncate px-1 py-3 font-semibold text-slate-800" title={expense.name}>
                            {expense.name}
                            {(expense.paidBy || expense.method || expense.notes) && (
                              <span className="mt-1 block truncate text-[10px] font-normal text-slate-400">
                                {[expense.paidBy && `Paid by ${expense.paidBy}`, expense.method, expense.notes].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{expense.category}</span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-3 text-slate-500">{expense.date}</td>
                          <td className="whitespace-nowrap px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                            {formatTravelCurrency(expense.amount, selectedTrip.currency)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            {!planIsLocked && (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => beginEditExpense(expense)}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-700"
                                  aria-label={`Edit ${expense.name}`}
                                  title="Edit expense"
                                >
                                  <i className="fa-solid fa-pen text-[10px]" aria-hidden="true"></i>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const confirmed = await requestConfirmation({
                                      title: "Delete travel expense?",
                                      message: `Delete "${expense.name}" dated ${expense.date}? This cannot be undone.`,
                                      confirmLabel: "Delete expense",
                                      variant: "danger",
                                    });
                                    if (confirmed) onDeleteExpense(selectedTrip.id, expense.id);
                                  }}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  aria-label={`Delete ${expense.name}`}
                                  title="Delete expense"
                                >
                                  <i className="fa-solid fa-trash-can text-[10px]" aria-hidden="true"></i>
                                </button>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <section className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <i className="fa-solid fa-suitcase-rolling text-2xl text-slate-300" aria-hidden="true"></i>
              <h3 className="mt-3 text-sm font-bold text-slate-800">Choose a trip to view its budget</h3>
              <p className="mt-1 max-w-xs text-xs text-slate-500">Your trip summary and expense records will appear here.</p>
            </section>
          )}
        </div>
      </div>

      {showPlanForm && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowPlanForm(false);
          }}
        >
          <form
            onSubmit={submitPlan}
            role="dialog"
            aria-modal="true"
            aria-labelledby="travel-plan-dialog-title"
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 id="travel-plan-dialog-title" className="flex items-center gap-2.5 text-base font-bold text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <i className="fa-solid fa-plane" aria-hidden="true"></i>
                </span>
                {editingPlanId ? "Edit Travel Plan" : "Create Travel Plan"}
              </h3>
              <button type="button" onClick={() => setShowPlanForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close travel plan dialog">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <label className={labelClass}>
                Trip name
                <input className={inputClass} maxLength="100" value={planDraft.name} onChange={(event) => setPlanDraft({ ...planDraft, name: event.target.value })} placeholder="e.g. Japan Trip" required />
              </label>
              <label className={labelClass}>
                Destination
                <input className={inputClass} maxLength="100" value={planDraft.destination} onChange={(event) => setPlanDraft({ ...planDraft, destination: event.target.value })} placeholder="e.g. Tokyo, Japan" required />
              </label>
              <label className={labelClass}>
                Total planned budget
                <input className={inputClass} type="number" min="0.01" step="0.01" value={planDraft.budget} onChange={(event) => setPlanDraft({ ...planDraft, budget: event.target.value })} placeholder="25000" required />
              </label>
              <label className={labelClass}>
                Currency
                <select className={inputClass} value={planDraft.currency} onChange={(event) => setPlanDraft({ ...planDraft, currency: event.target.value })}>
                  {currencyOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                Start date
                <input className={inputClass} type="date" value={planDraft.startDate} onChange={(event) => setPlanDraft({ ...planDraft, startDate: event.target.value })} required />
              </label>
              <label className={labelClass}>
                End date
                <input className={inputClass} type="date" value={planDraft.endDate} onChange={(event) => setPlanDraft({ ...planDraft, endDate: event.target.value })} required />
              </label>
            </div>
            {planError && <p className="mt-3 text-xs font-medium text-rose-700" role="alert">{planError}</p>}
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setShowPlanForm(false)} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="submit" disabled={workspaceLoading} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {editingPlanId ? "Save changes" : "Save Travel Plan"}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}

      {showExpenseForm && selectedTrip && !planIsLocked && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditingExpenseId("");
              setShowExpenseForm(false);
            }
          }}
        >
          <form
            onSubmit={submitExpense}
            role="dialog"
            aria-modal="true"
            aria-labelledby="travel-expense-dialog-title"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 id="travel-expense-dialog-title" className="flex items-center gap-2.5 text-base font-bold text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <i className="fa-solid fa-wallet" aria-hidden="true"></i>
                </span>
                {editingExpenseId ? "Edit Expense" : "Add Expense"}
              </h3>
              <button type="button" onClick={() => { setEditingExpenseId(""); setShowExpenseForm(false); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close expense dialog">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <label className={`${labelClass} sm:col-span-2`}>
                Expense description
                <input className={inputClass} maxLength="100" value={expenseDraft.name} onChange={(event) => setExpenseDraft({ ...expenseDraft, name: event.target.value })} placeholder="e.g. Bullet train ticket" required />
              </label>
              <label className={labelClass}>
                Amount ({selectedTrip.currency})
                <input className={inputClass} type="number" min="0.01" step="0.01" value={expenseDraft.amount} onChange={(event) => setExpenseDraft({ ...expenseDraft, amount: event.target.value })} placeholder="0.00" required />
              </label>
              <label className={labelClass}>
                Category
                <select className={inputClass} value={expenseDraft.category} onChange={(event) => setExpenseDraft({ ...expenseDraft, category: event.target.value })} required>
                  {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Date
                <input className={inputClass} type="date" value={expenseDraft.date} onChange={(event) => setExpenseDraft({ ...expenseDraft, date: event.target.value })} required />
              </label>
            </div>
            <details className="mt-4 rounded-lg border border-slate-200 px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">Optional details</summary>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  Paid by
                  <input className={inputClass} maxLength="100" value={expenseDraft.paidBy} onChange={(event) => setExpenseDraft({ ...expenseDraft, paidBy: event.target.value })} placeholder="Name" />
                </label>
                <label className={labelClass}>
                  Payment method
                  <select className={inputClass} value={expenseDraft.method} onChange={(event) => setExpenseDraft({ ...expenseDraft, method: event.target.value })}>
                    <option value="">Not specified</option>
                    {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Expense for (comma-separated names)
                  <input className={inputClass} maxLength="500" value={expenseDraft.forPeopleInput} onChange={(event) => setExpenseDraft({ ...expenseDraft, forPeopleInput: event.target.value })} placeholder="e.g. Alex, Sam" />
                </label>
                <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 sm:col-span-2">
                  <input type="checkbox" checked={expenseDraft.splitEqually} onChange={(event) => setExpenseDraft({ ...expenseDraft, splitEqually: event.target.checked })} />
                  Split this expense equally between the listed people
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Notes
                  <textarea className={inputClass} maxLength="500" rows="2" value={expenseDraft.notes} onChange={(event) => setExpenseDraft({ ...expenseDraft, notes: event.target.value })} placeholder="Optional notes" />
                </label>
              </div>
            </details>
            {expenseError && <p className="mt-3 text-xs font-medium text-rose-700" role="alert">{expenseError}</p>}
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => { setEditingExpenseId(""); setShowExpenseForm(false); }} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="submit" disabled={workspaceLoading} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {editingExpenseId ? "Save Expense" : "Add Expense"}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}
