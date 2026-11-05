export default function ConfirmationDialog({ options, onResolve }) {
  if (!options) return null;

  const isDanger = options.variant === "danger";
  const iconClass = isDanger
    ? "fa-triangle-exclamation"
    : "fa-circle-question";
  const iconStyle = isDanger
    ? "bg-rose-50 text-rose-600"
    : "bg-teal-50 text-teal-600";
  const confirmStyle = isDanger
    ? "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500"
    : "bg-teal-600 text-white hover:bg-teal-700 focus-visible:ring-teal-500";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onResolve(false);
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-message"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="p-5 sm:p-6">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconStyle}`}>
            <i className={`fa-solid ${iconClass} text-lg`} aria-hidden="true"></i>
          </div>
          <h2
            id="confirmation-dialog-title"
            className="mt-4 text-base font-bold text-slate-900"
          >
            {options.title}
          </h2>
          <p
            id="confirmation-dialog-message"
            className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600"
          >
            {options.message}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            autoFocus
            onClick={() => onResolve(false)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            {options.cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${confirmStyle}`}
          >
            {options.confirmLabel || "Continue"}
          </button>
        </div>
      </section>
    </div>
  );
}
