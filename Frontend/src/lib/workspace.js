import { supabase } from "./supabase.js";

export const emptyWorkspace = {
  attendance: {},
  activeTimeEntry: null,
  holidays: null,
  selectedLocality: "",
  holidayEligibilityConfirmed: false,
  dailyWage: "",
  dailyAllowance: "0",
  overtimeMultiplier: "1.25",
  expenses: [],
  shiftTemplates: null,
  leaveBalances: { VL: 0, SL: 0, EL: 0 },
  settingsBalances: { VL: "0", SL: "0", EL: "0" },
  nightDifferential: "10",
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

  const [workspaceResult, punchResult] = await Promise.all([
    supabase
      .from("user_workspaces")
      .select("data, revision")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("attendance_punches")
      .select("shift_date, attendance_record")
      .eq("user_id", userId),
  ]);

  if (workspaceResult.error) throw workspaceResult.error;
  if (punchResult.error) throw punchResult.error;
  const workspace = normalizeWorkspace(workspaceResult.data?.data);
  const attendance = { ...workspace.attendance };
  punchResult.data.forEach(({ shift_date: shiftDate, attendance_record: attendanceRecord }) => {
    attendance[shiftDate] = attendanceRecord;
  });
  return {
    workspace: { ...workspace, attendance },
    revision: workspaceResult.data?.revision ?? 0,
  };
}

export async function saveWorkspace(data, expectedRevision) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: savedRevision, error } = await supabase.rpc("save_user_workspace", {
    p_data: data,
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
    p_record: record,
  });
}

export function clockOutForShift(shiftDate) {
  return callPunchOperation("clock_out_for_shift", {
    p_shift_date: shiftDate,
  });
}
