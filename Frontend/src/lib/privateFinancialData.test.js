import test from "node:test";
import assert from "node:assert/strict";
import {
  clearLegacyPrivateFinancialData,
  extractLegacyPrivateFinancialData,
  findPrivateFinancialConflicts,
  getLegacyPrivateFinancialData,
  hasLegacyPrivateFinancialData,
  mergeAttendancePunches,
  mergeLocalPrivateAttendance,
  serializeWorkspaceForCloud,
} from "./privateFinancialData.js";

test("cloud workspace serialization excludes salary and earnings fields", () => {
  const workspace = {
    dailyWage: "2500",
    dailyAllowance: "100",
    overtimeMultiplier: "1.5",
    nightDifferential: "10",
    annualBonus: "5000",
    leaveBalances: { VL: 4 },
    shiftTemplates: [{ id: "morning", startTime: "06:00", hourlyRate: 42 }],
    attendance: {
      "2026-10-28": {
        type: "Regular",
        shift: "Morning",
        shiftStartTime: "06:00",
        base: "P2500.00",
        wageRate: "100%",
        ot: "P0.00",
        penalty: "P0.00",
        est: "P2500.00 PHP",
        overtimeAmount: 50,
        overtimeMinutes: 30,
        bonusAmount: 200,
      },
    },
  };

  const cloudWorkspace = serializeWorkspaceForCloud(workspace);

  assert.deepEqual(Object.keys(cloudWorkspace).sort(), [
    "attendance",
    "leaveBalances",
    "shiftTemplates",
  ]);
  assert.deepEqual(cloudWorkspace.attendance["2026-10-28"], {
    type: "Regular",
    shift: "Morning",
    shiftStartTime: "06:00",
    overtimeMinutes: 30,
  });
  assert.deepEqual(cloudWorkspace.shiftTemplates, [{
    id: "morning",
    startTime: "06:00",
  }]);
});

test("legacy salary fields are extracted locally before cleanup", () => {
  const legacyData = extractLegacyPrivateFinancialData({
    dailyWage: "2500",
    nightDifferential: "12",
    attendance: {
      "2026-10-28": { base: "P2500.00", type: "Regular", est: "P2500.00 PHP" },
    },
  }, [{
    shift_date: "2026-10-29",
    attendance_record: { base: "P2500.00", type: "Regular" },
  }]);

  assert.equal(legacyData.settings.dailyWage, "2500");
  assert.equal(legacyData.settings.nightDifferential, "12");
  assert.deepEqual(legacyData.attendance, {
    "2026-10-28": { base: "P2500.00", est: "P2500.00 PHP" },
    "2026-10-29": { base: "P2500.00" },
  });
});

test("legacy values are read without changing their local copy", () => {
  const store = new Map();
  store.set("timecloud:private-financial-data:user-1", JSON.stringify({
    settings: { dailyWage: "3000" },
    attendance: { "2026-10-28": { est: "P3000.00 PHP" } },
  }));
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      removeItem: (key) => store.delete(key),
    },
  };

  const restored = getLegacyPrivateFinancialData("user-1", {
    dailyWage: "2500",
    attendance: { "2026-10-29": { est: "P2500.00 PHP" } },
  });
  assert.equal(restored.settings.dailyWage, "3000");
  assert.deepEqual(restored.attendance, {
    "2026-10-28": { est: "P3000.00 PHP" },
    "2026-10-29": { est: "P2500.00 PHP" },
  });
  assert.equal(hasLegacyPrivateFinancialData("user-1"), true);
  clearLegacyPrivateFinancialData("user-1");
  assert.equal(hasLegacyPrivateFinancialData("user-1"), false);
  const cloudOnly = getLegacyPrivateFinancialData("user-2", {
    settings: { dailyWage: "2500" },
    attendance: { "2026-10-30": { est: "P2500.00 PHP" } },
  });
  assert.equal(cloudOnly.settings.dailyWage, "2500");
  assert.deepEqual(cloudOnly.attendance, {
    "2026-10-30": { est: "P2500.00 PHP" },
  });
  globalThis.window = undefined;
});

test("device-only financial fields merge back into local attendance", () => {
  const attendance = mergeLocalPrivateAttendance({
    "2026-10-28": { type: "Regular", shift: "Morning" },
  }, {
    "2026-10-28": { base: "P2500.00", est: "P2500.00 PHP" },
  });

  assert.deepEqual(attendance["2026-10-28"], {
    type: "Regular",
    shift: "Morning",
    base: "P2500.00",
    est: "P2500.00 PHP",
  });
});

test("legacy financial conflicts are identified without revealing their values", () => {
  const conflicts = findPrivateFinancialConflicts({
    settings: { dailyWage: "2400" },
    attendance: { "2026-10-28": { est: "old estimate" } },
  }, {
    settings: { dailyWage: "2500" },
    attendance: { "2026-10-28": { est: "new estimate" } },
  });
  assert.deepEqual(conflicts, ["dailyWage", "2026-10-28:est"]);
});

test("manual corrections remain visible over their original punch record", () => {
  const attendance = mergeAttendancePunches({
    "2026-10-28": { type: "Regular", punchSource: "manual", workStartTime: "08:00" },
  }, [{
    shift_date: "2026-10-28",
    attendance_record: { type: "Regular", punchSource: "ordinary", workStartTime: "06:00" },
  }]);

  assert.equal(attendance["2026-10-28"].punchSource, "manual");
  assert.equal(attendance["2026-10-28"].workStartTime, "08:00");
});
