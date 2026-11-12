export default function CalendarRangeActionsModal({
  open,
  range,
  onAssignShift,
  onClearShifts,
  onManualEntry,
}) {
  const dayCount = range?.dayCount || 0;
  const dayLabel = `${dayCount} ${dayCount === 1 ? "day" : "days"} selected`;

  return (
    <div
      id="calendarRangeActionsModal"
      className="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-labelledby="calendarRangeActionsTitle"
      aria-describedby="calendarRangeActionsDescription"
      style={{ display: open ? "flex" : "none" }}
    >
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-cardBg p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
              Range actions
            </p>
            <h3
              id="calendarRangeActionsTitle"
              className="text-xl font-bold tracking-tight text-textMain"
            >
              Choose an action
            </h3>
            <p
              id="calendarRangeActionsDescription"
              className="mt-1 text-sm text-slate-500"
            >
              What would you like to do with these dates?
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel range selection"
            data-action="closeModal(&#x27;calendarRangeActionsModal&#x27;)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm">
            <i className="fa-regular fa-calendar-days text-lg" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              {range?.startDate} <span className="text-slate-400">to</span>{" "}
              {range?.endDate}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{dayLabel}</p>
          </div>
          <i
            className="fa-solid fa-check text-sm text-teal-600"
            aria-hidden="true"
          />
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={onAssignShift}
            className="group flex min-h-[76px] items-center gap-4 rounded-2xl border border-teal-200 bg-teal-50/80 p-4 text-left transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm transition group-hover:bg-teal-100">
              <i className="fa-regular fa-calendar-plus text-lg" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-teal-950">
                Assign a shift
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-teal-800">
                Apply a saved or custom shift to every selected date.
              </span>
            </span>
            <i
              className="fa-solid fa-chevron-right text-xs text-teal-600 transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={onManualEntry}
            className="group flex min-h-[76px] items-center gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm transition group-hover:bg-indigo-100">
              <i className="fa-solid fa-pen-to-square text-lg" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-indigo-950">
                Add manual attendance
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-indigo-800">
                Enter the same attendance details for each selected date.
              </span>
            </span>
            <i
              className="fa-solid fa-chevron-right text-xs text-indigo-600 transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={onClearShifts}
            className="group flex min-h-[76px] items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-left transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-rose-700 shadow-sm transition group-hover:bg-rose-100">
              <i className="fa-regular fa-circle-xmark text-lg" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-rose-950">
                  Clear shift &amp; attendance
                </span>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700">
                  Destructive
                </span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-rose-800">
                Remove records; leave credits are restored.
              </span>
            </span>
            <i
              className="fa-solid fa-chevron-right text-xs text-rose-600 transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </div>

        <button
          type="button"
          data-action="closeModal(&#x27;calendarRangeActionsModal&#x27;)"
          className="mt-5 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
