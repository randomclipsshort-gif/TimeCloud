import {
  getCalendarPayrollPeriod,
  getNextPayrollPeriod,
  getPayrollPeriodForEndDate,
} from "./payrollPeriods.js";

export function getUpcomingPayslipPeriods(
  currentPeriod,
  history,
  employeeId,
  count = 2,
) {
  if (
    !currentPeriod ||
    !Array.isArray(history) ||
    !Number.isInteger(count) ||
    count < 1
  ) {
    return [];
  }

  const savedPeriodKeys = new Set(
    history
      .filter(
        (snapshot) =>
          typeof employeeId === "string" &&
          employeeId &&
          snapshot?.employeeId === employeeId,
      )
      .map(
        (snapshot) =>
          `${snapshot?.period?.startDate}:${snapshot?.period?.endDate}`,
      ),
  );
  const periods = [];
  let period = currentPeriod;

  while (period && periods.length < count) {
    const periodKey = `${period.startDate}:${period.endDate}`;
    if (!savedPeriodKeys.has(periodKey)) {
      periods.push({
        period,
        isCurrent:
          period.startDate === currentPeriod.startDate &&
          period.endDate === currentPeriod.endDate,
      });
    }
    period = getNextPayrollPeriod(period);
  }

  return periods;
}

export function getPayslipPeriodsThroughYearEnd(currentPeriod, year) {
  if (!currentPeriod || !Number.isInteger(year)) return [];

  const yearKey = String(year);
  const periods = [];
  let period = currentPeriod;
  while (period?.endDate?.startsWith(yearKey)) {
    periods.push({
      period,
      isCurrent:
        period.startDate === currentPeriod.startDate &&
        period.endDate === currentPeriod.endDate,
    });
    period = getNextPayrollPeriod(period);
  }

  return periods;
}

export function getPayslipDirectoryPeriods({
  currentPeriod,
  activePeriods,
  payrollPeriods,
  payslipHistory,
}) {
  const getPeriodKey = (period) => `${period.startDate}:${period.endDate}`;
  const currentPeriodKey = getPeriodKey(currentPeriod);
  const payrollPeriodsByKey = new Map(
    payrollPeriods
      .filter((item) => item?.period?.startDate && item?.period?.endDate)
      .map((item) => [getPeriodKey(item.period), item]),
  );
  const directoryPeriods = activePeriods
    .filter((item) => item?.period?.startDate && item?.period?.endDate)
    .map((item) => ({
      ...(payrollPeriodsByKey.get(getPeriodKey(item.period)) || {}),
      ...item,
      isCurrent: getPeriodKey(item.period) === currentPeriodKey,
      isFuture: item.period.endDate > currentPeriod.endDate,
    }));

  if (
    !directoryPeriods.some(
      (item) => getPeriodKey(item.period) === currentPeriodKey,
    )
  ) {
    directoryPeriods.unshift({
      ...(payrollPeriodsByKey.get(currentPeriodKey) || {}),
      period: currentPeriod,
      isCurrent: true,
      isFuture: false,
    });
  }

  const includedPeriods = new Set(
    directoryPeriods.map((item) => getPeriodKey(item.period)),
  );
  for (const snapshot of payslipHistory) {
    if (!snapshot?.period?.startDate || !snapshot?.period?.endDate) continue;
    const periodKey = getPeriodKey(snapshot.period);
    if (includedPeriods.has(periodKey)) continue;

    directoryPeriods.push({
      period: snapshot.period,
      isCurrent: periodKey === currentPeriodKey,
      isFuture: snapshot.period.endDate > currentPeriod.endDate,
    });
    includedPeriods.add(periodKey);
  }

  return directoryPeriods;
}

export function isValidPayslipSnapshot(snapshot) {
  const expectedPeriod = getPayrollPeriodForEndDate(snapshot?.period?.endDate);
  const expectedCalendarPeriod = snapshot?.period?.endDate
    ? getCalendarPayrollPeriod(snapshot.period.endDate.slice(0, 7))
    : null;
  const isValidPeriod = Boolean(
    (expectedPeriod &&
      snapshot.period.startDate === expectedPeriod.startDate &&
      snapshot.period.endDate === expectedPeriod.endDate) ||
    (expectedCalendarPeriod &&
      snapshot.period.startDate === expectedCalendarPeriod.startDate &&
      snapshot.period.endDate === expectedCalendarPeriod.endDate)
  );
  return Boolean(
    snapshot &&
    typeof snapshot.employeeId === "string" &&
    snapshot.employeeId.length > 0 &&
    typeof snapshot.employeeName === "string" &&
    isValidPeriod &&
    typeof snapshot.generatedAt === "string" &&
    Number.isFinite(Date.parse(snapshot.generatedAt)) &&
    Number.isFinite(snapshot.summary?.recordedEarnings) &&
    Number.isFinite(snapshot.summary?.regularHours) &&
    Number.isFinite(snapshot.summary?.overtimeHours) &&
    Array.isArray(snapshot.earningsBreakdown?.items) &&
    Array.isArray(snapshot.deductions?.items) &&
    Number.isFinite(snapshot.deductions?.total) &&
    Number.isFinite(snapshot.deductions?.employeeContributionTotal) &&
    Number.isFinite(snapshot.netPay) &&
    snapshot.settings !== null &&
    typeof snapshot.settings === "object" &&
    !Array.isArray(snapshot.settings)
  );
}

export function createPayslipSnapshot({
  employeeId,
  employeeName,
  period,
  generatedAt = new Date().toISOString(),
  summary,
  earningsBreakdown,
  deductions,
  netPay,
  settings,
}) {
  const snapshot = {
    id: `${employeeId}:${period?.startDate}:${period?.endDate}`,
    employeeId,
    employeeName,
    period: { ...period },
    generatedAt,
    summary: structuredClone(summary),
    earningsBreakdown: structuredClone(earningsBreakdown),
    deductions: structuredClone(deductions),
    netPay,
    settings: structuredClone(settings),
  };
  if (!isValidPayslipSnapshot(snapshot)) {
    throw new Error("The payslip snapshot contains invalid payroll data.");
  }
  return snapshot;
}

export function appendPayslipSnapshot(history, snapshot) {
  if (!Array.isArray(history) || !isValidPayslipSnapshot(snapshot)) {
    throw new Error("The payslip history is invalid.");
  }
  const duplicate = history.some((existing) =>
    existing.employeeId === snapshot.employeeId &&
    existing.period.startDate === snapshot.period.startDate &&
    existing.period.endDate === snapshot.period.endDate,
  );
  if (duplicate) {
    throw new Error("A payslip snapshot already exists for this employee and payroll period.");
  }
  return [...history, snapshot].sort((left, right) =>
    left.period.endDate.localeCompare(right.period.endDate),
  );
}

export function removePayslipSnapshot(history, snapshotId) {
  if (!Array.isArray(history) || typeof snapshotId !== "string" || !snapshotId) {
    throw new Error("The payslip history is invalid.");
  }
  const nextHistory = history.filter((snapshot) => snapshot.id !== snapshotId);
  if (nextHistory.length === history.length) {
    throw new Error("The saved payslip could not be found.");
  }
  return nextHistory;
}

export function findPayslipSnapshot(history, employeeId, period) {
  if (!Array.isArray(history) || !period) return null;
  return history.find((snapshot) =>
    snapshot.employeeId === employeeId &&
    snapshot.period.startDate === period.startDate &&
    snapshot.period.endDate === period.endDate,
  ) || null;
}
