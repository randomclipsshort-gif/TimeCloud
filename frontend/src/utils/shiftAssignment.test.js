import assert from "node:assert/strict";
import test from "node:test";
import {
  clearShiftAndAttendanceRecord,
  createShiftAssignmentUpdates,
  getExpectedPaidMinutes,
  getShiftDurationMinutes,
  getManualEntryRangeConflicts,
  hasRecordedAttendance,
  normalizeTwelveHourShiftTime,
} from "./shiftAssignment.js";

const morning = {
  id: "morning",
  name: "Morning",
  label: "Morning",
  assigned: "06:00 AM - 02:00 PM",
  startTime: "06:00",
  endTime: "14:00",
  icon: "fa-sun",
  iconColor: "text-amber-500",
};

const night = {
  id: "night",
  name: "Night",
  label: "Night",
  assigned: "10:00 PM - 06:00 AM",
  startTime: "22:00",
  endTime: "06:00",
  icon: "fa-moon",
  iconColor: "text-indigo-600",
};

test("normalizes custom 12-hour shift times and rejects incomplete values", () => {
  assert.equal(normalizeTwelveHourShiftTime("10:00 PM"), "22:00");
  assert.equal(normalizeTwelveHourShiftTime("12:15 AM"), "00:15");
  assert.equal(normalizeTwelveHourShiftTime("12:15 PM"), "12:15");
  assert.equal(normalizeTwelveHourShiftTime("22:00"), null);
  assert.equal(normalizeTwelveHourShiftTime("13:00 PM"), null);
});

test("calculates expected paid time for paid and unpaid breaks, including overnight shifts", () => {
  const midShift = {
    startTime: "12:00",
    endTime: "21:00",
    breakDurationMinutes: 60,
    breakType: "unpaid",
  };
  assert.equal(getShiftDurationMinutes(midShift.startTime, midShift.endTime), 540);
  assert.equal(getExpectedPaidMinutes(midShift), 480);
  assert.equal(getExpectedPaidMinutes({ ...midShift, breakType: "paid" }), 540);
  assert.equal(
    getExpectedPaidMinutes({
      startTime: "22:00",
      endTime: "07:00",
      breakDurationMinutes: 45,
      breakType: "unpaid",
    }),
    495,
  );
  assert.equal(
    getExpectedPaidMinutes({ ...midShift, breakDurationMinutes: 600 }),
    null,
  );
});

test("assigns the selected template to every inclusive date without duplicates", () => {
  const updates = createShiftAssignmentUpdates(
    {},
    ["2026-11-16", "2026-11-20"],
    morning,
    750,
    [morning, night],
  );
  assert.deepEqual(Object.keys(updates), [
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
  ]);
  assert.equal(updates["2026-11-16"].base, "P750.00");
  assert.equal(updates["2026-11-20"].shift, "Morning");

  const repeated = createShiftAssignmentUpdates(
    updates,
    ["2026-11-16", "2026-11-20"],
    morning,
    750,
    [morning, night],
  );
  assert.equal(repeated["2026-11-16"].badges.length, 1);
  assert.equal(repeated["2026-11-16"].badges[0].text, "Morning");
});

test("template edits do not mutate an already assigned shift snapshot", () => {
  const midShift = {
    id: "mid",
    name: "Mid Shift",
    label: "Mid Shift",
    startTime: "12:00",
    endTime: "21:00",
    breakDurationMinutes: 60,
    breakType: "unpaid",
  };
  const assignment = createShiftAssignmentUpdates(
    {},
    ["2026-11-16"],
    midShift,
    900,
    [midShift],
  )["2026-11-16"];
  const editedTemplate = {
    ...midShift,
    breakDurationMinutes: 30,
    breakType: "paid",
  };

  assert.equal(editedTemplate.breakDurationMinutes, 30);
  assert.equal(assignment.assignedShiftSnapshot.breakDurationMinutes, 60);
  assert.equal(assignment.assignedShiftSnapshot.breakType, "unpaid");
  assert.equal(assignment.assignedShiftSnapshot.expectedPaidMinutes, 480);
});

