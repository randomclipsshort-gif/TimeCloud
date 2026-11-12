import assert from "node:assert/strict";
import test from "node:test";
import {
  createCalendarRangeController,
  getDateRangePosition,
  getInclusiveDateKeys,
  normalizeDateRange,
} from "./calendarRange.js";

test("normalizes inclusive ranges and deduplicates dates in either direction", () => {
  const range = normalizeDateRange("2026-11-20", "2026-11-16");
  assert.deepEqual(range, {
    startDate: "2026-11-16",
    endDate: "2026-11-20",
    dayCount: 5,
  });
  assert.deepEqual(getInclusiveDateKeys(range.startDate, range.endDate), [
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
  ]);
});

test("calculates ranges across calendar rows and month boundaries without UTC drift", () => {
  assert.deepEqual(getInclusiveDateKeys("2026-10-30", "2026-11-03"), [
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
  ]);
  assert.equal(getInclusiveDateKeys("2026-11-20", "2026-11-16").length, 0);
  assert.equal(normalizeDateRange("2026-02-30", "2026-03-01"), null);
});

test("range cells have distinct endpoint and middle positions", () => {
  const range = normalizeDateRange("2026-11-16", "2026-11-20");
  assert.equal(getDateRangePosition("2026-11-16", range), "start");
  assert.equal(getDateRangePosition("2026-11-18", range), "middle");
  assert.equal(getDateRangePosition("2026-11-20", range), "end");
  assert.equal(
    getDateRangePosition("2026-11-16", normalizeDateRange("2026-11-16", "2026-11-16")),
    "single",
  );
  assert.equal(getDateRangePosition("2026-11-21", range), null);
});

test("drag requires threshold movement, captures the last hovered date, and suppresses its click", () => {
  const controller = createCalendarRangeController();
  controller.beginPointer({
    date: "2026-11-16",
    pointerId: 7,
    x: 10,
    y: 10,
  });
  assert.equal(
    controller.movePointer({
      date: "2026-11-17",
      pointerId: 7,
      x: 13,
      y: 13,
    }),
    null,
  );
  assert.deepEqual(
    controller.movePointer({
      date: "2026-11-20",
      pointerId: 7,
      x: 18,
      y: 14,
    }),
    {
      startDate: "2026-11-16",
      endDate: "2026-11-20",
      dayCount: 5,
    },
  );
  controller.movePointer({
    date: null,
    pointerId: 7,
    x: 24,
    y: 30,
  });
  assert.deepEqual(controller.endPointer(7), {
    startDate: "2026-11-16",
    endDate: "2026-11-20",
    dayCount: 5,
  });
  assert.deepEqual(controller.click("2026-11-20"), { type: "ignored" });
});

test("reverse drag normalizes the range and pointer cancellation discards it", () => {
  const controller = createCalendarRangeController();
  controller.beginPointer({
    date: "2026-11-20",
    pointerId: 2,
    x: 20,
    y: 20,
  });
  controller.movePointer({
    date: "2026-11-16",
    pointerId: 2,
    x: 40,
    y: 25,
  });
  assert.deepEqual(controller.endPointer(2), {
    startDate: "2026-11-16",
    endDate: "2026-11-20",
    dayCount: 5,
  });

  controller.beginPointer({
    date: "2026-11-16",
    pointerId: 3,
    x: 20,
    y: 20,
  });
  controller.movePointer({
    date: "2026-11-18",
    pointerId: 3,
    x: 40,
    y: 25,
  });
  assert.equal(controller.cancelPointer(3), true);
  assert.equal(controller.endPointer(3), null);
});

test("a stationary pointer does not select a range and shift-click includes both dates", () => {
  const controller = createCalendarRangeController();
  controller.beginPointer({
    date: "2026-11-16",
    pointerId: 4,
    x: 10,
    y: 10,
  });
  assert.equal(controller.endPointer(4), null);
  assert.deepEqual(controller.click("2026-11-16"), {
    type: "inspect",
    anchorDate: "2026-11-16",
    rangeMode: false,
  });
  assert.deepEqual(controller.click("2026-11-20", { shiftKey: true }), {
    type: "range",
    range: {
      startDate: "2026-11-16",
      endDate: "2026-11-20",
      dayCount: 5,
    },
  });
  controller.click("2026-11-20");
  assert.deepEqual(controller.click("2026-11-16", { shiftKey: true }), {
    type: "range",
    range: {
      startDate: "2026-11-16",
      endDate: "2026-11-20",
      dayCount: 5,
    },
  });
});

test("accessible range mode supports two-tap selection and can be cleared", () => {
  const controller = createCalendarRangeController();
  controller.setRangeMode(true);
  assert.equal(controller.click("2026-11-16").type, "inspect");
  assert.deepEqual(controller.click("2026-11-20"), {
    type: "range",
    range: {
      startDate: "2026-11-16",
      endDate: "2026-11-20",
      dayCount: 5,
    },
  });
  controller.setRangeMode(true);
  controller.click("2026-11-16");
  controller.clear();
  assert.deepEqual(controller.getState(), {
    anchorDate: null,
    rangeMode: false,
    pointerActive: false,
  });
});
