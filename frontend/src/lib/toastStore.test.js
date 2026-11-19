import assert from "node:assert/strict";
import test from "node:test";
import { createToastStore, toastVariants } from "./toastStore.js";

function createFakeClock() {
  let currentTime = 0;
  let nextTimerId = 1;
  const timers = new Map();

  const setTimeoutFn = (callback, delay = 0) => {
    const id = nextTimerId++;
    timers.set(id, { callback, dueAt: currentTime + delay });
    return id;
  };

  const clearTimeoutFn = (id) => timers.delete(id);

  const advance = (duration) => {
    const targetTime = currentTime + duration;
    while (true) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.dueAt <= targetTime)
        .sort(([, first], [, second]) => first.dueAt - second.dueAt)[0];
      if (!next) break;
      const [id, timer] = next;
      timers.delete(id);
      currentTime = timer.dueAt;
      timer.callback();
    }
    currentTime = targetTime;
  };

  return {
    advance,
    pendingTimerCount: () => timers.size,
    now: () => currentTime,
    setTimeoutFn,
    clearTimeoutFn,
  };
}

function createStore(clock = createFakeClock()) {
  return {
    clock,
    store: createToastStore({
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
      now: clock.now,
    }),
  };
}

test("supports all toast variants and transitions in place", () => {
  const { store } = createStore();
  const handles = toastVariants.map((variant) =>
    store.notify({ variant, title: `${variant} title` }),
  );
  assert.deepEqual(
    store.getSnapshot().map((toast) => toast.variant),
    [...toastVariants].reverse(),
  );

  const loading = store.notify({
    variant: "loading",
    title: "Saving...",
    persistent: true,
  });
  assert.equal(
    store.update(loading.id, {
      variant: "success",
      title: "Saved",
    }),
    true,
  );
  assert.equal(store.getSnapshot()[0].id, loading.id);
  assert.equal(store.getSnapshot()[0].variant, "success");
  assert.equal(
    store.getSnapshot().filter((toast) => toast.id === loading.id).length,
    1,
  );

  const failed = store.notify({
    variant: "loading",
    title: "Loading...",
    persistent: true,
  });
  store.update(failed.id, { variant: "error", title: "Failed" });
  assert.equal(
    store.getSnapshot().find((toast) => toast.id === failed.id).variant,
    "error",
  );
  assert.equal(handles.length, toastVariants.length);
  store.destroy();
});

test("deduplicates notifications and automatically dismisses them", () => {
  const { store, clock } = createStore();
  const original = store.notify({
    variant: "info",
    title: "First",
    dedupeKey: "workspace",
  });
  const replacement = store.notify({
    variant: "sync",
    title: "Updated",
    dedupeKey: "workspace",
  });
  assert.equal(replacement.id, original.id);
  assert.equal(store.getSnapshot().length, 1);
  assert.equal(store.getSnapshot()[0].title, "Updated");

  clock.advance(4499);
  assert.equal(store.getSnapshot()[0].isExiting, false);
  clock.advance(1);
  assert.equal(store.getSnapshot()[0].isExiting, true);
  clock.advance(200);
  assert.equal(store.getSnapshot().length, 0);
  store.destroy();
});

test("pauses countdown on hover, including a loading-to-outcome transition", () => {
  const { store, clock } = createStore();
  const toast = store.notify({
    variant: "info",
    title: "Working",
    duration: 1000,
  });
  clock.advance(300);
  store.pause(toast.id);
  clock.advance(2000);
  assert.equal(store.getSnapshot()[0].isExiting, false);
  store.resume(toast.id);
  clock.advance(699);
  assert.equal(store.getSnapshot()[0].isExiting, false);
  clock.advance(1);
  assert.equal(store.getSnapshot()[0].isExiting, true);

  const transitioning = store.notify({
    variant: "loading",
    title: "Saving...",
    persistent: true,
  });
  store.pause(transitioning.id);
  store.update(transitioning.id, {
    variant: "success",
    title: "Saved",
    duration: 1000,
  });
  clock.advance(2000);
  assert.equal(
    store.getSnapshot().find((item) => item.id === transitioning.id)
      .isExiting,
    false,
  );
  store.resume(transitioning.id);
  clock.advance(1000);
  assert.equal(
    store.getSnapshot().find((item) => item.id === transitioning.id)
      .isExiting,
    true,
  );
  store.destroy();
});

test("keeps persistent notifications and dismisses only the newest toast", () => {
  const { store, clock } = createStore();
  const older = store.notify({
    variant: "loading",
    title: "Loading",
    persistent: true,
  });
  clock.advance(20_000);
  assert.equal(store.getSnapshot().find((toast) => toast.id === older.id).isExiting, false);

  const newer = store.notify({
    variant: "success",
    title: "Complete",
    duration: 10_000,
  });
  assert.equal(store.dismissNewest(), true);
  assert.equal(store.getSnapshot().find((toast) => toast.id === newer.id).isExiting, true);
  clock.advance(200);
  assert.deepEqual(
    store.getSnapshot().map((toast) => toast.id),
    [older.id],
  );
  store.destroy();
});

test("supports adding and removing a toast action during transitions", () => {
  const { store } = createStore();
  const toast = store.notify({
    variant: "loading",
    title: "Saving",
    persistent: true,
  });
  const undo = () => true;
  store.update(toast.id, {
    variant: "success",
    title: "Saved",
    actionLabel: "Undo",
    onAction: undo,
  });

  const completed = store.getSnapshot()[0];
  assert.equal(completed.actionLabel, "Undo");
  assert.equal(completed.onAction, undo);

  store.update(toast.id, {
    variant: "loading",
    actionLabel: "",
    onAction: null,
    persistent: true,
  });
  const reverting = store.getSnapshot()[0];
  assert.equal(reverting.actionLabel, "");
  assert.equal(reverting.onAction, undefined);
  store.destroy();
});

test("cleans up dismissal and exit timers when destroyed", () => {
  const clock = createFakeClock();
  const { store } = createStore(clock);
  const toast = store.notify({ variant: "info", title: "Temporary" });
  store.dismiss(toast.id);
  assert.ok(clock.pendingTimerCount() > 0);

  store.destroy();
  assert.equal(clock.pendingTimerCount(), 0);
  assert.equal(
    store.notify({ variant: "success", title: "Ignored" }),
    null,
  );
});
