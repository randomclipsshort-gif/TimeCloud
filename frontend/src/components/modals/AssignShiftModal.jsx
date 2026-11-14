import React, { useState } from "react";
import { getInclusiveDateKeys } from "../../utils/calendarRange.js";
import { getPayrollPeriodForDate } from "../../utils/payrollPeriods.js";
import ShiftIcon from "../ui/ShiftIcon.jsx";

const iconOptions = [
  { icon: "fa-sun", label: "Sun", color: "text-amber-500" },
  { icon: "fa-moon", label: "Moon", color: "text-indigo-600" },
  {
    icon: "fa-cloud-sun",
    label: "Partly cloudy",
    color: "text-orange-500",
  },
  {
    icon: "fa-shield-halved",
    label: "Shield",
    color: "text-rose-600",
  },
  { icon: "fa-bolt", label: "Bolt", color: "text-amber-500" },
  { icon: "fa-clock", label: "Clock", color: "text-slate-600" },
];

const dateInputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

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
  customBreakDuration,
  setCustomBreakDuration,
  customBreakType,
  setCustomBreakType,
  expectedPaidHours,
  editingShiftTemplateId,
  selectedIcon,
  setEditingShiftTemplateId,
  selectedShiftTemplateName,
  selectedShiftTemplateExpectedHours,
  selectedShiftTemplateIsRestDay,
  dailyWage,
}) {
  const initialStartDate = selectedRange?.startDate || selectedDate;
  const initialEndDate = selectedRange?.endDate || selectedDate;
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [activePreset, setActivePreset] = useState(
    initialStartDate === initialEndDate ? "1-day" : "custom",
  );
  const selectedDayCount =
    startDate && endDate ? getInclusiveDateKeys(startDate, endDate).length : 0;
  const configuredWage = Number(dailyWage);
  const hasConfiguredWage =
    Number.isFinite(configuredWage) && configuredWage > 0;

  const setDatePreset = (preset) => {
    if (!initialStartDate) return;
    let presetStart = initialStartDate;
    let presetEnd = initialStartDate;

    if (preset === "rest-of-week") {
      const date = new Date(`${initialStartDate}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + (6 - date.getUTCDay()));
      presetEnd = date.toISOString().slice(0, 10);
    } else if (preset === "full-cutoff") {
      const period = getPayrollPeriodForDate(initialStartDate);
      if (!period) return;
      presetStart = period.startDate;
      presetEnd = period.endDate;
    }

    setStartDate(presetStart);
    setEndDate(presetEnd);
    setActivePreset(preset);
  };

  const updateDate = (field, value) => {
    if (field === "start") setStartDate(value);
    else setEndDate(value);
    setActivePreset("custom");
  };

  const datePresets = [
    { id: "1-day", label: "1 Day" },
    { id: "rest-of-week", label: "Rest of Week" },
    { id: "full-cutoff", label: "Full Cutoff" },
  ];

  const displayExpectedHours =
    expectedPaidHours === null ||
    expectedPaidHours === undefined ||
    !Number.isFinite(Number(expectedPaidHours))
      ? "—"
      : Number(expectedPaidHours).toFixed(2);

  return (
    <div
      id="assignShiftModal"
      className="fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/55 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      style={{ display: open ? "flex" : "none" }}
    >
      <div className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <i className="fa-regular fa-calendar-days" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                {isCustomShiftActive
                  ? editingShiftTemplateId
                    ? "Edit Shift Template"
                    : "Create Custom Shift Template"
                  : "Assign Shift"}
              </h3>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 sm:text-xs">
                12-Hour Schedule Format <span className="px-1">•</span>{" "}
                Instant payroll sync
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className="hidden items-center rounded-lg bg-slate-100 p-1 sm:flex"
              role="tablist"
              aria-label="Shift modal view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isCustomShiftActive}
                onClick={() => {
                  setIsCustomShiftActive(false);
                  setEditingShiftTemplateId(null);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  !isCustomShiftActive
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Quick Assign
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isCustomShiftActive}
                data-action="openNewShiftTemplate()"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  isCustomShiftActive
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                + New Template
              </button>
            </div>
            <button
              type="button"
              aria-label="Close modal"
              data-action="closeModal('assignShiftModal')"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
            </button>
          </div>
        </div>

        <form
          data-submit-action="handleAssignShiftSubmit(event)"
          onSubmit={(event) => {
            if (isCustomShiftActive) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          className="flex min-h-0 flex-1 flex-col text-xs"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
            <section
              aria-label="Schedule date range"
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Schedule Dates
                </span>
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">
                  {selectedDayCount} Day{selectedDayCount === 1 ? "" : "s"}{" "}
                  Selected
                </span>
              </div>
              <div className="grid grid-cols-2 items-end gap-3">
                <div>
                  <label
                    htmlFor="assignStartDate"
                    className="mb-1.5 block font-semibold text-slate-700"
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="assignStartDate"
                    name="assignStartDate"
                    value={startDate}
                    onChange={(event) =>
                      updateDate("start", event.target.value)
                    }
                    className={dateInputClass}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="assignEndDate"
                    className="mb-1.5 block font-semibold text-slate-700"
                  >
                    End Date
                  </label>
                  <input
                    type="date"
                    id="assignEndDate"
                    name="assignEndDate"
                    value={endDate}
                    onChange={(event) => updateDate("end", event.target.value)}
                    className={dateInputClass}
                    required
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {datePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={activePreset === preset.id}
                    onClick={() => setDatePreset(preset.id)}
                    className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${
                      activePreset === preset.id
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </section>

            {isCustomShiftActive ? (
              <section className="space-y-4" aria-label="Shift template editor">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    data-action="closeShiftTemplateBuilder()"
                    className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-teal-700 hover:text-teal-800"
                  >
                    <i className="fa-solid fa-arrow-left text-[10px]" aria-hidden="true" />
                    Back to Templates
                  </button>
                  <span className="text-[10px] font-medium text-slate-400">
                    Shift template settings
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_1fr]">
                  <div>
                    <label
                      htmlFor="customShiftName"
                      className="mb-1.5 block font-semibold text-slate-700"
                    >
                      Template Name
                    </label>
                    <input
                      type="text"
                      id="customShiftName"
                      value={customShiftName}
                      onChange={(event) =>
                        setCustomShiftName(event.target.value)
                      }
                      placeholder="e.g. NOC Night Watch"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <span className="mb-1.5 block font-semibold text-slate-700">
                      Choose Icon
                    </span>
                    <div className="grid grid-cols-6 gap-1.5">
                      {iconOptions.map((option) => (
                        <button
                          key={option.icon}
                          type="button"
                          aria-label={`Select ${option.label.toLowerCase()} icon`}
                          aria-pressed={selectedIcon === option.icon}
                          data-action={`selectShiftIcon('${option.icon}', this)`}
                          className={`flex h-10 cursor-pointer items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                            selectedIcon === option.icon
                              ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/20"
                              : "border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50"
                          }`}
                        >
                          <ShiftIcon
                            icon={option.icon}
                            size={16}
                            className={option.color}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label
                      htmlFor="customShiftStart"
                      className="mb-1.5 block font-semibold text-slate-700"
                    >
                      Start Time
                    </label>
                    <input
                      type="text"
                      id="customShiftStart"
                      value={customShiftStart}
                      onChange={(event) =>
                        setCustomShiftStart(event.target.value)
                      }
                      placeholder="10:00 PM"
                      aria-label="Custom shift start time in 12-hour format"
                      className={`${fieldClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="customShiftEnd"
                      className="mb-1.5 block font-semibold text-slate-700"
                    >
                      End Time
                    </label>
                    <input
                      type="text"
                      id="customShiftEnd"
                      value={customShiftEnd}
                      onChange={(event) =>
                        setCustomShiftEnd(event.target.value)
                      }
                      placeholder="06:00 AM"
                      aria-label="Custom shift end time in 12-hour format"
                      className={`${fieldClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="customBreakDuration"
                      className="mb-1.5 block font-semibold text-slate-700"
                    >
                      Break Duration
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="customBreakDuration"
                        min="0"
                        max="1440"
                        step="1"
                        value={customBreakDuration}
                        onChange={(event) =>
                          setCustomBreakDuration(event.target.value)
                        }
                        placeholder="0"
                        aria-label="Shift break duration in minutes"
                        className={`${fieldClass} pr-12`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                        min
                      </span>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="customBreakType"
                      className="mb-1.5 block font-semibold text-slate-700"
                    >
                      Break Type
                    </label>
                    <select
                      id="customBreakType"
                      value={customBreakType}
                      onChange={(event) =>
                        setCustomBreakType(event.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="">Select type</option>
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      Expected Paid Hours
                    </p>
                    <p className="mt-0.5 text-lg font-bold text-emerald-900">
                      {displayExpectedHours}
                      {displayExpectedHours !== "—" && (
                        <span className="ml-1 text-xs font-semibold">hrs</span>
                      )}
                    </p>
                  </div>
                  <div className="border-t border-emerald-200 pt-2 text-left sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right">
                    <p className="text-[10px] font-semibold text-emerald-700">
                      Configured Daily Wage
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-emerald-900">
                      {hasConfiguredWage
                        ? `₱${configuredWage.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "Not set"}
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <section aria-label="Choose shift template">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-800">
                    Select Shift Template
                  </h4>
                  <span className="text-[10px] font-medium text-slate-400">
                    Choose a template for the selected dates
                  </span>
                </div>
                <div
                  id="shiftTemplatesContainer"
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                >
                  {shiftTemplateCards}
                  <button
                    type="button"
                    data-action="openNewShiftTemplate()"
                    className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center transition hover:border-teal-400 hover:bg-teal-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm">
                      <i className="fa-solid fa-plus" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      New Template
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Configure a custom shift
                    </span>
                  </button>
                </div>
              </section>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="text-[10px] text-slate-500 sm:text-xs">
              {isCustomShiftActive ? (
                <>
                  <span className="font-semibold text-slate-700">
                    {editingShiftTemplateId ? "Editing" : "Creating"}{" "}
                    {customShiftName.trim() || "New Shift"}
                  </span>
                  {displayExpectedHours !== "—" && (
                    <span className="ml-1.5">
                      ({displayExpectedHours}h paid)
                    </span>
                  )}
                  <span className="ml-1.5">
                    for {selectedDayCount} day
                    {selectedDayCount === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-700">
                    {selectedShiftTemplateName || "No shift selected"}
                  </span>
                  {selectedShiftTemplateIsRestDay ? (
                    <span className="ml-1.5">• Rest day</span>
                  ) : selectedShiftTemplateExpectedHours !== null &&
                    selectedShiftTemplateExpectedHours !== undefined ? (
                    <span className="ml-1.5">
                      • {Number(selectedShiftTemplateExpectedHours).toFixed(2)}h
                      {" "}paid
                    </span>
                  ) : null}
                  <span className="ml-1.5">
                    • {selectedDayCount} day
                    {selectedDayCount === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2">
              <button
                type="button"
                data-action="closeModal('assignShiftModal')"
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Cancel
              </button>
              {isCustomShiftActive ? (
                <>
                  <button
                    type="button"
                    data-action="handleSaveCustomShift(event)"
                    className="cursor-pointer rounded-lg border border-teal-200 bg-white px-4 py-2.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    {editingShiftTemplateId ? "Save Changes" : "Save Template"}
                  </button>
                  <button
                    type="button"
                    data-action="handleSaveAndAssignShiftTemplate(event)"
                    className="cursor-pointer rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  >
                    Save &amp; Assign
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  Assign Shift
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
