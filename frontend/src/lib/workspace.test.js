import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeWorkspace,
  resolveOptionalWorkspaceLoads,
} from "./workspace.js";

test("workspace normalization quarantines malformed nested records", () => {
  const workspace = normalizeWorkspace({
    attendance: {
      "2026-11-10": { type: "Regular" },
      "2026-11-11": null,
      "2026-11-12": ["invalid"],
    },
    expenses: [
      { id: "valid", name: "Transport", amount: 25, date: "2026-11-10" },
      null,
      "invalid",
    ],
    shiftTemplates: [{ id: "day" }, null],
    holidays: [{ id: "holiday" }, []],
  });

  assert.deepEqual(workspace.attendance, {
    "2026-11-10": { type: "Regular" },
    "2026-11-11": { invalidStoredValue: null },
    "2026-11-12": { invalidStoredValue: ["invalid"] },
  });
  assert.deepEqual(workspace.invalidAttendanceDates, [
    "2026-11-11",
    "2026-11-12",
  ]);
  assert.equal(workspace.expenses.length, 3);
  assert.deepEqual(workspace.expenses[1], { invalidStoredValue: null });
  assert.deepEqual(workspace.expenses[2], {
    invalidStoredValue: "invalid",
  });
  assert.deepEqual(workspace.shiftTemplates, [
    { id: "day" },
    { invalidStoredValue: null },
  ]);
  assert.deepEqual(workspace.holidays, [
    { id: "holiday" },
    { invalidStoredValue: [] },
  ]);
  assert.match(workspace.workspaceDataWarning, /preserved/);
});

test("workspace normalization safely falls back for non-object data", () => {
  const workspace = normalizeWorkspace(null);

  assert.deepEqual(workspace.attendance, {});
  assert.deepEqual(workspace.expenses, []);
  assert.deepEqual(workspace.travelPlans, []);
  assert.deepEqual(workspace.invalidAttendanceDates, []);
});

test("optional cloud read failures do not block unrelated workspace data", () => {
  const punchFailure = new Error("Punch request failed");
  const vaultFailure = new Error("Vault request failed");
  const result = resolveOptionalWorkspaceLoads(
    { status: "rejected", reason: punchFailure },
    { status: "rejected", reason: vaultFailure },
  );

  assert.equal(result.attendancePunchLoadError, punchFailure);
  assert.deepEqual(result.punchRows, []);
  assert.equal(result.salaryVaultLoadError, vaultFailure);
  assert.equal(result.salaryVaultTableAvailable, true);
  assert.equal(result.salaryVault, null);
});

test("salary-vault read failures remain visible without discarding other reads", () => {
  const vaultFailure = Object.assign(new Error("Vault request failed"), {
    code: "SALARY_VAULT_LOAD_FAILED",
  });
  const result = resolveOptionalWorkspaceLoads(
    { status: "fulfilled", value: { data: [] } },
    {
      status: "rejected",
      reason: vaultFailure,
    },
  );

  assert.equal(result.attendancePunchLoadError, null);
  assert.equal(result.salaryVaultTableAvailable, true);
  assert.equal(result.salaryVaultLoadError, vaultFailure);
});

test("invalid punch rows disable punches instead of being silently merged", () => {
  const result = resolveOptionalWorkspaceLoads(
    {
      status: "fulfilled",
      value: {
        data: [
          {
            shift_date: "2026-11-10",
            attendance_record: { type: "Regular" },
          },
          { shift_date: "2026-11-11", attendance_record: null },
        ],
      },
    },
    { status: "fulfilled", value: { data: null, error: null } },
  );

  assert.equal(result.punchRows.length, 1);
  assert.match(result.attendancePunchLoadError.message, /malformed punch records/);
});
