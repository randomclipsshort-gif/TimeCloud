const toastStyles = {
  success: "bg-emerald-600 text-white",
  info: "bg-teal-700 text-white",
  warning: "bg-amber-600 text-white",
  error: "bg-rose-600 text-white",
};

export default function ToastContainer({ toasts, dismissToast }) {
  return (
    <div id="toastContainer" aria-live="polite" className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex items-center space-x-2 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold ${toastStyles[toast.type] || toastStyles.success}`}
        >
          <span>{toast.message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)} className="ml-2 opacity-80 hover:opacity-100">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      ))}
    </div>
  );
}
