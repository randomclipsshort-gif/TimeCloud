import { getInclusiveDateKeys } from "./calendarRange.js";

export function normalizeTwelveHourShiftTime(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) return null;
  const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function parseShiftTimeMinutes(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const meridiem = match[3]?.toUpperCase();
  if (hour > (meridiem ? 12 : 23) || (meridiem && hour < 1)) return null;
  if (meridiem) hour = (hour % 12) + (meridiem === "PM" ? 12 : 0);
  return hour * 60 + Number(match[2]);
}

export function getShiftDurationMinutes(startTime, endTime) {
  const start = parseShiftTimeMinutes(startTime);
  const endOfDay = parseShiftTimeMinutes(endTime);
  if (start === null || endOfDay === null || start === endOfDay) return null;
  const end = endOfDay <= start ? endOfDay + 1440 : endOfDay;
  return end - start <= 1440 ? end - start : null;
}

export function getExpectedPaidMinutes(shift) {
  const scheduledMinutes = getShiftDurationMinutes(
    shift?.startTime,
    shift?.endTime,
  );
  const rawBreakMinutes = shift?.breakDurationMinutes;
  const breakMinutes =
    rawBreakMinutes === null || rawBreakMinutes === undefined ||
    rawBreakMinutes === ""
      ? null
      : Number(rawBreakMinutes);
  if (
    scheduledMinutes === null ||
    !Number.isFinite(breakMinutes) ||
    breakMinutes < 0 ||
    breakMinutes > scheduledMinutes ||
    !["paid", "unpaid"].includes(shift?.breakType)
  ) {
    return null;
  }
  return scheduledMinutes - (shift.breakType === "unpaid" ? breakMinutes : 0);
}

export function hasRecordedAttendance(record) {
  return Boolean(
    record?.punchSource ||
      record?.clockedIn ||
      record?.workStartTime ||
      record?.workEndTime ||
      record?.manualTimeInAt ||
      record?.manualTimeOutAt ||
      (record?.in && record.in !== "—") ||
      (record?.out && record.out !== "—") ||
      ["Absent", "Half-day", "Leave", "Overtime Claim"].includes(record?.type),
  );
}

export function clearShiftAndAttendanceRecord(record) {
  const preservedFields = Object.fromEntries(
    [
      "holidayName",
      "holidayClassification",
      "holidayDescription",
      "holidayLocality",
      "incentiveAmount",
      "incentives",
    ]
      .filter((key) => Object.hasOwn(record, key))
      .map((key) => [key, record[key]]),
  );
  const dots = Array.isArray(record.dots)
    ? record.dots.filter((item) => /holiday|company break/i.test(item?.title || ""))
    : [];
  const holidayName = String(record.holidayName || "").toLowerCase();
  const holidayBadges = Array.isArray(record.badges)
    ? record.badges.filter((item) => {
        const text = typeof item?.text === "string" ? item.text : "";
        return (
          /holiday|company break/i.test(text) ||
          (holidayName && text.toLowerCase() === holidayName)
        );
      })
    : [];

  return {
    ...preservedFields,
    type: "Unassigned",
    shift: "No Shift Assigned",
    wageRate: "0%",
    base: "P0.00",
    ot: "P0.00",
    penalty: "P0.00",
    est: "P0.00 PHP",
    assigned: "No shift assigned",
    in: "—",
    out: "—",
    clockedIn: false,
    punchSource: undefined,
    workStartTime: "",
    workEndTime: "",
    manualTimeInAt: null,
    manualTimeOutAt: null,
    timeInAt: null,
    timeOutAt: null,
    timeZone: undefined,
    isHalfDay: false,
    overtimeAmount: 0,
    overtimeMinutes: 0,
    late: false,
    lateMinutes: 0,
    undertime: false,
    undertimeMinutes: 0,
    shiftStartTime: "",
    shiftEndTime: "",
    hasAssignedShift: false,
    dots,
    badges: [
      { text: "No Shift Assigned", color: "bg-slate-100 text-slate-600" },
      ...holidayBadges,
    ],
  };
}

