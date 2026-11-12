import React from "react";
import ShiftIcon from "../ui/ShiftIcon.jsx";

export default function AssignShiftModal({
  open,
  selectedDate,
  selectedRange,
  shiftTemplateCards,
  isCustomShiftActive,
  setIsCustomShiftActive,
  customShiftName,
  setCustomShiftName,
  customShiftStart,
  setCustomShiftStart,
  customShiftEnd,
  setCustomShiftEnd,
  selectedIcon,
}) {
  const startDate = selectedRange?.startDate || selectedDate;
  const endDate = selectedRange?.endDate || selectedDate;

  return (
  <div id="assignShiftModal" className="fixed inset-0 z-50 hidden flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-hidden={!open} style={{ display: open ? "flex" : "none" }}>
    <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-cardBg p-5 shadow-2xl sm:p-6">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-textMain">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <i className="fa-regular fa-calendar-days" aria-hidden="true"></i>
          </span>
          <span>Assign or Create Shift Schedule</span>
        </h3>
        <button type="button" aria-label="Close modal" data-action="closeModal(&#x27;assignShiftModal&#x27;)" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
          <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
        </button>
      </div>
      <form data-submit-action="handleAssignShiftSubmit(event)" className="flex min-h-0 flex-1 flex-col text-xs">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Selected Calendar Range
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
              {selectedRange?.dayCount || 1} Day
              {(selectedRange?.dayCount || 1) === 1 ? "" : "s"} Selected
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="assignStartDate" className="mb-1 block font-semibold text-slate-700">
              Start Date
            </label>
            <input type="date" id="assignStartDate" name="assignStartDate" defaultValue={startDate} readOnly={Boolean(selectedRange)} disabled={Boolean(selectedRange)} aria-readonly={Boolean(selectedRange)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-white" required={true} />
          </div>
          <div>
            <label htmlFor="assignEndDate" className="mb-1 block font-semibold text-slate-700">
              End Date
            </label>
            <input type="date" id="assignEndDate" name="assignEndDate" defaultValue={endDate} readOnly={Boolean(selectedRange)} disabled={Boolean(selectedRange)} aria-readonly={Boolean(selectedRange)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-white" required={true} />
          </div>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="font-semibold text-slate-700">
              Select Shift Template
            </label>
            <span className="text-[9px] font-medium text-slate-400">
              12-Hour Schedule Format
            </span>
          </div>
          <input type="hidden" id="selectedShiftTemplate" defaultValue="morning" />
          <div id="shiftTemplatesContainer" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{shiftTemplateCards}</div>
        </div>
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-slate-200"></div>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Or Create Custom Shift
          </span>
          <div className="h-px flex-1 bg-slate-200"></div>
        </div>
        <div
          onClick={() => setIsCustomShiftActive(true)}
          onFocusCapture={() => setIsCustomShiftActive(true)}
          className={`space-y-3 rounded-2xl border p-4 transition ${
            isCustomShiftActive
              ? "border-teal-400 bg-teal-50/20 shadow-sm"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <i className="fa-solid fa-wand-magic-sparkles text-teal-600" aria-hidden="true"></i>
              <span>New Shift Builder</span>
            </div>
            {isCustomShiftActive && (
              <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[9px] font-bold text-teal-700">
                Active
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="customShiftName" className="mb-1 block font-semibold text-slate-600">
                Shift Name
              </label>
              <input type="text" id="customShiftName" value={customShiftName} onChange={(event) => setCustomShiftName(event.target.value)} placeholder="e.g. NOC Night Watch" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-600">
                Select Icon
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                <button type="button" aria-label="Select sun icon" data-action="selectShiftIcon(&#x27;fa-sun&#x27;, this)" className={`shift-icon-btn flex cursor-pointer items-center justify-center rounded-lg border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${selectedIcon === "fa-sun" ? "border-teal-500 bg-white ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50"} text-slate-700`}>
                  <ShiftIcon icon="fa-sun" size={16} className="text-indigo-600" />
                </button>
                <button type="button" aria-label="Select moon icon" data-action="selectShiftIcon(&#x27;fa-moon&#x27;, this)" className={`shift-icon-btn flex cursor-pointer items-center justify-center rounded-lg border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${selectedIcon === "fa-moon" ? "border-teal-500 bg-white ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50"} text-slate-700`}>
                  <ShiftIcon icon="fa-moon" size={16} className="text-slate-600" />
                </button>
                <button type="button" aria-label="Select partly cloudy icon" data-action="selectShiftIcon(&#x27;fa-solid fa-cloud-sun&#x27;, this)" className={`shift-icon-btn flex cursor-pointer items-center justify-center rounded-lg border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${selectedIcon === "fa-cloud-sun" ? "border-teal-500 bg-white ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50"} text-slate-700`}>
                  <ShiftIcon
                    icon="fa-cloud-sun"
                    size={16}
                    className="text-indigo-600"
                  />
                </button>
                <button type="button" aria-label="Select shield icon" data-action="selectShiftIcon(&#x27;fa-shield-halved&#x27;, this)" className={`shift-icon-btn flex cursor-pointer items-center justify-center rounded-lg border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${selectedIcon === "fa-shield-halved" ? "border-teal-500 bg-white ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50"} text-slate-700`}>
                  <i className="fa-solid fa-shield-halved text-rose-600" aria-hidden="true"></i>
                </button>
                <button type="button" aria-label="Select bolt icon" data-action="selectShiftIcon(&#x27;fa-bolt&#x27;, this)" className={`shift-icon-btn flex cursor-pointer items-center justify-center rounded-lg border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${selectedIcon === "fa-bolt" ? "border-teal-500 bg-white ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50"} text-slate-700`}>
                  <i className="fa-solid fa-bolt text-amber-500" aria-hidden="true"></i>
                </button>
                <button type="button" aria-label="Select clock icon" data-action="selectShiftIcon(&#x27;fa-clock&#x27;, this)" className={`shift-icon-btn flex cursor-pointer items-center justify-center rounded-lg border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${selectedIcon === "fa-clock" ? "border-teal-500 bg-white ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50"} text-slate-700`}>
                  <i className="fa-solid fa-clock text-slate-600" aria-hidden="true"></i>
                </button>
              </div>
              <input type="hidden" id="selectedIconVal" defaultValue="fa-moon" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="customShiftStart" className="mb-1 block font-semibold text-slate-600">
                Start Time (12h)
              </label>
              <input type="text" id="customShiftStart" value={customShiftStart} onChange={(event) => setCustomShiftStart(event.target.value)} placeholder="10:00 PM" aria-label="Custom shift start time in 12-hour format" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono font-semibold text-slate-800 outline-none transition placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
            </div>
            <div>
              <label htmlFor="customShiftEnd" className="mb-1 block font-semibold text-slate-600">
                End Time (12h)
              </label>
              <input type="text" id="customShiftEnd" value={customShiftEnd} onChange={(event) => setCustomShiftEnd(event.target.value)} placeholder="06:00 AM" aria-label="Custom shift end time in 12-hour format" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono font-semibold text-slate-800 outline-none transition placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
            </div>
          </div>
        </div>
        </div>
        <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-cardBg pt-3">
          <button type="button" data-action="closeModal(&#x27;assignShiftModal&#x27;)" className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            Cancel
          </button>
          <button type="button" id="saveCustomShiftBtn" data-action="handleSaveCustomShift(event)" className={customShiftName.trim() ? "flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2" : "hidden"}>
            <i className="fa-solid fa-check text-[10px]" aria-hidden="true"></i>
            <span>Save Shift</span>
          </button>
          <button type="submit" className="cursor-pointer rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
            Assign Shift
          </button>
        </div>
      </form>
    </div>
  </div>
  );
}
