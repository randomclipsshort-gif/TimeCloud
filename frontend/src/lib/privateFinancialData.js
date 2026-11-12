const privateSettingsDefaults = {
  dailyWage: "",
  dailyAllowance: "0",
  overtimeMultiplier: "1.25",
  nightDifferential: "10",
  payrollSettingsHistory: [],
  payrollDeductionMode: "automatic",
  manualSssPerPaycheck: "0",
  manualPhilHealthPerPaycheck: "0",
  manualPagIbigPerPaycheck: "0",
};

const privateSettingKeys = Object.keys(privateSettingsDefaults);
const privateAttendanceKeys = [
  "base",
  "wageRate",
  "ot",
  "penalty",
  "est",
  "overtimeAmount",
];
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPrivateFinancialKey(key) {
  return privateSettingKeys.includes(key) ||
    privateAttendanceKeys.includes(key) ||
    /^(sss|philhealth|pagibig)(frequency|monthlycutoff|firstcutoffamount|secondcutoffamount)$/i.test(key) ||
    /(salary|wage|pay|earning|compensation|rate|bonus|commission|incentive|income|gross|deduction|tax|payroll|allowance|night.?differential|overtime.?multiplier|overtime.?amount|^(base|ot|penalty|est)$)/i.test(key);
}

function pickPrivateFinancialKeys(value) {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => isPrivateFinancialKey(key)));
}

function stripPrivateFinancialKeys(value) {
  if (Array.isArray(value)) return value.map(stripPrivateFinancialKeys);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isPrivateFinancialKey(key))
    .map(([key, nestedValue]) => [key, stripPrivateFinancialKeys(nestedValue)]));
}

function getPrivateAttendance(attendance) {
  return Object.fromEntries(Object.entries(isObject(attendance) ? attendance : {})
    .map(([date, record]) => [date, pickPrivateFinancialKeys(record)])
    .filter(([, values]) => Object.keys(values).length > 0));
}

export function serializeWorkspaceForCloud(workspace) {
  const source = isObject(workspace) ? workspace : {};
  return stripPrivateFinancialKeys(source);
}

export function mergeLocalPrivateAttendance(attendance, privateAttendance) {
  const source = isObject(attendance) ? attendance : {};
  const privateRecords = isObject(privateAttendance) ? privateAttendance : {};
  const dates = new Set([...Object.keys(source), ...Object.keys(privateRecords)]);
  return Object.fromEntries([...dates].map((date) => [
    date,
    {
      ...(isObject(source[date]) ? source[date] : {}),
      ...pickPrivateFinancialKeys(privateRecords[date]),
    },
  ]));
}

export function mergeLocalPrivateAttendanceRecord(record, privateRecord) {
  return {
    ...record,
    ...pickPrivateFinancialKeys(privateRecord),
  };
}

export function extractPrivateFinancialSettings(settings) {
  return {
    ...privateSettingsDefaults,
    ...pickPrivateFinancialKeys(settings),
  };
}

export function extractPrivateFinancialData(workspace) {
  const source = isObject(workspace) ? workspace : {};
  const settings = {
    ...pickPrivateFinancialKeys(source),
    ...pickPrivateFinancialKeys(source.settings),
  };
  const attendance = getPrivateAttendance(source.attendance);
  const payslips = Array.isArray(source.payslips) ? source.payslips : [];
  return {
    data: {
      settings: { ...privateSettingsDefaults, ...settings },
      attendance,
      payslips,
    },
    hasData:
      Object.keys(settings).length > 0 ||
      Object.keys(attendance).length > 0 ||
      payslips.length > 0,
  };
}

export function extractPrivateFinancialAttendance(attendance) {
  return getPrivateAttendance(attendance);
}

export function mergePrivateFinancialData(baseData, overridingData) {
  const base = isObject(baseData) ? baseData : {};
  const overriding = isObject(overridingData) ? overridingData : {};
  const payslips = new Map();
  for (const [source, snapshots] of [
    ["base", Array.isArray(base.payslips) ? base.payslips : []],
    [
      "override",
      Array.isArray(overriding.payslips) ? overriding.payslips : [],
    ],
  ]) {
    snapshots.forEach((snapshot, index) => {
      const key =
        typeof snapshot?.employeeId === "string" &&
        typeof snapshot?.period?.startDate === "string" &&
        typeof snapshot?.period?.endDate === "string"
          ? `${snapshot.employeeId}:${snapshot.period.startDate}:${snapshot.period.endDate}`
          : `${source}:${index}`;
      payslips.set(key, snapshot);
    });
  }
  return {
    settings: {
      ...(isObject(base.settings) ? base.settings : {}),
      ...(isObject(overriding.settings) ? overriding.settings : {}),
    },
    attendance: mergeLocalPrivateAttendance(
      base.attendance,
      overriding.attendance,
    ),
    payslips: [...payslips.values()].sort((left, right) =>
      String(left?.period?.endDate ?? "").localeCompare(
        String(right?.period?.endDate ?? ""),
      ),
    ),
  };
}

export function mergeAttendancePunches(attendance, punchRows) {
  const mergedAttendance = { ...(isObject(attendance) ? attendance : {}) };
  for (const { shift_date: shiftDate, attendance_record: attendanceRecord } of punchRows) {
    if (mergedAttendance[shiftDate]?.punchSource !== "manual") {
      mergedAttendance[shiftDate] = attendanceRecord;
    }
  }
  return mergedAttendance;
}

export const localPrivateFinancialDefaults = privateSettingsDefaults;
