import { supabase } from "./supabase.js";
import {
  extractLegacyPrivateFinancialData,
  mergeAttendancePunches,
  serializeWorkspaceForCloud,
} from "./privateFinancialData.js";

export const emptyWorkspace = {
  attendance: {},
  activeTimeEntry: null,
  holidays: null,
  selectedLocality: "",
  holidayEligibilityConfirmed: false,
  expenses: [],
  shiftTemplates: null,
  leaveBalances: { VL: 0, SL: 0, EL: 0 },
  settingsBalances: { VL: "0", SL: "0", EL: "0" },
  earlyPunchWindowMinutes: 15,
  lateGracePeriodMinutes: 15,
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeWorkspace(data) {
  const source = isObject(data) ? data : {};
  return {
    ...emptyWorkspace,
    ...source,
    attendance: isObject(source.attendance) ? source.attendance : {},
    activeTimeEntry: isObject(source.activeTimeEntry) ? source.activeTimeEntry : null,
    expenses: Array.isArray(source.expenses) ? source.expenses : [],
    shiftTemplates: Array.isArray(source.shiftTemplates) ? source.shiftTemplates : null,
    holidays: Array.isArray(source.holidays) ? source.holidays : null,
    leaveBalances: isObject(source.leaveBalances)
      ? { ...emptyWorkspace.leaveBalances, ...source.leaveBalances }
      : emptyWorkspace.leaveBalances,
    settingsBalances: isObject(source.settingsBalances)
      ? { ...emptyWorkspace.settingsBalances, ...source.settingsBalances }
      : emptyWorkspace.settingsBalances,
  };
}

export async function loadWorkspace(userId) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const [workspaceResult, punchResult, salaryVaultResult] = await Promise.all([
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
      .select("ciphertext, nonce, salt, format_version, key_version, revision, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (workspaceResult.error) throw workspaceResult.error;
  if (punchResult.error) throw punchResult.error;
  const salaryVaultTableAvailable = !(
    salaryVaultResult.error &&
    (salaryVaultResult.error.code === "PGRST205" ||
      salaryVaultResult.error.code === "42P01")
  );
  if (salaryVaultResult.error && salaryVaultTableAvailable) {
    throw salaryVaultResult.error;
  }
  const rawWorkspace = workspaceResult.data?.data;
  const legacyPrivateFinancialData = extractLegacyPrivateFinancialData(
    rawWorkspace,
    punchResult.data,
  );
  const workspace = normalizeWorkspace(serializeWorkspaceForCloud(rawWorkspace));
  const sanitizedPunches = punchResult.data.map((row) => ({
    ...row,
    attendance_record: serializeWorkspaceForCloud({
      attendance_record: row.attendance_record,
    }).attendance_record,
  }));
  const attendance = mergeAttendancePunches(workspace.attendance, sanitizedPunches);
  return {
    workspace: { ...workspace, attendance },
    revision: workspaceResult.data?.revision ?? 0,
    legacyPrivateFinancialData,
    salaryVault: salaryVaultTableAvailable ? salaryVaultResult.data : null,
    salaryVaultTableAvailable,
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
