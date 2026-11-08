import React from "react";
import {
  Clock3,
  Download,
  FileText,
  LogOut,
  RotateCcw,
  Settings,
} from "lucide-react";

export default function Header({ clock, user, onLogout }) {
  return (
  <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md">
    <div className="mx-auto flex min-h-16 w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 md:py-2">
      <div className="flex items-center space-x-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md">
          <Clock3 size={19} aria-hidden="true" />
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
      <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
        <div id="liveClock" className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 font-mono text-xs font-medium text-slate-700 sm:px-3">
          <Clock3 size={14} className="text-teal-600" aria-hidden="true" />
          <span id="clockText">
            {clock}
            <span className="ml-1 hidden font-sans text-[10px] font-normal text-textMuted sm:inline">
              PST
            </span>
          </span>
        </div>
        <button data-action="openModal(&#x27;payslipModal&#x27;)" aria-label="View Payslip" title="View Payslip" className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-teal-600 px-2 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 sm:px-4">
          <FileText size={15} aria-hidden="true" />
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
          <button data-action="exportWorkspace()" className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:p-2" title="Export my data" aria-label="Export my data">
            <Download size={16} aria-hidden="true" />
          </button>
          <button data-action="resetCalendar()" className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:p-2" title="Reset View" aria-label="Reset view">
            <RotateCcw size={16} aria-hidden="true" />
          </button>
          <button data-action="openModal(&#x27;settingsModal&#x27;)" className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:p-2" title="Settings" aria-label="Settings">
            <Settings size={16} aria-hidden="true" />
          </button>
          {user && (
            <button type="button" onClick={onLogout} className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 sm:p-2" title="Sign out" aria-label="Sign out">
              <LogOut size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  </header>
  );
}
