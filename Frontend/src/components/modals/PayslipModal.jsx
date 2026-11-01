import React from "react";
import { formatPayrollPeriod } from "../../utils/payrollPeriods.js";

const earningLines = [
  ["regular", "Regular / holiday earnings"],
  ["overtime", "Overtime earnings"],
  ["nightDifferential", "Night differential"],
  ["allowance", "Allowances"],
  ["leave", "Paid leave"],
  ["other", "Other recorded earnings"],
];

export default function PayslipModal({
  open,
  userName,
  payrollPeriod,
  payrollPeriodSummary,
  cutoffPayrollDeductions,
  payrollPeriodNetPay,
  payrollPeriodEarningsAvailable,
  formatCurrency,
}) {
  const earnings = payrollPeriodSummary.earningsBreakdown;
  const periodLabel = formatPayrollPeriod(payrollPeriod);
  const recordedHours = payrollPeriodSummary.regularHours +
    payrollPeriodSummary.overtimeHours;
  const formatPrivateAmount = (amount) => payrollPeriodEarningsAvailable
    ? formatCurrency(amount)
    : "Private — unlock salary vault";
  const visibleEarningLines = earningLines.filter(([key]) => earnings[key] !== 0);

  return (
    <div
      id="payslipModal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payslip-title"
      aria-hidden={!open}
      style={{ display: open ? "flex" : "none" }}
    >
      <article className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-8">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
              Timekeep Cloud · Earnings statement
            </p>
            <h2 id="payslip-title" className="mt-1 text-2xl font-bold text-slate-900">
              Payslip estimate
            </h2>
            <p className="mt-1 text-sm text-slate-600">{periodLabel}</p>
          </div>
          <div className="payslip-no-print flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <i className="fa-solid fa-print mr-2" aria-hidden="true"></i>
              Print
            </button>
            <button
              type="button"
              aria-label="Close payslip"
              data-action="closeModal(&#x27;payslipModal&#x27;)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 border-b border-slate-200 py-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Employee</p>
            <p className="mt-1 font-semibold text-slate-900">{userName || "Employee"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Recorded workdays</p>
            <p className="mt-1 font-semibold text-slate-900">
              {payrollPeriodSummary.eligibleWorkdays}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Recorded hours</p>
            <p className="mt-1 font-semibold text-slate-900">
              {recordedHours.toFixed(2)}
              <span className="ml-1 font-normal text-slate-500">hrs</span>
            </p>
          </div>
        </section>

        <section className="pt-5" aria-labelledby="payslip-earnings-heading">
          <h3 id="payslip-earnings-heading" className="text-sm font-bold uppercase tracking-wide text-slate-800">
            Earnings
          </h3>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th scope="col" className="py-2 font-medium">Description</th>
                <th scope="col" className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleEarningLines.length > 0 ? visibleEarningLines.map(([key, label]) => (
                <tr key={key}>
                  <td className="py-2.5 text-slate-700">{label}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-slate-900">
                    {formatPrivateAmount(earnings[key])}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="2" className="py-3 text-slate-500">No earnings recorded for this period.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <th scope="row" className="py-3 text-left font-semibold text-slate-800">
                  Gross earnings
                </th>
                <td className="py-3 text-right font-semibold tabular-nums text-slate-900">
                  {formatPrivateAmount(payrollPeriodSummary.recordedEarnings)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="mt-5 border-t border-slate-200 pt-5" aria-labelledby="payslip-deductions-heading">
          <h3 id="payslip-deductions-heading" className="text-sm font-bold uppercase tracking-wide text-slate-800">
            Employee deductions &amp; contributions
          </h3>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th scope="col" className="py-2 font-medium">Description</th>
                <th scope="col" className="py-2 font-medium">Schedule</th>
                <th scope="col" className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cutoffPayrollDeductions.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 text-slate-700">{item.label} · employee share</td>
                  <td className="py-2.5 text-xs text-slate-500">{item.frequencyLabel}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-slate-900">
                    {formatPrivateAmount(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <th scope="row" colSpan="2" className="py-3 text-left font-semibold text-slate-800">
                  Total deductions
                </th>
                <td className="py-3 text-right font-semibold tabular-nums text-slate-900">
                  {formatPrivateAmount(cutoffPayrollDeductions.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-slate-900 px-4 py-4 text-white">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
              Estimated net pay
            </p>
            <p className="mt-1 text-xs text-slate-300">Gross earnings less employee deductions</p>
          </div>
          <p className="text-xl font-bold tabular-nums">
            {formatPrivateAmount(payrollPeriodNetPay)}
          </p>
        </section>

        <footer className="mt-5 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
          <p>
            Estimate only—not a finalized payroll record. Employer contributions are not included or deducted from employee net pay.
          </p>
          {payrollPeriodSummary.incompleteClockOuts > 0 && (
            <p className="mt-1">
              {payrollPeriodSummary.incompleteClockOuts} incomplete clock-out
              {payrollPeriodSummary.incompleteClockOuts === 1 ? "" : "s"} excluded from this statement.
            </p>
          )}
        </footer>
      </article>
    </div>
  );
}
