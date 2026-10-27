import React from "react";

export default function AssignShiftModal({ open, selectedDate, shiftTemplateCards, customShiftName, setCustomShiftName, selectedIcon }) {
  return (
  <div id="assignShiftModal" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-hidden={!open} style={{ display: open ? "flex" : "none" }}>
    <div className="bg-cardBg rounded-2xl border border-slate-200 w-full max-w-lg p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
      <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
        <h3 className="font-bold text-lg text-textMain flex items-center space-x-2">
          <i className="fa-regular fa-calendar-days text-teal-600"></i>
          <span>
            Assign or Create Shift Schedule
          </span>
        </h3>
        <button type="button" aria-label="Close modal" data-action="closeModal(&#x27;assignShiftModal&#x27;)" className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>
      <form data-submit-action="handleAssignShiftSubmit(event)" className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Start Date
            </label>
            <input type="date" id="assignStartDate" name="assignStartDate" defaultValue={selectedDate} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800" required={true} />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              End Date
            </label>
            <input type="date" id="assignEndDate" name="assignEndDate" defaultValue={selectedDate} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800" required={true} />
          </div>
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-2">
            Select Shift Template
          </label>
          <input type="hidden" id="selectedShiftTemplate" defaultValue="morning" />
          <div id="shiftTemplatesContainer" className="grid grid-cols-2 sm:grid-cols-3 gap-3">{shiftTemplateCards}</div>
        </div>
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            Or Create Custom Shift
          </span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="font-bold text-slate-800 flex items-center space-x-1.5">
            <i className="fa-solid fa-wand-magic-sparkles text-teal-600"></i>
            <span>
              New Shift Builder
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">
                Shift Name
              </label>
              <input type="text" id="customShiftName" value={customShiftName} onChange={(event) => setCustomShiftName(event.target.value)} placeholder="e.g. NOC Night Watch" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800" />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">
                Select Icon
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                <button type="button" aria-label="Select sun icon" data-action="selectShiftIcon(&#x27;fa-sun&#x27;, this)" className={`shift-icon-btn p-2 rounded-lg border transition flex items-center justify-center cursor-pointer ${selectedIcon === "fa-sun" ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-400"} text-slate-700`}>
                  <i className="fa-solid fa-sun text-amber-500"></i>
                </button>
                <button type="button" aria-label="Select moon icon" data-action="selectShiftIcon(&#x27;fa-moon&#x27;, this)" className={`shift-icon-btn p-2 rounded-lg border transition flex items-center justify-center cursor-pointer ${selectedIcon === "fa-moon" ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-400"} text-slate-700`}>
                  <i className="fa-solid fa-moon text-indigo-600"></i>
                </button>
                <button type="button" aria-label="Select partly cloudy icon" data-action="selectShiftIcon(&#x27;fa-solid fa-cloud-sun&#x27;, this)" className={`shift-icon-btn p-2 rounded-lg border transition flex items-center justify-center cursor-pointer ${selectedIcon === "fa-cloud-sun" ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-400"} text-slate-700`}>
                  <i className="fa-solid fa-cloud-sun text-orange-500"></i>
                </button>
                <button type="button" aria-label="Select shield icon" data-action="selectShiftIcon(&#x27;fa-shield-halved&#x27;, this)" className={`shift-icon-btn p-2 rounded-lg border transition flex items-center justify-center cursor-pointer ${selectedIcon === "fa-shield-halved" ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-400"} text-slate-700`}>
                  <i className="fa-solid fa-shield-halved text-rose-600"></i>
                </button>
                <button type="button" aria-label="Select bolt icon" data-action="selectShiftIcon(&#x27;fa-bolt&#x27;, this)" className={`shift-icon-btn p-2 rounded-lg border transition flex items-center justify-center cursor-pointer ${selectedIcon === "fa-bolt" ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-400"} text-slate-700`}>
                  <i className="fa-solid fa-bolt text-amber-500"></i>
                </button>
                <button type="button" aria-label="Select clock icon" data-action="selectShiftIcon(&#x27;fa-clock&#x27;, this)" className={`shift-icon-btn p-2 rounded-lg border transition flex items-center justify-center cursor-pointer ${selectedIcon === "fa-clock" ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/30" : "border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-400"} text-slate-700`}>
                  <i className="fa-solid fa-clock text-slate-600"></i>
                </button>
              </div>
              <input type="hidden" id="selectedIconVal" defaultValue="fa-moon" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">
                Start Time
              </label>
              <input type="time" id="customShiftStart" defaultValue="22:00" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800" />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">
                End Time
              </label>
              <input type="time" id="customShiftEnd" defaultValue="06:00" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800" />
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-2 pt-3">
          <button type="button" data-action="closeModal(&#x27;assignShiftModal&#x27;)" className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
            
              Cancel
            
          </button>
          <button type="button" id="saveCustomShiftBtn" data-action="handleSaveCustomShift(event)" className={customShiftName.trim() ? "bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition shadow-sm cursor-pointer items-center space-x-1" : "hidden"}>
            <i className="fa-solid fa-check text-[10px]"></i>
            <span>
              Save Shift
            </span>
          </button>
          <button type="submit" className="px-4 py-2 rounded-xl text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white shadow-sm cursor-pointer">
            
              Assign Shift
            
          </button>
        </div>
      </form>
    </div>
  </div>
  );
}
