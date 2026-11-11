import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, List, Plus, X } from "lucide-react";
import { getIncentiveTotal } from "../../utils/incentiveTracker.js";

export default function EmployeeIncentives({
  incentives,
  onAddIncentive,
  onDeleteIncentive,
  requestConfirmation,
  privateFinancialDataStatus,
  privateFinancialDataError,
  formatCurrency,
}) {
  const isPrivateDataReady = privateFinancialDataStatus === "ready";
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [count, setCount] = useState("");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  useEffect(() => {
    if (!isAddFormOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsAddFormOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAddFormOpen]);
  const sortedIncentives = [...incentives].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const incentivesByDate = Array.from(
    sortedIncentives.reduce((groups, incentive) => {
      const group = groups.get(incentive.date) || [];
      group.push(incentive);
      groups.set(incentive.date, group);
      return groups;
    }, new Map()),
    ([date, dateIncentives]) => ({
      date,
      incentives: dateIncentives,
      total: getIncentiveTotal(dateIncentives),
    }),
  );

  if (!isPrivateDataReady) {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="status"
      >
        <p className="font-semibold">Employee incentives are private.</p>
        <p className="mt-1 text-xs">
          {privateFinancialDataStatus === "migration-required"
            ? "Migrate existing private financial data in Settings to add and view incentives."
            : privateFinancialDataStatus === "unavailable"
              ? "Private financial storage is not configured on this server."
              : "Private financial data is not available. Retry cloud loading to add and view incentives."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {privateFinancialDataError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {privateFinancialDataError}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <span className="block text-xs font-medium text-emerald-700">Total recorded incentives</span>
          <span className="mt-1 block text-xl font-extrabold text-emerald-600">
            {formatCurrency(getIncentiveTotal(incentives))}
          </span>
          <span className="text-[10px] text-emerald-700">{`${incentives.length} saved records`}</span>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 sm:col-span-2 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-semibold text-emerald-800">Incentives are included in earnings estimates and payslips.</p>
            <p className="mt-1 text-[11px] text-slate-600">
              Add each one-time incentive on its pay date. It will be included in the payroll period containing that date.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddFormOpen((isOpen) => !isOpen)}
            aria-expanded={isAddFormOpen}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <Plus size={14} aria-hidden="true" />
            {isAddFormOpen ? "Close" : "Add Incentive"}
          </button>
        </div>
      </div>
      {isAddFormOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsAddFormOpen(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-incentive-title"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h2
                  id="add-incentive-title"
                  className="text-sm font-bold text-slate-900"
                >
                  Log Incentive Metric
                </h2>
                <button
                  type="button"
                  onClick={() => setIsAddFormOpen(false)}
                  aria-label="Close dialog"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const incentiveAmount = Number(count) * Number(rate);
                  if (
                    !Number.isFinite(incentiveAmount) ||
                    incentiveAmount <= 0
                  ) return;
                  if (
                    onAddIncentive({
                      name,
                      amount: incentiveAmount,
                      date,
                    })
                  ) {
                    setName("");
                    setCount("");
                    setRate("");
                    setIsAddFormOpen(false);
                  }
                }}
              >
                <label className="block text-[11px] font-medium text-slate-600">
                  Procedure / Metric Name
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g., Performance bonus"
                    maxLength={80}
                    required
                    autoFocus
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[11px] font-medium text-slate-600">
                    Count
                    <input
                      type="number"
                      value={count}
                      onChange={(event) => setCount(event.target.value)}
                      min="0.01"
                      step="any"
                      placeholder="1"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                    />
                  </label>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Rate per count (₱)
                    <input
                      type="number"
                      value={rate}
                      onChange={(event) => setRate(event.target.value)}
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                    />
                  </label>
                </div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Incentive date
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                  />
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddFormOpen(false)}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Save Entry
                  </button>
                </div>
              </form>
            </section>
          </div>,
          document.body,
        )}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
            <List size={15} className="text-emerald-600" aria-hidden="true" />
            Incentive History
          </h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {`${incentivesByDate.length} date${incentivesByDate.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="max-h-[360px] space-y-2.5 overflow-y-auto pt-1">
          {incentivesByDate.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs italic text-slate-400">
              No incentives have been recorded yet.
            </p>
          ) : (
            incentivesByDate.map((group) => (
              <details
                key={group.date}
                className="group rounded-xl border border-slate-200 bg-white"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3.5 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    size={14}
                    className="shrink-0 text-slate-400 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">
                      {group.date}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {`${group.incentives.length} incentive${group.incentives.length === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-emerald-600">
                    {formatCurrency(group.total)}
                  </span>
                </summary>
                <div className="space-y-1 border-t border-slate-100 bg-slate-50/50 py-2 pl-10 pr-3">
                  {group.incentives.map((incentive) => (
                    <div
                      key={incentive.id}
                      className="flex items-center gap-3 rounded-lg bg-white px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                        {incentive.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-600">
                        {formatCurrency(incentive.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (await requestConfirmation({
                            title: "Delete incentive?",
                            message: `Delete "${incentive.name}" dated ${incentive.date}? This also updates estimated payroll earnings.`,
                            confirmLabel: "Delete incentive",
                            variant: "danger",
                          })) {
                            onDeleteIncentive(incentive.id);
                          }
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        title="Delete incentive"
                        aria-label={`Delete ${incentive.name}`}
                      >
                        <i className="fa-solid fa-trash-can" aria-hidden="true"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
