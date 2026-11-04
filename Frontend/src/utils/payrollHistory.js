import {
  getCalendarPayrollPeriod,
  getPayrollPeriodForEndDate,
} from "./payrollPeriods.js";

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
