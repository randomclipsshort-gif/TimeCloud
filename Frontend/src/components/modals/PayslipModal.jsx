import React from "react";

export default function PayslipModal({
  open,
  userName,
  monthLabel,
  estimatedEarnings,
  totalHours,
  dailyWage,
  formatCurrency,
}) {
  return (
  <div id="payslipModal" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-hidden={!open} style={{ display: open ? "flex" : "none" }}>
    <div className="bg-cardBg rounded-2xl border border-slate-200 w-full max-w-3xl p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 font-bold text-lg">
            <i className="fa-regular fa-file-lines"></i>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
              Personal Earnings Summary — Estimate Only
            </span>
            <h3 className="font-extrabold text-xl text-textMain">
              
                {monthLabel}
              
            </h3>
          </div>
        </div>
        <button type="button" aria-label="Close modal" data-action="closeModal(&#x27;payslipModal&#x27;)" className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-6 text-xs">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">
              Employee Name:
            </span>
            <span className="font-bold text-slate-800">
              {userName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">
              Account:
            </span>
            <span className="font-semibold text-slate-800">
              Personal workspace
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">
              Configured Daily Wage:
            </span>
            <span className="font-semibold text-slate-800">
              {Number(dailyWage) > 0 ? formatCurrency(Number(dailyWage)) : "Not set"}
            </span>
          </div>
        </div>
        <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
          <div className="flex justify-between">
            <span className="text-slate-500">
              Pay Period:
            </span>
            <span className="font-semibold text-slate-800">
              {monthLabel}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">
              Recorded Hours:
            </span>
            <span className="font-semibold text-teal-700">
              {`${totalHours.toFixed(2)} hours`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">
              Payroll Status:
            </span>
            <span className="font-semibold text-slate-800">
              Estimate only
            </span>
          </div>
        </div>
      </div>
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-md mb-6 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider opacity-90 block">
            Recorded Earnings Estimate
          </span>
          <span className="text-3xl font-black">
            {formatCurrency(estimatedEarnings)}
              
            <span className="text-sm font-normal opacity-90">
              PHP
            </span>
          </span>
        </div>
        <button type="button" onClick={() => window.print()} className="bg-white text-teal-700 hover:bg-slate-100 px-4 py-2.5 rounded-xl text-xs font-bold shadow transition flex items-center space-x-2 cursor-pointer">
          <i className="fa-solid fa-print"></i>
          <span>
            Print Summary
          </span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-teal-800 flex items-center space-x-1.5">
              <i className="fa-solid fa-plus-circle text-teal-600"></i>
              <span>
                Earnings Breakdown
              </span>
            </h4>
            <span className="text-xs font-extrabold text-teal-700">
              {formatCurrency(estimatedEarnings)}
            </span>
          </div>
          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>
                Recorded attendance and leave estimates
              </span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(estimatedEarnings)}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-rose-800 flex items-center space-x-1.5">
              <i className="fa-solid fa-minus-circle text-rose-600"></i>
              <span>
                Deductions &amp; Contributions
              </span>
            </h4>
            <span className="text-xs font-extrabold text-rose-700">
              Not configured
            </span>
          </div>
          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>
                Payroll deductions and contributions
              </span>
              <span className="font-semibold text-slate-800">
                Not included
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-500">
        <span>
          Estimates are not finalized payroll or guaranteed legal entitlements.
        </span>
        <button data-action="closeModal(&#x27;payslipModal&#x27;)" className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-xl transition cursor-pointer">
          
            Close Window
          
        </button>
      </div>
    </div>
  </div>
  );
}
