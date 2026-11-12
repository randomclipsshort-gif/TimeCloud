import React from "react";
import {
  Clock3,
  Download,
  FileText,
  LoaderCircle,
  LogOut,
  Settings,
} from "lucide-react";

export default function Header({ clock, user, onLogout, isSigningOut = false }) {
  return (
  <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md">
    <div className="mx-auto flex min-h-[60px] w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-[18px]">
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
          <Clock3 size={19} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-sm font-bold leading-tight text-textMain">
            Timekeep Cloud
          </h1>
          <span className="text-[10px] font-medium text-textMuted">
            Personal Time &amp; Financial Hub
          </span>
        </div>
      </div>
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        <div id="liveClock" className="flex h-8 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-[11px] font-medium text-slate-700">
          <Clock3 size={14} className="text-teal-600" aria-hidden="true" />
          <span id="clockText">
            {clock}
            <span className="ml-1 hidden font-sans text-[10px] font-normal text-textMuted sm:inline">
              PST
            </span>
          </span>
        </div>
        <button data-action="openModal(&#x27;payslipModal&#x27;)" aria-label="View Payslip" title="View Payslip" className="flex h-8 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-teal-600 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:px-3">
          <FileText size={14} aria-hidden="true" />
          <span className="hidden sm:inline">
            View Payslip
          </span>
        </button>
        {user && (
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-[11px] font-bold text-teal-700" aria-hidden="true">
              {user.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("")}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-40 truncate text-xs font-semibold text-slate-800">{user.name}</p>
              <p className="max-w-40 truncate text-[10px] text-slate-500">{user.email}</p>
            </div>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-action="exportWorkspace()"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
            title="Export my data"
            aria-label="Export my data"
          >
            <Download size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-action="openModal(&#x27;settingsModal&#x27;)"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={16} aria-hidden="true" />
          </button>
          {user && (
            <button
              type="button"
              onClick={onLogout}
              disabled={isSigningOut}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-70"
              title={isSigningOut ? "Signing out..." : "Sign out"}
              aria-label={isSigningOut ? "Signing out..." : "Sign out"}
              aria-busy={isSigningOut}
            >
              {isSigningOut ? (
                <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <LogOut size={16} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  </header>
  );
}
