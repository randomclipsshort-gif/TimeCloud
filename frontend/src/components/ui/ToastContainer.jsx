import {
  AlertTriangle,
  Check,
  CircleAlert,
  Info,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";

const variantStyles = {
  loading: {
    icon: "bg-slate-100 text-slate-800",
    progress: "bg-slate-800",
    Icon: LoaderCircle,
    spin: true,
  },
  success: {
    icon: "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-500/20",
    progress: "bg-emerald-500",
    Icon: Check,
  },
  info: {
    icon: "bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-500/20",
    progress: "bg-indigo-500",
    Icon: Info,
  },
  sync: {
    icon: "bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-500/20",
    progress: "bg-sky-500",
    Icon: RefreshCw,
  },
  warning: {
    icon: "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-500/25",
    progress: "bg-amber-500",
    Icon: AlertTriangle,
  },
  error: {
    icon: "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-500/25",
    progress: "bg-rose-500",
    Icon: CircleAlert,
  },
};

function ToastCard({ toast, store }) {
  const style = variantStyles[toast.variant] || variantStyles.info;
  const Icon = style.Icon;
  const isUrgent = toast.variant === "warning" || toast.variant === "error";
  const handleAction = async () => {
    try {
      const result = await toast.onAction?.();
      if (result !== false) store.dismiss(toast.id);
    } catch {
      store.update(toast.id, {
        variant: "error",
        title: toast.actionLabel
          ? `${toast.actionLabel} failed`
          : "Notification action failed",
        description: "",
      });
    }
  };

  return (
    <article
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={() => store.pause(toast.id)}
      onMouseLeave={() => store.resume(toast.id)}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-toast backdrop-blur-md transition-shadow duration-200 hover:shadow-toast-hover ${
        toast.isExiting ? "toast-exit-top" : "toast-enter-top"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          key={`icon-${toast.revision}`}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.icon} ${
            toast.revision > 1 ? "toast-icon-morph" : ""
          }`}
        >
          <Icon
            size={16}
            className={style.spin ? "spinner-ring" : ""}
            aria-hidden="true"
          />
        </div>
        <div
          key={`content-${toast.revision}`}
          className={`min-w-0 flex-1 ${
            toast.revision > 1 ? "toast-content-morph" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            {toast.title ? (
              <p className="text-sm font-semibold leading-snug text-slate-900">
                {toast.title}
              </p>
            ) : (
              <span />
            )}
            {toast.isPaused && toast.autoDismiss && !toast.persistent && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Paused
              </span>
            )}
          </div>
          {toast.description && (
            <p className="mt-1 break-words text-xs leading-relaxed text-slate-500">
              {toast.description}
            </p>
          )}
          {toast.actionLabel && (
            <button
              type="button"
              onClick={handleAction}
              className="mt-2.5 inline-flex items-center gap-1 rounded text-xs font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-700 hover:decoration-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
            >
              {toast.actionLabel}
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          data-toast-close
          aria-label="Dismiss notification"
          onClick={() => store.dismiss(toast.id)}
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {toast.autoDismiss && !toast.persistent && (
        <div className="h-[3px] w-full overflow-hidden bg-slate-100" aria-hidden="true">
          <div
            key={`progress-${toast.revision}`}
            className={`toast-countdown h-full w-full origin-left ${style.progress}`}
            style={{
              animationDuration: `${toast.durationMs}ms`,
              animationPlayState: toast.isPaused ? "paused" : "running",
            }}
          />
        </div>
      )}
    </article>
  );
}

export default function ToastContainer({ toasts, store }) {
  return (
    <div
      id="toastContainer"
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed right-3 top-3 z-[120] flex max-h-[calc(100dvh-1.5rem)] w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto sm:right-5 sm:top-5"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} store={store} />
      ))}
    </div>
  );
}
