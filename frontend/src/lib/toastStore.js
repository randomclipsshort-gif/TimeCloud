export const toastVariants = [
  "loading",
  "success",
  "info",
  "sync",
  "warning",
  "error",
];

const defaultDuration = 4500;
const exitDuration = 200;

function isValidDuration(value) {
  return Number.isFinite(value) && value >= 0;
}

function normalizeText(value, fallback = "") {
  return value == null ? fallback : String(value);
}

function createToastRecord(options, id, previous = null) {
  const variant = toastVariants.includes(options.variant)
    ? options.variant
    : previous?.variant || "info";
  const persistent =
    options.persistent ??
    (options.variant ? variant === "loading" : previous?.persistent || false);
  const autoDismiss = options.autoDismiss ?? !persistent;
  const durationOption = options.duration ?? options.durationMs;
  const durationMs = isValidDuration(durationOption)
    ? durationOption
    : previous?.durationMs ?? defaultDuration;

  return {
    id,
    variant,
    title:
      options.title === undefined
        ? previous?.title || ""
        : normalizeText(options.title),
    description:
      options.description === undefined
        ? options.message === undefined
          ? previous?.description || ""
          : normalizeText(options.message)
        : normalizeText(options.description),
    actionLabel:
      options.actionLabel === undefined
        ? previous?.actionLabel || ""
        : normalizeText(options.actionLabel),
    onAction:
      options.onAction === undefined
        ? previous?.onAction
        : typeof options.onAction === "function"
          ? options.onAction
          : undefined,
    persistent,
    autoDismiss,
    durationMs,
    pauseOnHover: options.pauseOnHover ?? previous?.pauseOnHover ?? true,
    dedupeKey:
      options.dedupeKey === undefined
        ? previous?.dedupeKey
        : options.dedupeKey,
    isPaused: previous?.isPaused || false,
    isExiting: false,
    revision: (previous?.revision || 0) + 1,
  };
}

export function createToastStore({
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  now = () => Date.now(),
} = {}) {
  let toasts = [];
  let nextId = 1;
  let destroyed = false;
  const listeners = new Set();
  const dismissalTimers = new Map();
  const exitTimers = new Map();

  const publish = () => {
    if (destroyed) return;
    for (const listener of listeners) listener();
  };

  const getToast = (id) => toasts.find((toast) => toast.id === id);

  const clearDismissalTimer = (id) => {
    const timer = dismissalTimers.get(id);
    if (timer?.timeout !== null && timer?.timeout !== undefined) {
      clearTimeoutFn(timer.timeout);
    }
    dismissalTimers.delete(id);
  };

  const scheduleDismissal = (toast, remaining = toast.durationMs) => {
    clearDismissalTimer(toast.id);
    if (
      !toast.autoDismiss ||
      toast.persistent ||
      toast.isPaused ||
      toast.isExiting
    ) {
      return;
    }

    const timer = {
      timeout: null,
      startedAt: now(),
      remaining,
    };
    timer.timeout = setTimeoutFn(() => {
      dismissalTimers.delete(toast.id);
      dismiss(toast.id);
    }, remaining);
    dismissalTimers.set(toast.id, timer);
  };

  const handleFor = (id) => ({
    id,
    update: (options) => update(id, options),
    dismiss: () => dismiss(id),
  });

  const dismiss = (id) => {
    const toast = getToast(id);
    if (!toast || toast.isExiting) return false;

    clearDismissalTimer(id);
    toasts = toasts.map((item) =>
      item.id === id ? { ...item, isPaused: false, isExiting: true } : item,
    );
    publish();
    exitTimers.set(
      id,
      setTimeoutFn(() => {
        exitTimers.delete(id);
        toasts = toasts.filter((item) => item.id !== id);
        publish();
      }, exitDuration),
    );
    return true;
  };

  const update = (id, options = {}) => {
    const previous = getToast(id);
    if (!previous || previous.isExiting || destroyed) return false;

    const previousTimer = dismissalTimers.get(id);
    clearDismissalTimer(id);
    const updated = createToastRecord(
      {
        ...options,
        variant: options.variant ?? previous.variant,
      },
      id,
      previous,
    );
    toasts = toasts.map((toast) => (toast.id === id ? updated : toast));
    publish();
    if (updated.isPaused && updated.autoDismiss && !updated.persistent) {
      dismissalTimers.set(id, {
        timeout: null,
        startedAt: now(),
        remaining: previousTimer?.remaining ?? updated.durationMs,
      });
    } else {
      scheduleDismissal(updated);
    }
    return true;
  };

  const notify = (options = {}) => {
    if (destroyed) return null;
    if (options.dedupeKey) {
      const existing = toasts.find(
        (toast) =>
          toast.dedupeKey === options.dedupeKey && !toast.isExiting,
      );
      if (existing) {
        update(existing.id, options);
        return handleFor(existing.id);
      }
    }

    const id = `toast-${nextId++}`;
    const toast = createToastRecord(options, id);
    toasts = [toast, ...toasts];
    publish();
    scheduleDismissal(toast);
    return handleFor(id);
  };

  const pause = (id) => {
    const toast = getToast(id);
    const timer = dismissalTimers.get(id);
    if (!toast || toast.isPaused || !toast.pauseOnHover) return;

    if (timer?.timeout !== null && timer?.timeout !== undefined) {
      clearTimeoutFn(timer.timeout);
      timer.timeout = null;
      timer.remaining = Math.max(
        0,
        timer.remaining - (now() - timer.startedAt),
      );
    }
    toasts = toasts.map((item) =>
      item.id === id ? { ...item, isPaused: true } : item,
    );
    publish();
  };

  const resume = (id) => {
    const toast = getToast(id);
    if (!toast || !toast.isPaused) return;
    const timer = dismissalTimers.get(id);
    if (!timer) {
      const resumed = { ...toast, isPaused: false };
      toasts = toasts.map((item) => (item.id === id ? resumed : item));
      publish();
      scheduleDismissal(resumed);
      return;
    }
    if (timer.remaining <= 0) {
      dismiss(id);
      return;
    }

    timer.startedAt = now();
    timer.timeout = setTimeoutFn(() => {
      dismissalTimers.delete(id);
      dismiss(id);
    }, timer.remaining);
    toasts = toasts.map((item) =>
      item.id === id ? { ...item, isPaused: false } : item,
    );
    publish();
  };

  const dismissNewest = () => {
    const newest = toasts.find((toast) => !toast.isExiting);
    return newest ? dismiss(newest.id) : false;
  };

  const dismissAll = () => {
    for (const toast of toasts) dismiss(toast.id);
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    for (const timer of dismissalTimers.values()) {
      if (timer.timeout !== null) clearTimeoutFn(timer.timeout);
    }
    for (const timer of exitTimers.values()) clearTimeoutFn(timer);
    dismissalTimers.clear();
    exitTimers.clear();
    listeners.clear();
  };

  return {
    notify,
    update,
    dismiss,
    dismissNewest,
    dismissAll,
    pause,
    resume,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return toasts;
    },
    destroy,
  };
}