test("assigns a night shift to each selected date", () => {
  const updates = createShiftAssignmentUpdates(
    {},
    ["2026-11-16", "2026-11-20"],
    night,
    750,
    [morning, night],
  );
  assert.deepEqual(Object.values(updates).map((record) => record.shift), [
    "Night",
    "Night",
    "Night",
    "Night",
    "Night",
  ]);
  assert.equal(updates["2026-11-16"].shiftStartTime, "22:00");
  assert.equal(updates["2026-11-20"].shiftEndTime, "06:00");
});

test("preserves manual attendance and payroll source fields when assigning a shift", () => {
  const sourceRecord = {
    type: "Regular",
    in: "10:05 PM",
    out: "06:15 AM",
    workStartTime: "22:05",
    workEndTime: "06:15",
    manualTimeInAt: "2026-11-16T22:05:00+08:00",
    base: "P725.00",
    ot: "P40.00",
    penalty: "P0.00",
    est: "P765.00 PHP",
    incentiveAmount: 150,
    badges: [{ text: "Manual Entry", color: "bg-sky-100 text-sky-800" }],
    dots: [{ title: "Night Differential", color: "bg-indigo-500" }],
  };
  const assigned = createShiftAssignmentUpdates(
    { "2026-11-16": sourceRecord },
    ["2026-11-16"],
    night,
    900,
    [morning, night],
  )["2026-11-16"];
  assert.equal(assigned.in, sourceRecord.in);
  assert.equal(assigned.out, sourceRecord.out);
  assert.equal(assigned.workStartTime, sourceRecord.workStartTime);
  assert.equal(assigned.manualTimeInAt, sourceRecord.manualTimeInAt);
  assert.equal(assigned.base, sourceRecord.base);
  assert.equal(assigned.est, sourceRecord.est);
  assert.equal(assigned.incentiveAmount, sourceRecord.incentiveAmount);
  assert.equal(assigned.dots[0].title, "Night Differential");
  assert.deepEqual(assigned.badges, [
    ...sourceRecord.badges,
    { text: "Night", color: "bg-teal-100 text-teal-800" },
  ]);
});

test("updates a reassigned shift badge rather than duplicating it", () => {
  const assignedMorning = createShiftAssignmentUpdates(
    {},
    ["2026-11-16"],
    morning,
    750,
    [morning, night],
  );
  const assignedNight = createShiftAssignmentUpdates(
    assignedMorning,
    ["2026-11-16"],
    night,
    750,
    [morning, night],
  )["2026-11-16"];
  assert.deepEqual(assignedNight.badges, [
    { text: "Night", color: "bg-teal-100 text-teal-800" },
  ]);
  assert.equal(assignedNight.assignedShiftTemplateId, "night");
});

