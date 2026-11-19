import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import ToastContainer from "./ToastContainer.jsx";
import { createToastStore } from "../../lib/toastStore.js";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [store] = useState(() => createToastStore());
  const toasts = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const cleanupTimerRef = useRef(null);

  useEffect(() => {
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || !store.dismissNewest()) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      cleanupTimerRef.current = window.setTimeout(() => {
        store.destroy();
        cleanupTimerRef.current = null;
      }, 0);
    };
  }, [store]);

  const value = useMemo(
    () => ({
      notify: store.notify,
      update: store.update,
      dismiss: store.dismiss,
      dismissAll: store.dismissAll,
    }),
    [store],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} store={store} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return context;
}
