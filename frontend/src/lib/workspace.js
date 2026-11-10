import { apiRequest } from "./apiClient.js";
import {
  mergeAttendancePunches,
  serializeWorkspaceForCloud,
} from "./privateFinancialData.js";
import { normalizeExpenseRecords } from "../utils/expenseTracker.js";
import { normalizeTravelPlans } from "../utils/travelPlanner.js";

export const emptyWorkspace = {
  attendance: {},
  activeTimeEntry: null,
  holidays: null,
  selectedLocality: "",
  holidayEligibilityConfirmed: false,
  expenses: [],
  travelPlans: [],
  shiftTemplates: null,
  leaveBalances: { VL: 0, SL: 0, EL: 0 },
  settingsBalances: { VL: "0", SL: "0", EL: "0" },
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeWorkspace(data) {
  const source = isObject(data) ? data : {};
  const rawAttendance = isObject(source.attendance) ? source.attendance : {};
  const invalidAttendanceDates = Object.entries(rawAttendance)
    .filter(([, record]) => !isObject(record))
    .map(([date]) => date);
  const rawExpenses = normalizeExpenseRecords(source.expenses);
  const invalidExpenseCount = rawExpenses.filter((expense) => !isObject(expense)).length;
  const expenses = rawExpenses.map((expense) =>
    isObject(expense) ? expense : { invalidStoredValue: expense },
  );
  const rawShiftTemplates = Array.isArray(source.shiftTemplates)
    ? source.shiftTemplates
    : [];
  const rawHolidays = Array.isArray(source.holidays) ? source.holidays : [];
  const shiftTemplates = Array.isArray(source.shiftTemplates)
    ? rawShiftTemplates.map((template) =>
        isObject(template) ? template : { invalidStoredValue: template },
      )
    : null;
  const holidays = Array.isArray(source.holidays)
    ? rawHolidays.map((holiday) =>
        isObject(holiday) ? holiday : { invalidStoredValue: holiday },
      )
    : null;
  const invalidWorkspaceData =
    invalidAttendanceDates.length > 0 ||
    invalidExpenseCount > 0 ||
    rawShiftTemplates.some((template) => !isObject(template)) ||
    rawHolidays.some((holiday) => !isObject(holiday));
  return {
    ...emptyWorkspace,
    ...source,
    workspaceDataWarning: invalidWorkspaceData
      ? "Some malformed cloud workspace records were isolated for safe rendering and preserved. Review the affected data before relying on totals."
      : "",
    attendance: Object.fromEntries(
      Object.entries(rawAttendance).map(([date, record]) => [
        date,
        isObject(record) ? record : { invalidStoredValue: record },
      ]),
    ),
    invalidAttendanceDates,
    activeTimeEntry: isObject(source.activeTimeEntry) ? source.activeTimeEntry : null,
    expenses,
    travelPlans: normalizeTravelPlans(source.travelPlans),
    shiftTemplates,
    holidays,
    leaveBalances: isObject(source.leaveBalances)
      ? { ...emptyWorkspace.leaveBalances, ...source.leaveBalances }
      : emptyWorkspace.leaveBalances,
    settingsBalances: isObject(source.settingsBalances)
      ? { ...emptyWorkspace.settingsBalances, ...source.settingsBalances }
      : emptyWorkspace.settingsBalances,
  };
}

export function resolveOptionalWorkspaceLoads(
  punchSettlement,
  salaryVaultSettlement,
) {
  const punchResult =
    punchSettlement.status === "fulfilled" ? punchSettlement.value : null;
  const punchError =
    punchSettlement.status === "rejected"
      ? punchSettlement.reason
      : punchResult?.error || null;
  const rawPunchRows =
    !punchError && Array.isArray(punchResult?.data) ? punchResult.data : [];
  const punchRows = rawPunchRows.filter(
    (row) =>
      isObject(row) &&
      typeof row.shift_date === "string" &&
      isObject(row.attendance_record),
  );
  const invalidPunchRows = rawPunchRows.length - punchRows.length;
  const attendancePunchLoadError =
    punchError ||
    (invalidPunchRows
      ? new Error("Cloud attendance data contains malformed punch records.")
      : null);
  const salaryVaultResult =
    salaryVaultSettlement.status === "fulfilled"
      ? salaryVaultSettlement.value
      : null;
  const salaryVaultLoadError =
    salaryVaultSettlement.status === "rejected"
      ? salaryVaultSettlement.reason
      : salaryVaultResult?.error || null;
  return {
    punchRows,
    attendancePunchLoadError,
    salaryVault: salaryVaultResult?.data ?? null,
    salaryVaultTableAvailable: true,
    salaryVaultLoadError,
  };
}

export async function loadWorkspace(userId) {
  if (!userId) throw new Error("An authenticated account is required to load workspace data.");
  const [session, loadedWorkspace] = await Promise.all([
    apiRequest("/session"),
    apiRequest(`/workspace?expectedUserId=${encodeURIComponent(userId)}`),
  ]);
  if (session?.user?.id !== userId) {
    throw new Error("The signed-in account changed before workspace data could be loaded.");
  }
  const workspaceResult = {
    data: {
      data: loadedWorkspace.data,
      revision: loadedWorkspace.revision,
    },
    error: null,
  };
  const punchSettlement = loadedWorkspace.attendancePunchLoadError
    ? {
        status: "rejected",
        reason: Object.assign(
          new Error(loadedWorkspace.attendancePunchLoadError.message),
          { code: loadedWorkspace.attendancePunchLoadError.code },
        ),
      }
    : {
        status: "fulfilled",
        value: { data: loadedWorkspace.punchRows, error: null },
      };
  const salaryVaultSettlement = {
    status: "fulfilled",
    value: {
      data: loadedWorkspace.salaryVault,
      error: loadedWorkspace.salaryVaultLoadError
        ? Object.assign(
            new Error(loadedWorkspace.salaryVaultLoadError.message),
            { code: loadedWorkspace.salaryVaultLoadError.code },
          )
        : null,
    },
  };
  const {
    punchRows,
    attendancePunchLoadError,
    salaryVault,
    salaryVaultTableAvailable,
    salaryVaultLoadError,
  } = resolveOptionalWorkspaceLoads(punchSettlement, salaryVaultSettlement);
  const rawWorkspace = workspaceResult.data?.data;
  const workspace = normalizeWorkspace(serializeWorkspaceForCloud(rawWorkspace));
  const sanitizedPunches = punchRows.map((row) => ({
    ...row,
    attendance_record: serializeWorkspaceForCloud({
      attendance_record: row.attendance_record,
    }).attendance_record,
  }));
  const attendance = attendancePunchLoadError
    ? workspace.attendance
    : mergeAttendancePunches(workspace.attendance, sanitizedPunches);
  const { invalidAttendanceDates, workspaceDataWarning, ...normalizedWorkspace } =
    workspace;
  return {
    workspace: {
      ...normalizedWorkspace,
      attendance,
    },
    revision: workspaceResult.data?.revision ?? 0,
    salaryVault,
    salaryVaultTableAvailable,
    salaryVaultLoadError,
    attendancePunchLoadError,
    workspaceDataWarning,
  };
}

export async function savePrivateSalaryVault(record, expectedRevision, expectedUserId) {
  if (!expectedUserId) throw new Error("An authenticated account is required to save the encrypted salary vault.");
  const session = await apiRequest("/session");
  if (session?.user?.id !== expectedUserId) {
    throw new Error("The signed-in account changed before the encrypted salary vault could be saved.");
  }
  const result = await apiRequest("/salary-vault", {
    method: "PUT",
    body: {
      record,
      expectedRevision,
      expectedUserId,
    },
  });
  const revision = Number(result.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("The encrypted salary-vault save returned an invalid revision.");
  }
  return revision;
}

export async function loadPrivateSalaryVault(userId) {
  if (!userId) throw new Error("An authenticated account is required to load the encrypted salary vault.");
  const session = await apiRequest("/session");
  if (session?.user?.id !== userId) {
    throw new Error("The signed-in account changed before the encrypted salary vault could be loaded.");
  }
  return apiRequest(`/salary-vault?expectedUserId=${encodeURIComponent(userId)}`);
}

export async function saveWorkspace(data, expectedRevision, expectedUserId) {
  if (!expectedUserId) throw new Error("An authenticated account is required to save workspace data.");
  const result = await apiRequest("/workspace", {
    method: "PUT",
    body: {
      data: serializeWorkspaceForCloud(data),
      expectedRevision,
      expectedUserId,
    },
  });
  return Number(result.revision);
}

async function callPunchOperation(path, shiftDate, expectedUserId) {
  if (!expectedUserId) throw new Error("An authenticated account is required to record attendance.");
  const result = await apiRequest(path, {
    method: "POST",
    body: { shiftDate, expectedUserId },
  });
  if (!result?.record || !result?.timeAt) {
    throw new Error("The attendance operation returned no saved record.");
  }
  return {
    timeAt: result.timeAt,
    record: result.record,
  };
}

export function clockInForShift(shiftDate, expectedUserId) {
  return callPunchOperation("/punches/clock-in", shiftDate, expectedUserId);
}

export function clockOutForShift(shiftDate, expectedUserId) {
  return callPunchOperation("/punches/clock-out", shiftDate, expectedUserId);
}