test("clearing a shift removes attendance but preserves holidays and incentives", () => {
  const record = {
    type: "Regular",
    shift: "Manual Entry Adjustment",
    assigned: "10:00 PM - 06:00 AM",
    wageRate: "100%",
    base: "P750.00",
    ot: "P50.00",
    penalty: "P0.00",
    est: "P800.00 PHP",
    in: "10:00 PM",
    out: "06:00 AM",
    workStartTime: "22:00",
    workEndTime: "06:00",
    punchSource: "manual",
    incentiveAmount: 150,
    holidayName: "Founders Day",
    holidayClassification: "Special Non-Working Day",
    assignedShiftTemplateId: "night",
    assignedShiftName: "Night",
    hasAssignedShift: true,
    shiftStartTime: "22:00",
    shiftEndTime: "06:00",
    customIcon: "fa-moon",
    badges: [
      { text: "Manual Entry", color: "bg-sky-100 text-sky-800" },
      { text: "Night", color: "bg-teal-100 text-teal-800" },
    ],
    dots: [{ title: "Night Differential", color: "bg-indigo-500" }],
  };
  const cleared = clearShiftAndAttendanceRecord(record);
  assert.equal(hasRecordedAttendance(cleared), false);
  assert.equal(cleared.type, "Unassigned");
  assert.equal(cleared.shift, "No Shift Assigned");
  assert.equal(cleared.in, "—");
  assert.equal(cleared.out, "—");
  assert.equal(cleared.workStartTime, "");
  assert.equal(cleared.manualTimeInAt, null);
  assert.equal(cleared.base, "P0.00");
  assert.equal(cleared.est, "P0.00 PHP");
  assert.equal(cleared.incentiveAmount, record.incentiveAmount);
  assert.equal(cleared.holidayName, record.holidayName);
  assert.equal(cleared.hasAssignedShift, false);
  assert.equal(cleared.shiftStartTime, "");
  assert.equal(cleared.assignedShiftTemplateId, undefined);
  assert.deepEqual(cleared.badges, [
    { text: "No Shift Assigned", color: "bg-slate-100 text-slate-600" },
  ]);
  assert.deepEqual(cleared.dots, []);

  const absentRecord = clearShiftAndAttendanceRecord(
    {
      type: "Absent",
      shift: "Absent",
      assigned: "— - —",
      punchSource: "manual",
      leaveCode: "SL",
      hasAssignedShift: true,
      shiftStartTime: "06:00",
      shiftEndTime: "14:00",
      badges: [{ text: "Absent", color: "bg-red-100 text-red-800" }],
    },
  );
  assert.equal(absentRecord.type, "Unassigned");
  assert.equal(absentRecord.leaveCode, undefined);
  assert.deepEqual(absentRecord.badges, [
    { text: "No Shift Assigned", color: "bg-slate-100 text-slate-600" },
  ]);
});

test("clearing leave removes the leave status and preserves holiday indicators", () => {
  const cleared = clearShiftAndAttendanceRecord({
    type: "Leave",
    shift: "Sick Leave",
    leaveCode: "SL",
    leaveIcon: "fa-kit-medical",
    holidayName: "Founders Day",
    badges: [
      { text: "Sick Leave", color: "bg-sky-100 text-sky-800" },
      { text: "Founders Day", color: "bg-rose-100 text-rose-800" },
    ],
    dots: [{ title: "Holiday", color: "bg-rose-500" }],
  });
  assert.equal(cleared.type, "Unassigned");
  assert.equal(cleared.leaveCode, undefined);
  assert.equal(cleared.leaveIcon, undefined);
  assert.deepEqual(cleared.badges, [
    { text: "No Shift Assigned", color: "bg-slate-100 text-slate-600" },
    { text: "Founders Day", color: "bg-rose-100 text-rose-800" },
  ]);
  assert.deepEqual(cleared.dots, [
    { title: "Holiday", color: "bg-rose-500" },
  ]);
});

test("clearing an unworked shift resets schedule earnings without deleting other indicators", () => {
  const cleared = clearShiftAndAttendanceRecord(
    {
      type: "Regular",
      shift: "Morning",
      assigned: morning.assigned,
      base: "P750.00",
      est: "P750.00 PHP",
      hasAssignedShift: true,
      shiftStartTime: "06:00",
      shiftEndTime: "14:00",
      badges: [{ text: "Morning", color: "bg-teal-100 text-teal-800" }],
      dots: [{ title: "Holiday", color: "bg-rose-500" }],
    },
  );
  assert.equal(cleared.type, "Unassigned");
  assert.equal(cleared.base, "P0.00");
  assert.equal(cleared.shiftStartTime, "");
  assert.deepEqual(cleared.badges, [
    { text: "No Shift Assigned", color: "bg-slate-100 text-slate-600" },
  ]);
  assert.deepEqual(cleared.dots, [{ title: "Holiday", color: "bg-rose-500" }]);
});

test("manual range entry conflicts identify any attended or actively timed date", () => {
  const dates = ["2026-11-16", "2026-11-17", "2026-11-18"];
  assert.deepEqual(
    getManualEntryRangeConflicts(
      { "2026-11-17": { punchSource: "manual", in: "08:00 AM" } },
      dates,
      "2026-11-18",
    ),
    ["2026-11-17", "2026-11-18"],
  );
  assert.deepEqual(
    getManualEntryRangeConflicts(
      { "2026-11-17": { type: "Leave" } },
      dates,
      null,
    ),
    ["2026-11-17"],
  );
});
