const privateSettingsDefaults = {
  dailyWage: "",
  dailyAllowance: "0",
  overtimeMultiplier: "1.25",
  nightDifferential: "10",
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
    /(salary|wage|pay|earning|compensation|rate|bonus|commission|income|gross|deduction|tax|payroll|allowance|night.?differential|overtime.?multiplier|overtime.?amount|^(base|ot|penalty|est)$)/i.test(key);
}

function pickPrivateFinancialKeys(value) {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => isPrivateFinancialKey(key)));
}

function privateValuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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

export function extractLegacyPrivateFinancialData(workspace, punchRows = []) {
  const source = isObject(workspace) ? workspace : {};
  const attendance = getPrivateAttendance(source.attendance);
  for (const row of punchRows) {
    const record = pickPrivateFinancialKeys(row?.attendance_record);
    if (row?.shift_date && Object.keys(record).length > 0) {
      attendance[row.shift_date] = {
        ...attendance[row.shift_date],
        ...record,
      };
    }
  }
  return {
    settings: {
      ...privateSettingsDefaults,
      ...pickPrivateFinancialKeys(source),
    },
    attendance,
  };
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

export function mergePrivateFinancialData(...sources) {
  const settings = { ...privateSettingsDefaults };
  const attendance = {};
  for (const source of sources) {
    if (!isObject(source)) continue;
    Object.assign(settings, pickPrivateFinancialKeys(source.settings));
    for (const [date, record] of Object.entries(getPrivateAttendance(source.attendance))) {
      attendance[date] = { ...attendance[date], ...record };
    }
  }
  return { settings, attendance };
}

export function extractPrivateFinancialSettings(settings) {
  return pickPrivateFinancialKeys(settings);
}

export function findPrivateFinancialConflicts(localData, vaultData) {
  const conflicts = [];
  const localSettings = pickPrivateFinancialKeys(localData?.settings);
  const vaultSettings = pickPrivateFinancialKeys(vaultData?.settings);
  for (const [key, value] of Object.entries(localSettings)) {
    if (
      Object.hasOwn(vaultSettings, key) &&
      !privateValuesEqual(value, vaultSettings[key])) {
      conflicts.push(key);
    }
  }
  const localAttendance = getPrivateAttendance(localData?.attendance);
  const vaultAttendance = getPrivateAttendance(vaultData?.attendance);
  for (const [date, localRecord] of Object.entries(localAttendance)) {
    const vaultRecord = vaultAttendance[date];
    if (!vaultRecord) continue;
    for (const [key, value] of Object.entries(localRecord)) {
      if (Object.hasOwn(vaultRecord, key) && !privateValuesEqual(vaultRecord[key], value)) {
        conflicts.push(`${date}:${key}`);
      }
    }
  }
  return conflicts;
}

export function extractPrivateFinancialAttendance(attendance) {
  return getPrivateAttendance(attendance);
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

export function getLegacyPrivateFinancialData(userId, cloudData) {
  const cloud = isObject(cloudData?.settings)
    ? mergePrivateFinancialData(cloudData)
    : extractLegacyPrivateFinancialData(cloudData);
  if (typeof window === "undefined") return cloud;
  const key = `timecloud:private-financial-data:${userId}`;
  const stored = window.localStorage.getItem(key);
  if (stored === null) return cloud;
  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new Error("Saved local financial settings are invalid. Preserve this browser data before continuing.");
  }
  if (!isObject(parsed)) {
    throw new Error("Saved local financial settings are invalid. Preserve this browser data before continuing.");
  }
  return mergePrivateFinancialData(cloud, {
    settings: parsed.settings,
    attendance: parsed.attendance,
  });
}

export function clearLegacyPrivateFinancialData(userId) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(`timecloud:private-financial-data:${userId}`);
  }
}

export function hasLegacyPrivateFinancialData(userId) {
  return typeof window !== "undefined" &&
    window.localStorage.getItem(`timecloud:private-financial-data:${userId}`) !== null;
}

export const localPrivateFinancialDefaults = privateSettingsDefaults;
