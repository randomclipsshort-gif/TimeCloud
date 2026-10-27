import React, { useState } from "react";

export default function SettingsModal({
  open,
  activeSettingsTab,
  holidays,
  selectedLocality,
  holidayEligibilityConfirmed,
  dailyWage,
  dailyAllowance,
  overtimeMultiplier,
  earlyPunchWindowMinutes,
  lateGracePeriodMinutes,
  onLocalityChange,
  onHolidayEligibilityChange,
  onDailyWageChange,
  onDailyAllowanceChange,
  onOvertimeMultiplierChange,
  onEarlyPunchWindowChange,
  onLateGracePeriodChange,
  nightDifferential,
  onNightDifferentialChange,
  onToggleHoliday,
  onUpdateHolidayDate,
  onAddHoliday,
  onDeleteAccount,
  accountDeletionLoading,
}) {
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayType, setHolidayType] = useState("special-non-working");
  const [holidayLocality, setHolidayLocality] = useState("");
  const [holidayDescription, setHolidayDescription] = useState("");

  const handleAddHoliday = (event) => {
    event.preventDefault();
    if (onAddHoliday({
      name: holidayName,
      date: holidayDate,
      type: holidayType,
      locality: holidayLocality,
      description: holidayDescription,
    })) {
      setHolidayName("");
      setHolidayDate("");
      setHolidayType("special-non-working");
      setHolidayLocality("");
      setHolidayDescription("");
    }
  };

  return (
  <div id="settingsModal" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-hidden={!open} style={{ display: open ? "flex" : "none" }}>
    <div className="bg-cardBg rounded-2xl border border-slate-200 w-full max-w-3xl p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 font-bold text-lg">
            <i className="fa-solid fa-gear"></i>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
              System Configuration
            </span>
            <h3 className="font-extrabold text-xl text-textMain">
              
                Payroll &amp; Benefit Settings
              
            </h3>
          </div>
        </div>
        <button type="button" aria-label="Close modal" data-action="closeModal(&#x27;settingsModal&#x27;)" className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>
      <div className="flex space-x-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto text-xs font-semibold">
        <button data-action="switchSettingsTab(&#x27;earnings&#x27;)" id="tabBtnEarnings" className={activeSettingsTab === "earnings" ? "px-4 py-2 rounded-xl bg-teal-600 text-white transition cursor-pointer shadow-xs" : "px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"}>
          
            Earnings &amp; Rates
          
        </button>
        <button data-action="switchSettingsTab(&#x27;deductions&#x27;)" id="tabBtnDeductions" className={activeSettingsTab === "deductions" ? "px-4 py-2 rounded-xl bg-teal-600 text-white transition cursor-pointer shadow-xs" : "px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"}>
          
            Deductions &amp; Leave Balances
          
        </button>
        <button data-action="switchSettingsTab(&#x27;general&#x27;)" id="tabBtnGeneral" className={activeSettingsTab === "general" ? "px-4 py-2 rounded-xl bg-teal-600 text-white transition cursor-pointer shadow-xs" : "px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"}>
          
            General Preferences
          
        </button>
        <button data-action="switchSettingsTab(&#x27;holidays&#x27;)" id="tabBtnHolidays" className={activeSettingsTab === "holidays" ? "px-4 py-2 rounded-xl bg-teal-600 text-white transition cursor-pointer shadow-xs" : "px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"}>
          Manage Holidays
        </button>
      </div>
      <div id="settingsTabEarnings" className={activeSettingsTab === "earnings" ? "space-y-5 text-xs" : "space-y-5 text-xs hidden"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Daily Base Wage (PHP)
            </label>
            <input type="number" id="settingBaseWage" min="0" step="0.01" value={dailyWage} onChange={(event) => onDailyWageChange(event.target.value)} placeholder="Enter daily wage" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Company Allowance (Daily) (₱)
            </label>
            <input type="number" id="settingDailyAllowance" min="0" step="0.01" value={dailyAllowance} onChange={(event) => onDailyAllowanceChange(event.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Night Differential (%)
            </label>
            <input
              type="number"
              id="settingNightDiff"
              min="0"
              step="0.1"
              value={nightDifferential}
              onChange={(event) => onNightDifferentialChange(event.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Overtime Multiplier
            </label>
            <input type="number" id="settingOtMultiplier" min="0.01" step="0.05" value={overtimeMultiplier} onChange={(event) => onOvertimeMultiplierChange(event.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none" />
            <p className="mt-1 text-[11px] text-slate-500">
              Overtime pay = hourly rate × overtime hours × this multiplier.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1" htmlFor="settingEarlyPunchWindow">
              Allow early Time In (minutes)
            </label>
            <input
              type="number"
              id="settingEarlyPunchWindow"
              min="0"
              max="120"
              step="1"
              value={earlyPunchWindowMinutes}
              onChange={(event) => onEarlyPunchWindowChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p className="mt-1 text-[11px] text-slate-500">Time In opens this many minutes before the scheduled start. Default: 15.</p>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1" htmlFor="settingLateGracePeriod">
              Late grace period (minutes)
            </label>
            <input
              type="number"
              id="settingLateGracePeriod"
              min="0"
              max="120"
              step="1"
              value={lateGracePeriodMinutes}
              onChange={(event) => onLateGracePeriodChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p className="mt-1 text-[11px] text-slate-500">Changes Late status only, not punch eligibility. Default: 15.</p>
          </div>
        </div>
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
          Holiday-pay estimates use the configured daily wage and recorded hours. Eligibility and company-specific rules must be confirmed separately.
        </p>
      </div>
      <div id="settingsTabDeductions" className={activeSettingsTab === "deductions" ? "space-y-5 text-xs" : "space-y-5 text-xs hidden"}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              SSS Contribution (₱)
            </label>
            <input type="number" id="settingSss" placeholder="Not calculated" disabled className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              PhilHealth Contribution (₱)
            </label>
            <input type="number" id="settingPhilhealth" placeholder="Not calculated" disabled className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Pag-IBIG Contribution (₱)
            </label>
            <input type="number" id="settingPagibig" placeholder="Not calculated" disabled className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Statutory deductions and withholding tax are not calculated or applied to this personal earnings estimate.
        </p>
        <div className="pt-4 border-t border-slate-100">
          <span className="font-bold text-slate-800 block mb-3">
            <i className="fa-solid fa-umbrella-beach text-teal-600 mr-1.5"></i>
            Personal Leave Credits
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Vacation Leave (VL)
              </label>
              <input type="number" id="settingLeaveVL" value={settingsBalances.VL} min="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sick Leave (SL)
              </label>
              <input type="number" id="settingLeaveSL" value={settingsBalances.SL} min="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Emergency Leave (EL)
              </label>
              <input type="number" id="settingLeaveEL" value={settingsBalances.EL} min="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-2xl">
          <span className="font-bold text-teal-900 block mb-1">
            Leave Allocation &amp; Deduction Note
          </span>
          <span className="text-teal-700 text-[11px]">
            Configuring leave credits here dynamically updates available
              balances when filing leave requests across the system.
          </span>
        </div>
      </div>
      <div id="settingsTabGeneral" className={activeSettingsTab === "general" ? "space-y-5 text-xs" : "space-y-5 text-xs hidden"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Workspace
            </label>
            <input type="text" value="Personal" readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Primary Timezone
            </label>
            <select disabled className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium">
              <option value="Asia/Manila">
                Manila (Asia/Manila)
              </option>
            </select>
          </div>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
          <div>
            <span className="font-bold text-slate-800 block">
              Auto-Lock Inactive Sessions
            </span>
            <span className="text-slate-500 text-[11px]">
              Session expiration is managed by Supabase authentication.
            </span>
          </div>
          <input type="checkbox" disabled className="w-4 h-4 accent-teal-600 rounded cursor-not-allowed" aria-label="Session timeout managed by Supabase" />
        </div>
      </div>
      <div id="settingsTabHolidays" className={activeSettingsTab === "holidays" ? "space-y-5 text-xs" : "space-y-5 text-xs hidden"}>
        <section className="space-y-3" aria-labelledby="manageHolidaysHeading">
          <div>
            <h4 id="manageHolidaysHeading" className="font-bold text-slate-800">Manage Holidays</h4>
            <p className="mt-1 text-[11px] text-slate-500">
              The 2026 national list is preloaded. Eid dates can be revised when separately declared.
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block font-semibold text-slate-700">Active locality (optional)</span>
            <input
              type="text"
              value={selectedLocality}
              onChange={(event) => onLocalityChange(event.target.value)}
              placeholder="Enter locality to display configured local holidays"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={holidayEligibilityConfirmed}
              onChange={(event) => onHolidayEligibilityChange(event.target.checked)}
              className="h-4 w-4 accent-teal-600"
            />
            <span className="text-[11px] text-slate-700">Confirm employee eligibility for unworked regular-holiday pay estimates</span>
          </label>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {holidays.map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="min-w-0">
                  <span className={`block truncate font-semibold ${holiday.enabled ? "text-slate-800" : "text-slate-400 line-through"}`}>
                    {holiday.name}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    {holiday.date} · {holiday.classification || holiday.type}{holiday.locality ? ` · ${holiday.locality}` : ""}
                  </span>
                </span>
                {holiday.dateConfigurable && (
                  <input
                    aria-label={`Update ${holiday.name} date`}
                    type="date"
                    value={holiday.date}
                    onChange={(event) => onUpdateHolidayDate(holiday.id, event.target.value)}
                    className="w-32 shrink-0 rounded border border-slate-200 px-1.5 py-1 text-[10px]"
                  />
                )}
                <input
                  type="checkbox"
                  checked={holiday.enabled}
                  onChange={() => onToggleHoliday(holiday.id)}
                  aria-label={`${holiday.enabled ? "Disable" : "Enable"} ${holiday.name}`}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
                />
              </div>
            ))}
          </div>
          <form onSubmit={handleAddHoliday} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            <label className="sr-only" htmlFor="customHolidayName">Holiday name</label>
            <input
              id="customHolidayName"
              type="text"
              value={holidayName}
              onChange={(event) => setHolidayName(event.target.value)}
              placeholder="Holiday name"
              maxLength={80}
              required
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <label className="sr-only" htmlFor="customHolidayDate">Holiday date</label>
            <input
              id="customHolidayDate"
              type="date"
              value={holidayDate}
              onChange={(event) => setHolidayDate(event.target.value)}
              required
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <label className="sr-only" htmlFor="customHolidayType">Holiday classification</label>
            <select id="customHolidayType" value={holidayType} onChange={(event) => setHolidayType(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800">
              <option value="regular-holiday">Regular Holiday</option>
              <option value="special-non-working">Special Non-Working Day</option>
              <option value="special-working">Special Working Day</option>
              <option value="local-holiday">Local Holiday</option>
              <option value="ordinary-working">Ordinary Working Day</option>
              <option value="company-break">Company Break (Paid)</option>
            </select>
            {holidayType === "local-holiday" && (
              <input value={holidayLocality} onChange={(event) => setHolidayLocality(event.target.value)} placeholder="Locality (required)" required className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800" />
            )}
            <input value={holidayDescription} onChange={(event) => setHolidayDescription(event.target.value)} placeholder="Description (optional)" maxLength={200} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800" />
            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 sm:col-span-2"
            >
              Add
            </button>
          </form>
        </section>
      </div>
      <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4">
        <h4 className="text-sm font-bold text-rose-800">Privacy and account</h4>
        <p className="mt-1 text-xs leading-relaxed text-rose-700">
          Your workspace contains personal attendance and compensation information. It is protected by account-scoped database policies, but is not end-to-end encrypted. Exported files should be kept private.
        </p>
        <button
          type="button"
          onClick={onDeleteAccount}
          disabled={accountDeletionLoading}
          className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {accountDeletionLoading ? "Deleting account..." : "Delete my account and data"}
        </button>
      </div>
      <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-6 text-xs">
        <span className="text-slate-500">
          Changes sync to your private cloud workspace.
        </span>
        <div className="space-x-2">
          <button data-action="closeModal(&#x27;settingsModal&#x27;)" className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-xl transition cursor-pointer">
            
              Cancel
            
          </button>
          <button data-action="saveSettings()" className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 py-2 rounded-xl shadow transition cursor-pointer">
            
              Save Configurations
            
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}
