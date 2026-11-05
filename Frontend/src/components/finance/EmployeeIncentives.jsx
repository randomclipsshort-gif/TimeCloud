import { getIncentiveTotal } from "../../utils/incentiveTracker.js";

export default function EmployeeIncentives({
  incentives,
  incentiveName,
  setIncentiveName,
  incentiveAmount,
  setIncentiveAmount,
  incentiveDate,
  setIncentiveDate,
  onAddIncentive,
  onDeleteIncentive,
  salaryVaultStatus,
  salaryVaultError,
  salaryVaultSyncing,
  formatCurrency,
}) {
  const isVaultUnlocked = salaryVaultStatus === "unlocked";
  const sortedIncentives = [...incentives].sort((left, right) =>
    right.date.localeCompare(left.date),
  );

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
      {salaryVaultSyncing && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500" role="status">
          Saving encrypted incentive data…
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm lg:col-span-5"
          onSubmit={(event) => {
            event.preventDefault();
            onAddIncentive();
          }}
        >
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
            <i className="fa-solid fa-circle-plus text-emerald-600" aria-hidden="true"></i>
            Add Employee Incentive
          </h3>
          <label className="block text-[11px] font-semibold text-slate-600" htmlFor="incentiveDate">
            Incentive Date
            <input
              type="date"
              id="incentiveDate"
              value={incentiveDate}
              onChange={(event) => setIncentiveDate(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <label className="block text-[11px] font-semibold text-slate-600" htmlFor="incentiveName">
            Incentive Description
            <input
              type="text"
              id="incentiveName"
              value={incentiveName}
              onChange={(event) => setIncentiveName(event.target.value)}
              placeholder="e.g., Performance bonus, Referral reward"
              maxLength={80}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <label className="block text-[11px] font-semibold text-slate-600" htmlFor="incentiveAmount">
            Amount (₱)
            <input
              type="number"
              id="incentiveAmount"
              value={incentiveAmount}
              onChange={(event) => setIncentiveAmount(event.target.value)}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            <i className="fa-solid fa-plus" aria-hidden="true"></i>
            Save Incentive
          </button>
        </form>
        <div className="lg:col-span-7">
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
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Description</th>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 text-right font-semibold">Amount</th>
                  <th className="p-3 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedIncentives.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-6 text-center italic text-slate-400">
                      No incentives have been recorded yet.
                    </td>
                  </tr>
                ) : sortedIncentives.map((incentive) => (
                  <tr key={incentive.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">{incentive.name}</td>
                    <td className="p-3 text-slate-500">{incentive.date}</td>
                    <td className="p-3 text-right font-semibold text-emerald-700">
                      {formatCurrency(incentive.amount)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete "${incentive.name}" dated ${incentive.date}? This also updates estimated payroll earnings.`)) {
                            onDeleteIncentive(incentive.id);
                          }
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        title="Delete incentive"
                        aria-label={`Delete ${incentive.name}`}
                      >
                        <i className="fa-solid fa-trash-can" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
