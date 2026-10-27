import React from "react";

export default function Header({ clock, user, onLogout }) {
  return (
  <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
    <div className="max-w-[1600px] mx-auto w-full sm:px-6 lg:px-6 py-3 md:py-0 min-h-16 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4">
      <div className="flex items-center space-x-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md">
          <i className="fa-solid fa-clock-rotate-left text-lg"></i>
        </div>
        <div>
          <h1 className="font-bold text-base text-textMain leading-tight">
            
              Timekeep Cloud
            
          </h1>
          <span className="text-[11px] font-medium text-textMuted">
            Enterprise Time &amp; Financial Hub
          </span>
        </div>
      </div>
      <div className="w-full md:w-auto flex flex-wrap items-center justify-between md:justify-end gap-2 md:gap-3">
        <div id="liveClock" className="flex items-center space-x-2 bg-slate-100 border border-slate-200 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-700 whitespace-nowrap">
          <i className="fa-regular fa-clock text-teal-600"></i>
          <span id="clockText">
            {clock}
            <span className="hidden sm:inline text-xs text-textMuted font-normal">
              PST
            </span>
          </span>
        </div>
        <button data-action="openModal(&#x27;payslipModal&#x27;)" aria-label="View Payslip" title="View Payslip" className="bg-teal-600 hover:bg-teal-700 text-white px-2 sm:px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition flex items-center space-x-2 cursor-pointer whitespace-nowrap">
          <i className="fa-regular fa-file-lines"></i>
          <span className="hidden sm:inline text-xs">
            View Payslip
          </span>
        </button>
        {user && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700" aria-hidden="true">
              {user.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("")}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-32 truncate text-xs font-semibold text-slate-800">{user.name}</p>
              <p className="max-w-32 truncate text-[10px] text-slate-500">{user.email}</p>
            </div>
          </div>
        )}
        <div className="flex items-center space-x-1 border-l border-slate-200 pl-2 sm:pl-3">
          <button data-action="exportWorkspace()" className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer" title="Export my data" aria-label="Export my data">
            <i className="fa-solid fa-download"></i>
          </button>
          <button data-action="resetCalendar()" className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer" title="Reset View">
            <i className="fa-solid fa-rotate-left"></i>
          </button>
          <button data-action="openModal(&#x27;settingsModal&#x27;)" className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer" title="Settings">
            <i className="fa-solid fa-gear"></i>
          </button>
          {user && (
            <button type="button" onClick={onLogout} className="p-1.5 sm:p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer" title="Sign out" aria-label="Sign out">
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  </header>
  );
}