export function getManualEntryRangeConflicts(
  attendance,
  dateKeys,
  activeTimeEntryDate,
) {
  return dateKeys.filter(
    (date) =>
      date === activeTimeEntryDate || hasRecordedAttendance(attendance[date]),
  );
}

export function createShiftAssignmentRecord(
  existingRecord,
  template,
  dailyWage,
  shiftTemplates = [],
) {
  const isRestDay = template.id === "rest-day";
  const shiftName = template.label || template.name;
  const hasExistingRecord =
    existingRecord !== null &&
    typeof existingRecord === "object" &&
    !Array.isArray(existingRecord);
  const basePay = Number(dailyWage);
  const formattedPay =
    Number.isFinite(basePay) && basePay > 0 ? `P${basePay.toFixed(2)}` : "P0.00";
  const badge = isRestDay
    ? { text: "Rest Day", color: "bg-slate-200 text-slate-700" }
    : { text: shiftName, color: "bg-teal-100 text-teal-800" };
  const previousShiftNames = new Set([
    hasRecordedAttendance(existingRecord) ? undefined : existingRecord?.shift,
    existingRecord?.assigned,
    existingRecord?.assignedShiftName,
    ...shiftTemplates.flatMap((item) => [item.label, item.name]),
  ]);
  const badges = Array.isArray(existingRecord?.badges)
    ? existingRecord.badges.filter(
        (item) => item?.text && !previousShiftNames.has(item.text),
      )
    : [];
  const isUnassigned = !hasExistingRecord || existingRecord.type === "Unassigned";
  const breakDurationMinutes =
    template.breakDurationMinutes === null ||
    template.breakDurationMinutes === undefined ||
    template.breakDurationMinutes === ""
      ? null
      : Number(template.breakDurationMinutes);
  const breakType = ["paid", "unpaid"].includes(template.breakType)
    ? template.breakType
    : null;
  const assignedShiftSnapshot = {
    id: template.id,
    name: shiftName,
    label: shiftName,
    range: template.range || template.assigned || "",
    startTime: template.startTime || "",
    endTime: template.endTime || "",
    icon: template.icon,
    iconColor: template.iconColor,
    breakDurationMinutes: Number.isFinite(breakDurationMinutes)
      ? breakDurationMinutes
      : null,
    breakType,
  };
  assignedShiftSnapshot.expectedPaidMinutes =
    getExpectedPaidMinutes(assignedShiftSnapshot);

  return {
    ...(hasExistingRecord ? existingRecord : {}),
    type: isUnassigned ? (isRestDay ? "Rest Day" : "Regular") : existingRecord.type,
    shift: shiftName,
    wageRate: isUnassigned ? (isRestDay ? "0%" : "100%") : existingRecord.wageRate,
    base: isUnassigned ? (isRestDay ? "P0.00" : formattedPay) : existingRecord.base,
    ot: isUnassigned ? "P0.00" : existingRecord.ot,
    penalty: isUnassigned ? "P0.00" : existingRecord.penalty,
    est: isUnassigned
      ? `${isRestDay ? "P0.00" : formattedPay} PHP`
      : existingRecord.est,
    assigned: isRestDay ? "Rest Day" : template.assigned || shiftName,
    in: hasExistingRecord ? existingRecord.in : "—",
    out: hasExistingRecord ? existingRecord.out : "—",
    shiftStartTime: template.startTime || "",
    shiftEndTime: template.endTime || "",
    assignedShiftTemplateId: template.id,
    assignedShiftSnapshot,
    hasAssignedShift: true,
    customIcon: isRestDay ? existingRecord?.customIcon : template.icon,
    customIconColor: isRestDay
      ? existingRecord?.customIconColor
      : template.iconColor,
    dots: Array.isArray(existingRecord?.dots) ? existingRecord.dots : [],
    badges: [...badges, badge],
  };
}

export function createShiftAssignmentUpdates(
  attendance,
  dateKeys,
  template,
  dailyWage,
  shiftTemplates,
) {
  return Object.fromEntries(
    getInclusiveDateKeys(dateKeys[0], dateKeys[dateKeys.length - 1]).map(
      (date) => [
        date,
        createShiftAssignmentRecord(
          attendance[date],
          template,
          dailyWage,
          shiftTemplates,
        ),
      ],
    ),
  );
}
