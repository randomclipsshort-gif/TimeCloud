export const CALENDAR_DRAG_THRESHOLD = 6;

export function isValidCalendarDateKey(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return false;
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeDateRange(firstDate, lastDate) {
  if (
    !isValidCalendarDateKey(firstDate) ||
    !isValidCalendarDateKey(lastDate)
  ) {
    return null;
  }
  const startDate = firstDate <= lastDate ? firstDate : lastDate;
  const endDate = firstDate <= lastDate ? lastDate : firstDate;
  return {
    startDate,
    endDate,
    dayCount: getInclusiveDateKeys(startDate, endDate).length,
  };
}

export function getInclusiveDateKeys(startDate, endDate) {
  if (
    !isValidCalendarDateKey(startDate) ||
    !isValidCalendarDateKey(endDate) ||
    startDate > endDate
  ) {
    return [];
  }
  const [year, month, day] = startDate.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  const dates = [];
  while (cursor.toISOString().slice(0, 10) <= endDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function getDateRangePosition(date, range) {
  if (!range || date < range.startDate || date > range.endDate) return null;
  if (range.startDate === range.endDate) return "single";
  if (date === range.startDate) return "start";
  if (date === range.endDate) return "end";
  return "middle";
}

export function createCalendarRangeController(threshold = CALENDAR_DRAG_THRESHOLD) {
  let anchorDate = null;
  let rangeMode = false;
  let activePointer = null;
  let suppressNextClick = false;

  return {
    beginPointer({ date, pointerId, x, y }) {
      if (!isValidCalendarDateKey(date)) return false;
      activePointer = {
        date,
        currentDate: date,
        pointerId,
        originX: x,
        originY: y,
        moved: false,
      };
      suppressNextClick = false;
      return true;
    },
    movePointer({ date, pointerId, x, y }) {
      if (!activePointer || activePointer.pointerId !== pointerId) return null;
      if (isValidCalendarDateKey(date)) activePointer.currentDate = date;
      if (
        !activePointer.moved &&
        Math.hypot(x - activePointer.originX, y - activePointer.originY) >=
          threshold
      ) {
        activePointer.moved = true;
      }
      if (!activePointer.moved) return null;
      return normalizeDateRange(activePointer.date, activePointer.currentDate);
    },
    endPointer(pointerId) {
      if (!activePointer || activePointer.pointerId !== pointerId) return null;
      const completedPointer = activePointer;
      activePointer = null;
      if (!completedPointer.moved) return null;
      suppressNextClick = true;
      return normalizeDateRange(
        completedPointer.date,
        completedPointer.currentDate,
      );
    },
    cancelPointer(pointerId) {
      if (!activePointer || activePointer.pointerId !== pointerId) return false;
      activePointer = null;
      return true;
    },
    click(date, { shiftKey = false } = {}) {
      if (suppressNextClick) {
        suppressNextClick = false;
        return { type: "ignored" };
      }
      if (!isValidCalendarDateKey(date)) return { type: "ignored" };
      if ((shiftKey || rangeMode) && anchorDate) {
        const range = normalizeDateRange(anchorDate, date);
        anchorDate = null;
        rangeMode = false;
        return { type: "range", range };
      }
      anchorDate = date;
      return {
        type: "inspect",
        anchorDate,
        rangeMode,
      };
    },
    setRangeMode(enabled) {
      rangeMode = Boolean(enabled);
      if (!rangeMode) anchorDate = null;
      return { rangeMode, anchorDate };
    },
    getState() {
      return { anchorDate, rangeMode, pointerActive: Boolean(activePointer) };
    },
    completeRange() {
      anchorDate = null;
      rangeMode = false;
      activePointer = null;
    },
    clear() {
      anchorDate = null;
      rangeMode = false;
      activePointer = null;
      suppressNextClick = false;
    },
  };
}
