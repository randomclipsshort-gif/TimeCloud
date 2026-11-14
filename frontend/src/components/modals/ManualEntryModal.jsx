import React, { useEffect, useState } from "react";

function formatTwelveHourTime(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):([0-5]\d)(?:\s*(AM|PM))?$/i);
  if (!match) return "";

  let hour = Number(match[1]);
  const period = match[3]?.toUpperCase();
  if (hour > (period ? 12 : 23) || (period && hour < 1)) return "";
  if (period) hour = (hour % 12) + (period === "PM" ? 12 : 0);

  return `${String(hour % 12 || 12).padStart(2, "0")}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function toTwentyFourHourTime(value) {
  const match = String(value || "")
    .trim()
    .match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) return "";

  const hour =
    (Number(match[1]) % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function formatCompactTime(value) {
  const formatted = formatTwelveHourTime(value);
  if (!formatted) return "";
  const [clock, period] = formatted.split(" ");
  const [hour, minute] = clock.split(":");
  return `${Number(hour)}${minute === "00" ? "" : `:${minute}`}${period.toLowerCase()}`;
}

export default function ManualEntryModal({
  open,
  selectedDate,
  selectedRange,
  initialEntryType = "Present",
  initialTimeIn = "06:00",
  initialTimeOut = "14:00",
  leaveBalances = {},
  leaveTypes = {},
  shiftTemplates = [],
}) {
  const [entryType, setEntryType] = useState(initialEntryType);
  const [leaveCode, setLeaveCode] = useState("");
  const [quickShiftTemplateId, setQuickShiftTemplateId] = useState("");
  const [timeIn, setTimeIn] = useState(() =>
    formatTwelveHourTime(initialTimeIn),
  );
  const [timeOut, setTimeOut] = useState(() =>
    formatTwelveHourTime(initialTimeOut),
  );

  useEffect(() => {
    if (!open) return;
    setEntryType(initialEntryType);
    setLeaveCode("");
    setQuickShiftTemplateId("");
    setTimeIn(formatTwelveHourTime(initialTimeIn));
    setTimeOut(formatTwelveHourTime(initialTimeOut));
  }, [initialEntryType, initialTimeIn, initialTimeOut, open, selectedDate]);

  const timeIn24 = toTwentyFourHourTime(timeIn);
  const halfDayTimeOut = (() => {
    if (!timeIn24) return "";
    const [hour, minute] = timeIn24.split(":").map(Number);
    const totalMinutes = (hour * 60 + minute + 4 * 60) % (24 * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  })();
  const displayedTimeOut =
    entryType === "Half-day"
      ? formatTwelveHourTime(halfDayTimeOut)
      : timeOut;
  const timeOut24 = toTwentyFourHourTime(displayedTimeOut);
  const showTimeFields = !["Leave", "Absent"].includes(entryType);

  const quickShiftOptions = (Array.isArray(shiftTemplates) ? shiftTemplates : [])
    .filter(
      (template) =>
        template.id !== "rest-day" &&
        formatTwelveHourTime(template.startTime) &&
        formatTwelveHourTime(template.endTime),
    )
    .sort((left, right) => {
      const priority = (template) => {
        const name = `${template.label || template.name || ""}`.toLowerCase();
        if (name.includes("morning")) return 0;
        if (name.includes("mid")) return 1;
        if (name.includes("night")) return 2;
        return 3;
      };
      return priority(left) - priority(right);
    })
    .slice(0, 3);
  const selectedQuickShift = quickShiftOptions.find(
    (template) => template.id === quickShiftTemplateId,
  );

  const setQuickShift = (template) => {
    setQuickShiftTemplateId(template.id);
    setTimeIn(formatTwelveHourTime(template.startTime));
    setTimeOut(formatTwelveHourTime(template.endTime));
  };

  const statusOptions = [
    {
      value: "Present",
      label: "Present",
      activeClass: "border-emerald-600 bg-emerald-600 text-white",
    },
    {
      value: "Leave",
      label: "Leave",
      activeClass: "border-amber-500 bg-amber-500 text-white",
    },
    {
      value: "Absent",
      label: "Absent",
      activeClass: "border-rose-600 bg-rose-600 text-white",
    },
  ];

  return (
    <div
      id="manualEntryModal"
      className="fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      style={{ display: open ? "flex" : "none" }}
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600">
              <i className="fa-solid fa-pen text-sm" aria-hidden="true"></i>
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">
                Direct Attendance Entry
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Log precise Time In &amp; Time Out in 12-Hour format
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            data-action="closeModal(&#x27;manualEntryModal&#x27;)"
            className="ml-3 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
          </button>
        </div>

        <form
          data-submit-action="handleManualEntrySubmit(event)"
          className="space-y-4 px-5 py-4"
        >
          <input type="hidden" name="manualEntryType" value={entryType} />
          <input
            type="hidden"
            name="manualShiftTemplateId"
            value={quickShiftTemplateId}
          />
          <input type="hidden" name="manualTimeIn" value={timeIn24} />
          <input type="hidden" name="manualTimeOut" value={timeOut24} />

          {selectedRange ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Start Date", selectedRange.startDate],
                  ["End Date", selectedRange.endDate],
                ].map(([label, value]) => (
                  <div key={label}>
                    <label className="mb-1.5 block text-[11px] font-semibold text-slate-800">
                      {label}
                    </label>
                    <input
                      type="date"
                      value={value}
                      disabled
                      readOnly
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 disabled:opacity-100"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500" role="status">
                {entryType === "Leave"
                  ? `This leave will be applied to ${selectedRange.dayCount} selected date${selectedRange.dayCount === 1 ? "" : "s"}.`
                  : entryType === "Absent"
                    ? `Absent status will be applied to ${selectedRange.dayCount} selected date${selectedRange.dayCount === 1 ? "" : "s"}.`
                      : selectedQuickShift
                        ? `${selectedQuickShift.label || selectedQuickShift.name} will be assigned to all ${selectedRange.dayCount} selected dates.`
                        : `This entry will be applied to ${selectedRange.dayCount} date${selectedRange.dayCount === 1 ? "" : "s"}. Existing attendance must be clear; unscheduled dates are recorded without scheduled payroll hours.`}
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="manualEntryDate"
                className="mb-1.5 block text-[11px] font-semibold text-slate-800"
              >
                Target Date
              </label>
              <input
                type="date"
                id="manualEntryDate"
                name="manualEntryDate"
                defaultValue={selectedDate}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>
          )}

          <fieldset>
            <legend className="mb-1.5 text-[11px] font-semibold text-slate-800">
              Attendance Status
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {statusOptions.map((status) => (
                <button
                  key={status.value}
                  type="button"
                  aria-pressed={entryType === status.value}
                  onClick={() => {
                    setEntryType(status.value);
                    setQuickShiftTemplateId("");
                    if (status.value === "Leave") setLeaveCode("");
                  }}
                  className={`min-h-[35px] cursor-pointer rounded-xl border px-3 py-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${
                    entryType === status.value
                      ? status.activeClass
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </fieldset>

          {entryType === "Leave" && (
            <div>
              <label
                htmlFor="manualLeaveType"
                className="mb-1.5 block text-[11px] font-semibold text-slate-800"
              >
                Leave Type
              </label>
              <select
                id="manualLeaveType"
                name="manualLeaveType"
                value={leaveCode}
                onChange={(event) => setLeaveCode(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Choose a leave type</option>
                {Object.entries(leaveTypes).map(([code, leave]) => {
                  const balance = Number(leaveBalances[code]);
                  return (
                    <option key={code} value={code}>
                      {leave.name} ·{" "}
                      {Number.isFinite(balance) ? balance : 0} left
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {showTimeFields && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: "manualTimeInDisplay",
                    label: "Time In",
                    value: timeIn,
                    setValue: setTimeIn,
                    readonly: false,
                  },
                  {
                    id: "manualTimeOutDisplay",
                    label: "Time Out",
                    value: displayedTimeOut,
                    setValue: setTimeOut,
                    readonly: entryType === "Half-day",
                  },
                ].map((field) => (
                  <div key={field.id}>
                    <label
                      htmlFor={field.id}
                      className="mb-1.5 block text-[11px] font-semibold text-slate-800"
                    >
                      {field.label}
                    </label>
                    <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                      <i
                        className="fa-regular fa-clock shrink-0 text-[13px] text-slate-400"
                        aria-hidden="true"
                      ></i>
                      <input
                        type="text"
                        id={field.id}
                        value={field.value}
                        onChange={(event) => field.setValue(event.target.value)}
                        readOnly={field.readonly}
                        required
                        maxLength={8}
                        pattern="(0?[1-9]|1[0-2]):[0-5][0-9][ ]?(AM|PM)"
                        title="Enter time in 12-hour format, such as 06:00 AM"
                        placeholder="06:00 AM"
                        autoComplete="off"
                        className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400 read-only:cursor-not-allowed"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {quickShiftOptions.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    Quick Shifts
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickShiftOptions.map((template) => {
                      const name = template.label || template.name;
                      const displayName = name.toLowerCase().includes("mid")
                        ? "Mid"
                        : name;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          aria-pressed={quickShiftTemplateId === template.id}
                          onClick={() => setQuickShift(template)}
                          className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                            quickShiftTemplateId === template.id
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                          }`}
                        >
                          {displayName} ({formatCompactTime(template.startTime)}-
                          {formatCompactTime(template.endTime)})
                        </button>
                      );
                    })}
                  </div>
                  {selectedQuickShift && (
                    <p className="mt-1.5 text-[10px] text-emerald-700" role="status">
                      This shift will be assigned when you apply the entry.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {entryType === "Half-day" && (
            <p className="-mt-2 text-[10px] text-slate-500">
              Half-day records 4 hours. Time Out is set automatically from Time
              In.
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              data-action="closeModal(&#x27;manualEntryModal&#x27;)"
              className="min-h-9 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <i className="fa-solid fa-check" aria-hidden="true"></i>
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
