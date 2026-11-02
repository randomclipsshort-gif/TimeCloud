import React from "react";
import { formatPayrollPeriod } from "../../utils/payrollPeriods.js";

export default function PayslipModal({
  open,
  userName,
  payrollPeriod,
  payrollPeriodSummary,
  payrollEarningsBreakdown,
  cutoffPayrollDeductions,
  payrollPeriodNetPay,
  payrollPeriodEarningsAvailable,
  dailyWage,
  formatCurrency,
}) {
  const periodLabel = formatPayrollPeriod(payrollPeriod).replace(/\s*[–—-]\s*/, " - ");
  const earningsLabel = payrollPeriodEarningsAvailable
    ? formatCurrency(payrollPeriodSummary.recordedEarnings)
    : "Private — unlock salary vault";
  const netPayLabel = payrollPeriodEarningsAvailable
    ? formatCurrency(payrollPeriodNetPay)
    : "Private — unlock salary vault";
  const recordedHours = payrollPeriodSummary.regularHours +
    payrollPeriodSummary.overtimeHours;
  const formatUnits = (units) => Number.isInteger(units)
    ? String(units)
    : units.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const formatEarningsItemCalculation = (item) => {
    if (item.id === "lateUndertime") {
      return `Late/UT · Late ${formatUnits(item.lateMinutes)} min · UT ${formatUnits(item.undertimeMinutes)} min`;
    }
    if (item.units <= 0) return null;
    if (item.id === "regularHoliday" || item.id === "specialHoliday") {
      const baseWage = Number(dailyWage);
      if (!Number.isFinite(baseWage) || baseWage <= 0) return null;
      const basePay = baseWage * item.units;
      const premiumAmount = Math.round((item.total - basePay + Number.EPSILON) * 100) / 100;
      const premiumRate = basePay > 0
        ? Math.round((premiumAmount / basePay) * 10000) / 100
        : 0;
      const dayLabel = item.units === 1 ? "day" : "days";
      const basePayCalculation = `${formatUnits(item.units)} ${dayLabel} × ${formatCurrency(baseWage)}`;
      return premiumAmount > 0
        ? `${basePayCalculation} + ${formatUnits(premiumRate)}% holiday premium (${formatCurrency(premiumAmount)})`
        : `${basePayCalculation} base wage (${formatUnits(Math.round((item.rate / baseWage) * 10000) / 100)}% holiday rate)`;
    }
    const rateUnit = item.unit === "hours" ? "hour" : item.unit.slice(0, -1);
    const unitLabel = item.unit === "days" && item.units === 1
      ? "day"
      : item.unit;
    return `${formatUnits(item.units)} ${unitLabel} × ${formatCurrency(item.rate)}/${rateUnit}`;
  };

  return (
  <div id="payslipModal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-hidden={!open} style={{ display: open ? "flex" : "none" }}>
    <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <i className="fa-regular fa-file-lines text-lg" aria-hidden="true"></i>
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
              Personal earnings summary
            </span>
            <h3 className="truncate text-lg font-extrabold text-slate-900 sm:text-xl">
              {periodLabel}
            </h3>
          </div>
        </div>
        <button type="button" aria-label="Close payslip" data-action="closeModal(&#x27;payslipModal&#x27;)" className="ml-3 shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
          <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-800">
            <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
            Estimate only · not finalized payroll
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            {`${recordedHours.toFixed(2)} recorded hours`}
          </span>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Employee", userName, "fa-user"],
            ["Pay Period", periodLabel, "fa-calendar"],
            [
              "Daily wage",
              !payrollPeriodEarningsAvailable
                ? "Private — unlock salary vault"
                : Number(dailyWage) > 0
                  ? formatCurrency(Number(dailyWage))
                  : "Not set",
              "fa-coins",
            ],
            ["Recorded hours", `${recordedHours.toFixed(2)} hrs`, "fa-clock"],
          ].map(([label, value, icon]) => (
            <div key={label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
              <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-wider text-slate-400">
                <i className={`fa-solid ${icon} text-teal-600`} aria-hidden="true"></i>
                {label}
              </span>
              <span className={`mt-1.5 block truncate text-xs font-semibold text-slate-800 ${label === "Employee" ? "uppercase" : ""}`} title={value}>
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-br from-teal-700 to-teal-600 p-5 text-white shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-100">
              Gross earnings estimate
            </span>
            <span className="mt-2 block break-words text-3xl font-extrabold tracking-tight">
              {earningsLabel}
            </span>
            <span className="mt-1 block text-[10px] text-teal-100">
              For this payroll period
            </span>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">
              Net pay after deductions
            </span>
            <span className="mt-2 block break-words text-3xl font-extrabold tracking-tight text-emerald-700">
              {netPayLabel}
            </span>
            <span className="mt-1 block text-[10px] text-emerald-700">
              Employee contributions deducted
            </span>
          </div>
        </div>
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-teal-100 bg-teal-50/70 px-4 py-3">
              <div>
                <h4 className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-teal-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-teal-700">
                    <i className="fa-solid fa-arrow-trend-up" aria-hidden="true"></i>
                  </span>
                  Gross Earnings Breakdown
                </h4>
                <p className="ml-9 mt-1 text-[9px] font-medium text-teal-800/70">
                  Units × rate = line total
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-100 px-4">
              {payrollEarningsBreakdown.items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-xs">
                  <span className="min-w-0 flex-1 text-slate-600">
                    <span className="block">{item.label}</span>
                    {payrollPeriodEarningsAvailable &&
                      formatEarningsItemCalculation(item) && (
                        <span className="mt-1 block text-[10px] text-slate-400">
                          {formatEarningsItemCalculation(item)}
                        </span>
                      )}
                    {item.id === "lateUndertime" && (
                      <span className="ml-1 text-[10px] text-slate-400">(no deduction configured)</span>
                    )}
                  </span>
                  <span className={`shrink-0 font-semibold ${item.informational ? "text-slate-400" : "text-slate-800"}`}>
                    {item.informational
                      ? "Not deducted"
                      : payrollPeriodEarningsAvailable
                        ? formatCurrency(item.total)
                        : "Private"}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-rose-100 bg-rose-50/70 px-4 py-3">
              <h4 className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-rose-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-rose-600">
                  <i className="fa-solid fa-arrow-trend-down" aria-hidden="true"></i>
                </span>
                Deductions &amp; Contributions
              </h4>
            </div>
            <div className="px-4">
              {cutoffPayrollDeductions.items.map((item) => (
                <div key={item.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-3 text-xs">
                  <span className="text-slate-600">{item.label} employee contribution</span>
                  <span className="font-semibold text-slate-800">
                    {payrollPeriodEarningsAvailable
                      ? formatCurrency(item.amount)
                      : "Private"}
                  </span>
                </div>
              ))}
              <div className="flex justify-between gap-2 py-3 text-xs">
                <span className="font-semibold text-slate-700">Total employee contributions</span>
                <span className="font-bold text-rose-700">
                  {payrollPeriodEarningsAvailable
                    ? formatCurrency(cutoffPayrollDeductions.employeeContributionTotal)
                    : "Private"}
                </span>
              </div>
            </div>
          </section>
        </div>
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[10px] leading-relaxed text-slate-500">
          Estimates are not finalized payroll or guaranteed legal entitlements.
          Confirm actual pay and deductions with your payroll administrator.
        </p>
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <span className="text-[10px] text-slate-400">Personal payroll estimate</span>
        <div className="flex justify-end gap-2">
          <button type="button" data-action="closeModal(&#x27;payslipModal&#x27;)" className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">
            Close
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-800">
            <i className="fa-solid fa-print" aria-hidden="true"></i>
            Print summary
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}
