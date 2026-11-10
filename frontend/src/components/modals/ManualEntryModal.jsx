import React, { useEffect, useState } from "react";

export default function ManualEntryModal({
  open,
  selectedDate,
  initialTimeIn = "06:00",
  initialTimeOut = "14:00",
}) {
  const [entryType, setEntryType] = useState("Present");
  const [timeIn, setTimeIn] = useState(initialTimeIn);
  const [timeOut, setTimeOut] = useState(initialTimeOut);

  useEffect(() => {
    if (!open) return;
    setEntryType("Present");
    setTimeIn(initialTimeIn);
    setTimeOut(initialTimeOut);
  }, [initialTimeIn, initialTimeOut, open, selectedDate]);

  const halfDayTimeOut = (() => {
    const [hour, minute] = timeIn.split(":").map(Number);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return "";
    const totalMinutes = (hour * 60 + minute + 4 * 60) % (24 * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  })();
  const displayedTimeOut = entryType === "Half-day" ? halfDayTimeOut : timeOut;

  return (
  <div id="manualEntryModal" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-hidden={!open} style={{ display: open ? "flex" : "none" }}>
    <div className="bg-cardBg rounded-2xl border border-slate-200 w-full max-w-md p-6 shadow-2xl">
      <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
        <h3 className="font-bold text-lg text-textMain flex items-center space-x-2">
          <i className="fa-solid fa-pen-to-square text-teal-600"></i>
          <span>
            Direct Attendance Entry
          </span>
        </h3>
        <button type="button" aria-label="Close modal" data-action="closeModal(&#x27;manualEntryModal&#x27;)" className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>
      <form data-submit-action="handleManualEntrySubmit(event)" className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Entry Type
          </label>
          <select id="manualEntryType" name="manualEntryType" value={entryType} onChange={(event) => setEntryType(event.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800">
            <option value="Present">
              Present / Correction (Full Shift)
            </option>
            <option value="Half-day">
              Half-day (4 hours)
            </option>
            <option value="Overtime">
              Overtime Claim
            </option>
            <option value="Absent">
              Absent
            </option>
            <option value="Official Business">
              
                Official Business / Field Work
              
            </option>
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Target Date
          </label>
          <input type="date" id="manualEntryDate" name="manualEntryDate" defaultValue={selectedDate} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800" required={true} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Time In
            </label>
            <input type="time" id="manualTimeIn" name="manualTimeIn" value={timeIn} onChange={(event) => setTimeIn(event.target.value)} disabled={entryType === "Absent"} required={entryType !== "Absent"} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-60" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Time Out
            </label>
            <input type="time" id="manualTimeOut" name="manualTimeOut" value={displayedTimeOut} onChange={(event) => setTimeOut(event.target.value)} readOnly={entryType === "Half-day"} disabled={entryType === "Absent"} required={entryType !== "Absent"} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 read-only:cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-60" />
          </div>
        </div>
        {entryType === "Half-day" && (
          <p className="-mt-2 text-[11px] text-slate-500">
            Half-day records 4 hours. Time Out is set automatically from Time In.
          </p>
        )}
        <div className="flex justify-end space-x-2 pt-2">
          <button type="button" data-action="closeModal(&#x27;manualEntryModal&#x27;)" className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
            
              Cancel
            
          </button>
          <button type="submit" className="px-4 py-2 rounded-xl text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white shadow-sm cursor-pointer">
            
              Apply Directly
            
          </button>
        </div>
      </form>
    </div>
  </div>
  );
}
