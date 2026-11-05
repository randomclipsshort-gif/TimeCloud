import { useEffect, useRef, useState } from "react";
import { getIncentiveTotal } from "../../utils/incentiveTracker.js";

export default function EmployeeIncentives({
  incentives,
  onDeleteIncentive,
  salaryVaultStatus,
  salaryVaultError,
  formatCurrency,
}) {
  const [deletingIncentiveId, setDeletingIncentiveId] = useState(null);
  const onDeleteIncentiveRef = useRef(onDeleteIncentive);
  const isVaultUnlocked = salaryVaultStatus === "unlocked";
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

  useEffect(() => {
    onDeleteIncentiveRef.current = onDeleteIncentive;
  }, [onDeleteIncentive]);

  useEffect(() => {
    if (!deletingIncentiveId) return undefined;
    const timeoutId = window.setTimeout(() => {
      onDeleteIncentiveRef.current(deletingIncentiveId);
      setDeletingIncentiveId(null);
    }, 220);
    return () => window.clearTimeout(timeoutId);
  }, [deletingIncentiveId]);

  if (!isVaultUnlocked) {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="status"
      >
        <p className="font-semibold">Employee incentives are private.</p>
        <p className="mt-1 text-xs">
          {salaryVaultStatus === "unavailable"
            ? "The salary vault is unavailable until the required Supabase migration is applied."
            : salaryVaultStatus === "uninitialized"
              ? "Create and unlock the encrypted salary vault in Settings to add and view incentives."
              : "Unlock the encrypted salary vault in Settings to add and view incentives."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {salaryVaultError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {salaryVaultError}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <span className="block text-xs font-medium text-emerald-700">Total recorded incentives</span>
          <span className="mt-1 block text-xl font-extrabold text-emerald-800">
            {formatCurrency(getIncentiveTotal(incentives))}
          </span>
          <span className="text-[10px] text-emerald-700">{`${incentives.length} saved records`}</span>
        </div>
        <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4 sm:col-span-2">
          <p className="text-xs font-semibold text-teal-900">Incentives are included in earnings estimates and payslips.</p>
          <p className="mt-1 text-[11px] text-teal-800">
            Add each one-time incentive on its pay date. It will be included in the payroll period containing that date.
          </p>
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
              <i className="fa-solid fa-list text-emerald-600" aria-hidden="true"></i>
              Incentive History
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {`${incentives.length} item${incentives.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {incentivesByDate.length === 0 ? (
            <p className="p-6 text-center text-xs italic text-slate-400">
              No incentives have been recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {incentivesByDate.map((group) => (
                <details key={group.date} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <i
                      className="fa-solid fa-chevron-right text-[10px] text-slate-400 transition-transform group-open:rotate-90"
                      aria-hidden="true"
                    ></i>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-slate-800">
                        {group.date}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {`${group.incentives.length} incentive${group.incentives.length === 1 ? "" : "s"}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-700">
                      {formatCurrency(group.total)}
                    </span>
                  </summary>
                  <div className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/50 pl-7">
                    {group.incentives.map((incentive) => (
                      <div
                        key={incentive.id}
                        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                          deletingIncentiveId === incentive.id
                            ? "grid-rows-[0fr] opacity-0"
                            : "grid-rows-[1fr] opacity-100"
                        }`}
                      >
                        <div className="flex min-h-0 items-center gap-3 overflow-hidden px-3 py-2">
                          <span className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                            {incentive.name}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-600">
                            {formatCurrency(incentive.amount)}
                          </span>
                          <button
                            type="button"
                            disabled={deletingIncentiveId === incentive.id}
                            onClick={() => {
                              if (window.confirm(`Delete "${incentive.name}" dated ${incentive.date}? This also updates estimated payroll earnings.`)) {
                                setDeletingIncentiveId(incentive.id);
                              }
                            }}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed"
                            title="Delete incentive"
                            aria-label={`Delete ${incentive.name}`}
                          >
                            <i
                              className={`fa-solid ${
                                deletingIncentiveId === incentive.id
                                  ? "fa-spinner fa-spin"
                                  : "fa-trash-can"
                              }`}
                              aria-hidden="true"
                            ></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
