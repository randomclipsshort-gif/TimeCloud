import { useMemo, useState } from "react";
import {
  formatTravelCurrency,
  getTravelBudgetStatus,
  getTravelCategoryTotals,
  getTravelExpenseAllocations,
  getTravelPeopleReport,
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

function statusStyles(status) {
  if (status === "Completed") return "bg-slate-100 text-slate-600";
  if (status === "Ongoing") return "bg-sky-100 text-sky-700";
  return "bg-violet-100 text-violet-700";
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
  const [paidByFilter, setPaidByFilter] = useState("all");
  const [expenseForFilter, setExpenseForFilter] = useState("all");

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
        if (paidByFilter !== "all" && expense.paidBy !== paidByFilter) return false;
        if (expenseForFilter !== "all" && !(expense.forPeople || []).includes(expenseForFilter)) return false;
        if (dateFrom && expense.date < dateFrom) return false;
        if (dateTo && expense.date > dateTo) return false;
        return true;
      })
      .sort((left, right) =>
        sortOrder === "newest"
          ? right.date.localeCompare(left.date)
          : left.date.localeCompare(right.date),
      );
  }, [categoryFilter, dateFrom, dateTo, expenseForFilter, paidByFilter, selectedTrip, sortOrder]);
  const categoryTotals = getTravelCategoryTotals(selectedTrip?.expenses);
  const categoryTotal = Object.values(categoryTotals).reduce(
    (total, amount) => total + amount,
    0,
  );
  const peopleReport = getTravelPeopleReport(selectedTrip?.expenses);
  const expensePeople = peopleReport.people.map((person) => person.name);
  const planIsLocked = selectedStatus === "Completed";

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
      paidBy: editingExpenseId ? expenseDraft.paidBy.trim() : "",
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
    <div className="space-y-5">
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

      {showPlanForm && (
        <form
          onSubmit={submitPlan}
          className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-800">
              {editingPlanId ? "Edit travel plan" : "Create travel plan"}
            </h3>
            <button type="button" onClick={() => setShowPlanForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Close travel plan form">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className={labelClass}>
              Trip name
              <input className={inputClass} maxLength="100" value={planDraft.name} onChange={(event) => setPlanDraft({ ...planDraft, name: event.target.value })} placeholder="Japan Trip" required />
            </label>
            <label className={labelClass}>
              Destination
              <input className={inputClass} maxLength="100" value={planDraft.destination} onChange={(event) => setPlanDraft({ ...planDraft, destination: event.target.value })} placeholder="Tokyo, Japan" required />
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
            <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
              Notes (optional)
              <textarea className={inputClass} maxLength="1000" rows="2" value={planDraft.notes} onChange={(event) => setPlanDraft({ ...planDraft, notes: event.target.value })} placeholder="Travel reminders or plans" />
            </label>
          </div>
          {planError && <p className="text-xs font-medium text-rose-700" role="alert">{planError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowPlanForm(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={workspaceLoading} className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
              {editingPlanId ? "Save changes" : "Save travel plan"}
            </button>
          </div>
        </form>
      )}

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <i className="fa-solid fa-suitcase-rolling text-2xl text-slate-300" aria-hidden="true"></i>
          <h3 className="mt-3 text-sm font-bold text-slate-700">No travel plans yet</h3>
          <p className="mt-1 text-xs text-slate-500">Create a trip to set a budget and track expenses as they happen.</p>
          <button type="button" disabled={workspaceLoading} onClick={beginCreatePlan} className="mt-4 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
            + New Trip
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <section className="flex h-full min-h-[600px] flex-col gap-3 xl:sticky xl:top-4 xl:col-span-4" aria-label="Travel plans">
            <div className="flex-1 space-y-3">
              {plans.map((plan) => {
              const status = getTravelPlanStatus(plan, effectiveToday);
              const totals = getTravelPlanTotals(plan);
              const style = budgetStyles(totals.percentage);
              return (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => {
                    setSelectedTripId(plan.id);
                    setEditingExpenseId("");
                    setShowExpenseForm(false);
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedTrip?.id === plan.id
                      ? "border-teal-400 bg-teal-50/50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800">{plan.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">{plan.destination}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${statusStyles(status)}`}>{status}</span>
                  </span>
                  <span className="mt-3 flex justify-between gap-2 text-[10px] text-slate-500">
                    <span>{formatDateRange(plan.startDate, plan.endDate)}</span>
                    <span className={`font-semibold ${style.text}`}>{totals.percentage.toFixed(0)}%</span>
                  </span>
                  <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-slate-100">
                    <span className={`block h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(totals.percentage, 100)}%` }} />
                  </span>
                  <span className="mt-2 flex justify-between gap-2 text-[10px]">
                    <span className="text-slate-500">Spent {formatTravelCurrency(totals.spent, plan.currency)}</span>
                    <span className="font-semibold text-slate-700">Budget {formatTravelCurrency(totals.budget, plan.currency)}</span>
                  </span>
                </button>
              );
              })}
            </div>
            <button type="button" disabled={workspaceLoading} onClick={beginCreatePlan} className="mt-auto w-full rounded-lg border border-dashed border-teal-300 px-3 py-2.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50">
              + New Trip
            </button>
          </section>

          {selectedTrip && selectedTotals && (
            <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-8">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">{selectedTrip.name}</h3>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${statusStyles(selectedStatus)}`}>{selectedStatus}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateRange(selectedTrip.startDate, selectedTrip.endDate)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{selectedTrip.destination}</p>
                  {selectedTrip.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{selectedTrip.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {!planIsLocked && (
                    <>
                      <button type="button" onClick={() => beginEditPlan(selectedTrip)} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                        <i className="fa-solid fa-pen mr-1.5" aria-hidden="true"></i>Edit trip
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
                        className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[11px] font-semibold text-teal-800 hover:bg-teal-100"
                      >
                        Mark complete
                      </button>
                    </>
                  )}
                  {planIsLocked && <span className="self-center text-[10px] font-medium text-slate-400">Historical trip · read only</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
                {[
                  ["Total budget", selectedTotals.budget, "text-slate-800"],
                  ["Total spent", selectedTotals.spent, selectedTotals.percentage > 100 ? "text-rose-700" : "text-slate-800"],
                  [selectedTotals.remaining >= 0 ? "Remaining budget" : "Overspent", Math.abs(selectedTotals.remaining), selectedTotals.remaining >= 0 ? "text-teal-700" : "text-rose-700"],
                ].map(([label, amount, color]) => (
                  <div key={label} className="min-w-0 p-3">
                    <span className="block truncate text-[10px] font-semibold text-slate-500">{label}</span>
                    <span className={`mt-1 block break-words text-sm font-extrabold tabular-nums sm:text-base ${color}`}>
                      {formatTravelCurrency(amount, selectedTrip.currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {!planIsLocked && showExpenseForm && (
                  <form onSubmit={submitExpense} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
                      <label className={labelClass}>
                        Category
                        <select className={inputClass} value={expenseDraft.category} onChange={(event) => setExpenseDraft({ ...expenseDraft, category: event.target.value })} required>
                          {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                      </label>
                      <label className={labelClass}>
                        Amount ({selectedTrip.currency})
                        <input className={inputClass} type="number" min="0.01" step="0.01" value={expenseDraft.amount} onChange={(event) => setExpenseDraft({ ...expenseDraft, amount: event.target.value })} placeholder="0.00" required />
                      </label>
                      <label className={labelClass}>
                        Date
                        <input className={inputClass} type="date" value={expenseDraft.date} onChange={(event) => setExpenseDraft({ ...expenseDraft, date: event.target.value })} required />
                      </label>
                      <label className={labelClass}>
                        Payment method
                        <select className={inputClass} value={expenseDraft.method} onChange={(event) => setExpenseDraft({ ...expenseDraft, method: event.target.value })}>
                          <option value="">Not specified</option>
                          {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                        </select>
                      </label>
                    <button type="submit" disabled={workspaceLoading} className="w-full rounded-lg bg-teal-700 px-3 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                      {editingExpenseId ? "Save expense changes" : "Add expense"}
                    </button>
                    {editingExpenseId && (
                      <button type="button" onClick={() => { setEditingExpenseId(""); setShowExpenseForm(false); }} className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 lg:col-span-5">Cancel edit</button>
                    )}
                    {expenseError && <p className="text-[11px] font-medium text-rose-700 sm:col-span-2 lg:col-span-5" role="alert">{expenseError}</p>}
                  </form>
                )}

                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Expense history</h4>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {selectedTrip.expenses.length} expense{selectedTrip.expenses.length === 1 ? "" : "s"} · {formatTravelCurrency(selectedTotals.spent, selectedTrip.currency)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!planIsLocked && !showExpenseForm && (
                        <button type="button" onClick={beginAddExpense} className="rounded-lg bg-teal-700 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-teal-800">
                          Add expense
                        </button>
                      )}
                      {showExpenseForm && !editingExpenseId && (
                        <button type="button" onClick={() => setShowExpenseForm(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  <details className="rounded-lg border border-slate-200 px-3 py-2">
                    <summary className="cursor-pointer text-[10px] font-semibold text-slate-600">Filter and sort</summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select aria-label="Filter travel expenses by category" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px]" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                        <option value="all">All categories</option>
                        {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                      <select aria-label="Filter travel expenses by payer" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px]" value={paidByFilter} onChange={(event) => setPaidByFilter(event.target.value)}>
                        <option value="all">All payers</option>
                        {expensePeople.map((person) => <option key={person} value={person}>{person} paid</option>)}
                      </select>
                      <select aria-label="Filter travel expenses by beneficiary" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px]" value={expenseForFilter} onChange={(event) => setExpenseForFilter(event.target.value)}>
                        <option value="all">All people</option>
                        {expensePeople.map((person) => <option key={person} value={person}>{person} benefited</option>)}
                      </select>
                      <select aria-label="Sort travel expenses" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px]" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                      </select>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                        From <input aria-label="Filter travel expenses from date" type="date" className="rounded-md border border-slate-200 px-1.5 py-1 text-[10px]" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                      </label>
                      <label className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                        To <input aria-label="Filter travel expenses to date" type="date" className="rounded-md border border-slate-200 px-1.5 py-1 text-[10px]" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                      </label>
                    </div>
                  </details>
                  <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200">
                    {filteredExpenses.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-400">
                        {selectedTrip.expenses.length === 0 ? "No expenses recorded for this trip yet." : "No expenses match these filters."}
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {filteredExpenses.map((expense) => (
                          <li key={expense.id} className="flex items-start gap-2 p-3">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-slate-800">{expense.name}</span>
                              <span className="mt-1 block text-[10px] text-slate-500">
                                {expense.date} · {expense.category}
                                {expense.method ? ` · ${expense.method}` : ""}
                              </span>
                              {(expense.paidBy || expense.forPeople?.length > 0) && (
                                <span className="mt-1 block text-[10px] text-slate-500">
                                  {expense.paidBy ? `Paid by ${expense.paidBy}` : "Payer not recorded"}
                                  {expense.forPeople?.length > 0
                                    ? ` · For ${(expense.forPeople || []).join(", ")}`
                                    : ""}
                                </span>
                              )}
                              {expense.splitEqually && expense.forPeople?.length > 1 && (
                                <span className="mt-1 block text-[10px] font-medium text-sky-700">
                                  Shares: {Object.entries(getTravelExpenseAllocations(expense))
                                    .map(([person, amount]) => `${person} ${formatTravelCurrency(amount, selectedTrip.currency)}`)
                                    .join(" · ")}
                                </span>
                              )}
                              {expense.notes && <span className="mt-1 block whitespace-pre-wrap text-[10px] text-slate-400">{expense.notes}</span>}
                            </span>
                            <span className="shrink-0 text-xs font-bold tabular-nums text-slate-800">{formatTravelCurrency(expense.amount, selectedTrip.currency)}</span>
                            {!planIsLocked && (
                              <span className="flex shrink-0">
                                <button type="button" onClick={() => beginEditExpense(expense)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-700" aria-label={`Edit ${expense.name}`}>
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
                                >
                                  <i className="fa-solid fa-trash-can text-[10px]" aria-hidden="true"></i>
                                </button>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <details className="rounded-xl border border-slate-200 p-4" aria-label="Trip reports">
                <summary className="cursor-pointer text-xs font-bold text-slate-800">Trip reports</summary>
                <div className="mt-3 space-y-4">
              <section aria-label="Travel expense people report">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Paid by &amp; expenses for</h4>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Each expense is counted once in trip spending. Allocations only include expenses split equally or assigned to one person.
                    </p>
                  </div>
                  {peopleReport.sharedExpenseCount > 0 && (
                    <span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-800">
                      {peopleReport.sharedExpenseCount} shared expense{peopleReport.sharedExpenseCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                {peopleReport.people.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Add payer and Expense For names to see the people report.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[430px] text-left text-[10px]">
                      <thead className="border-b border-slate-100 text-slate-500">
                        <tr>
                          <th className="py-2 pr-2 font-semibold">Person</th>
                          <th className="px-2 py-2 text-right font-semibold">Paid</th>
                          <th className="px-2 py-2 text-right font-semibold">For</th>
                          <th className="pl-2 py-2 text-right font-semibold">Allocated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {peopleReport.people.map((person) => (
                          <tr key={person.name}>
                            <th className="py-2 pr-2 font-semibold text-slate-700">{person.name}</th>
                            <td className="px-2 py-2 text-right text-slate-700">
                              {formatTravelCurrency(person.paid, selectedTrip.currency)}
                              <span className="ml-1 text-slate-400">({person.paidExpenseCount})</span>
                            </td>
                            <td className="px-2 py-2 text-right text-slate-700">
                              {person.forExpenseCount}
                            </td>
                            <td className="pl-2 py-2 text-right font-semibold text-teal-700">
                              {formatTravelCurrency(person.allocated, selectedTrip.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {peopleReport.unallocatedSharedTotal > 0 && (
                  <p className="mt-2 text-[10px] text-slate-500">
                    Shared expenses not split: {formatTravelCurrency(peopleReport.unallocatedSharedTotal, selectedTrip.currency)}
                  </p>
                )}
              </section>

              <section aria-label="Travel expenses by category">
                <h4 className="mb-3 text-xs font-bold text-slate-800">Spending by category</h4>
                {Object.keys(categoryTotals).length === 0 ? (
                  <p className="text-[11px] text-slate-400">Category totals appear after you add expenses.</p>
                ) : (
                  <div className="space-y-2.5">
                    {Object.entries(categoryTotals)
                      .sort(([, left], [, right]) => right - left)
                      .map(([category, amount]) => {
                        const percent = categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0;
                        return (
                          <div key={category}>
                            <div className="mb-1 flex justify-between gap-2 text-[10px]">
                              <span className="truncate font-medium text-slate-600">{category}</span>
                              <span className="shrink-0 font-semibold text-slate-700">
                                {formatTravelCurrency(amount, selectedTrip.currency)} · {percent.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-sky-500" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>
                </div>
              </details>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
