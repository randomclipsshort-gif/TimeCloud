export function getStoredAttendanceBasePay(record) {
  const amount = Number(String(record?.base ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

export function getAttendanceBasePay(record, configuredDailyWage) {
  const storedBasePay = getStoredAttendanceBasePay(record);
  if (storedBasePay !== 0) return storedBasePay;

  const dailyWage = Number(configuredDailyWage);
  const hasAssignedShift =
    record?.hasAssignedShift === true ||
    Boolean(record?.shiftStartTime && record?.shiftEndTime);
  if (
    !hasAssignedShift ||
    !["Regular", "Official Business"].includes(record?.type) ||
    !Number.isFinite(dailyWage) ||
    dailyWage <= 0
  ) {
    return 0;
  }

  return record.shift === "Half-day" ? dailyWage / 2 : dailyWage;
}
