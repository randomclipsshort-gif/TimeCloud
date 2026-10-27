export function getAttendancePunchAvailability({
  record,
  shiftWindow,
  date,
  currentDate,
  currentMinutes,
  activeTimeEntryDate,
  earlyPunchWindowMinutes,
  hasAttendanceRecord,
}) {
  const hasAssignedShift = record.hasAssignedShift === true ||
    Boolean(record.shiftStartTime && record.shiftEndTime);
  const isEligibleRecord = record.type === "Regular" && hasAssignedShift;
  const hasCurrentTime = Number.isFinite(currentMinutes);
  const isActiveShiftDate = activeTimeEntryDate === date;
  const isFollowingDayOfActiveOvernightShift = Boolean(
    activeTimeEntryDate &&
    date === currentDate &&
    activeTimeEntryDate < date &&
    shiftWindow &&
    Math.floor(shiftWindow.endAt / 1440) > Math.floor(shiftWindow.startAt / 1440),
  );
  const isWithinShiftCutoff = Boolean(
    shiftWindow &&
    hasCurrentTime &&
    currentMinutes < shiftWindow.endAt,
  );
  const isCurrentOrActiveOvernightShiftDate = Boolean(
    date === currentDate ||
    (
      date < currentDate &&
      shiftWindow &&
      Math.floor(shiftWindow.endAt / 1440) > Math.floor(shiftWindow.startAt / 1440) &&
      Math.floor(currentMinutes / 1440) === Math.floor(shiftWindow.endAt / 1440)
    ),
  );

  return {
    canTimeIn:
      isCurrentOrActiveOvernightShiftDate &&
      !activeTimeEntryDate &&
      isEligibleRecord &&
      !hasAttendanceRecord &&
      isWithinShiftCutoff &&
      currentMinutes >= shiftWindow.startAt - earlyPunchWindowMinutes,
    canTimeOut:
      (isActiveShiftDate || isFollowingDayOfActiveOvernightShift) &&
      record.clockedIn === true &&
      isWithinShiftCutoff,
  };
}
