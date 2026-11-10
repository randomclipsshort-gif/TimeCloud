import { supabase } from "./supabase.js";
import {
  extractLegacyPrivateFinancialData,
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
  const salaryVaultTableAvailable = !(
    salaryVaultLoadError &&
    (salaryVaultLoadError.code === "PGRST205" ||
      salaryVaultLoadError.code === "42P01")
  );

  return {
    punchRows,
    attendancePunchLoadError,
    salaryVault:
      salaryVaultTableAvailable ? salaryVaultResult?.data ?? null : null,
    salaryVaultTableAvailable,
    salaryVaultLoadError: salaryVaultTableAvailable
      ? salaryVaultLoadError
      : null,
  };
}

export async function loadWorkspace(userId) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const [workspaceSettlement, punchSettlement, salaryVaultSettlement] =
    await Promise.allSettled([
      supabase
        .from("user_workspaces")
        .select("data, revision")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("attendance_punches")
        .select("shift_date, attendance_record")
        .eq("user_id", userId),
      supabase
        .from("private_salary_vault")
        .select(
          "ciphertext, nonce, salt, format_version, key_version, revision, updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  if (workspaceSettlement.status === "rejected") {
    throw workspaceSettlement.reason;
  }
  const workspaceResult = workspaceSettlement.value;
  if (workspaceResult.error) throw workspaceResult.error;
  const {
    punchRows,
    attendancePunchLoadError,
    salaryVault,
    salaryVaultTableAvailable,
    salaryVaultLoadError,
  } = resolveOptionalWorkspaceLoads(punchSettlement, salaryVaultSettlement);
  const rawWorkspace = workspaceResult.data?.data;
  const legacyPrivateFinancialData = extractLegacyPrivateFinancialData(
    rawWorkspace,
    punchRows,
  );
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
    legacyPrivateFinancialData,
    salaryVault,
    salaryVaultTableAvailable,
    salaryVaultLoadError,
    attendancePunchLoadError,
    workspaceDataWarning,
  };
}

export async function savePrivateSalaryVault(record, expectedRevision, expectedUserId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!expectedUserId) throw new Error("An authenticated account is required to save the encrypted salary vault.");
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (session?.user.id !== expectedUserId) {
    throw new Error("The signed-in account changed before the encrypted salary vault could be saved.");
  }
  const { data: savedRevision, error } = await supabase.rpc("save_private_salary_vault", {
    p_ciphertext: record.ciphertext,
    p_nonce: record.nonce,
    p_salt: record.salt,
    p_format_version: record.format_version,
    p_key_version: record.key_version,
    p_expected_revision: expectedRevision,
  });
  if (error) throw error;
  const revision = Number(savedRevision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("The encrypted salary-vault save returned an invalid revision.");
  }
  return revision;
}

export async function loadPrivateSalaryVault(userId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("private_salary_vault")
    .select("ciphertext, nonce, salt, format_version, key_version, revision, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveWorkspace(data, expectedRevision) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: savedRevision, error } = await supabase.rpc("save_user_workspace", {
    p_data: serializeWorkspaceForCloud(data),
    p_expected_revision: expectedRevision,
  });

  if (error) throw error;
  return Number(savedRevision);
}

async function callPunchOperation(functionName, parameters) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc(functionName, parameters);
  if (error) throw error;
  if (!Array.isArray(data) || !data[0]?.attendance_record || !data[0]?.time_at) {
    throw new Error("The attendance operation returned no saved record.");
  }
  return {
    timeAt: data[0].time_at,
    record: data[0].attendance_record,
  };
}

export function clockInForShift(shiftDate, record) {
  return callPunchOperation("clock_in_for_shift", {
    p_shift_date: shiftDate,
    p_record: serializeWorkspaceForCloud({ attendance: { record } }).attendance.record,
  });
}

export function clockOutForShift(shiftDate) {
  return callPunchOperation("clock_out_for_shift", {
    p_shift_date: shiftDate,
  });
}
