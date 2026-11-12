import React, { useEffect, useState } from "react";

export default function ManualEntryModal({
  open,
  selectedDate,
  selectedRange,
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
    <div
      id="manualEntryModal"
      className="fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      style={{ display: open ? "flex" : "none" }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-cardBg p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="flex items-center gap-2.5 text-lg font-bold text-textMain">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <i
                className="fa-solid fa-pen-to-square"
                aria-hidden="true"
              ></i>
            </span>
            <span>Direct Attendance Entry</span>
          </h3>
          <button
            type="button"
            aria-label="Close modal"
            data-action="closeModal(&#x27;manualEntryModal&#x27;)"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
          </button>
        </div>

        <form
          data-submit-action="handleManualEntrySubmit(event)"
          className="space-y-4 text-xs"
        >
          <div>
            <label
              htmlFor="manualEntryType"
              className="mb-1 block font-semibold text-slate-700"
            >
              Entry Type
            </label>
            <select
              id="manualEntryType"
              name="manualEntryType"
              value={entryType}
              onChange={(event) => setEntryType(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              <option value="Present">Present / Correction (Full Shift)</option>
              <option value="Half-day">Half-day (4 hours)</option>
              <option value="Overtime">Overtime Claim</option>
              <option value="Absent">Absent</option>
              <option value="Official Business">
                Official Business / Field Work
              </option>
            </select>
          </div>

          {selectedRange ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={selectedRange.startDate}
                    disabled
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={selectedRange.endDate}
                    disabled
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-600"
                  />
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600" role="status">
                This same entry will be applied to {selectedRange.dayCount} date
                {selectedRange.dayCount === 1 ? "" : "s"}. All dates must have
                an eligible shift and no existing attendance; otherwise none
                will be changed.
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="manualEntryDate"
                className="mb-1 block font-semibold text-slate-700"
              >
                Target Date
              </label>
              <input
                type="date"
                id="manualEntryDate"
                name="manualEntryDate"
                defaultValue={selectedDate}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="manualTimeIn"
                className="mb-1 block font-semibold text-slate-700"
              >
                Time In
              </label>
              <input
                type="time"
                id="manualTimeIn"
                name="manualTimeIn"
                value={timeIn}
                onChange={(event) => setTimeIn(event.target.value)}
                disabled={entryType === "Absent"}
                required={entryType !== "Absent"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label
                htmlFor="manualTimeOut"
                className="mb-1 block font-semibold text-slate-700"
              >
                Time Out
              </label>
              <input
                type="time"
                id="manualTimeOut"
                name="manualTimeOut"
                value={displayedTimeOut}
                onChange={(event) => setTimeOut(event.target.value)}
                readOnly={entryType === "Half-day"}
                disabled={entryType === "Absent"}
                required={entryType !== "Absent"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 read-only:cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          {entryType === "Half-day" && (
            <p className="-mt-2 text-[11px] text-slate-500">
              Half-day records 4 hours. Time Out is set automatically from Time
              In.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              data-action="closeModal(&#x27;manualEntryModal&#x27;)"
              className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {selectedRange
                ? `Apply to ${selectedRange.dayCount} day${selectedRange.dayCount === 1 ? "" : "s"}`
                : "Apply Directly"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
