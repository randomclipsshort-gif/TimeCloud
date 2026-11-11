import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  assertSameOrigin,
  containsPrivateFinancialData,
  handleApiRequestWithErrors,
  isWithinClockInWindow,
  validateShiftDate,
  validateVaultRecord,
  validateWorkspaceData,
} from "../src/services/apiService.js";

class MemoryCollection {
  constructor() {
    this.documents = new Map();
  }

  key(document) {
    return document._id ?? `${document.userId}:${document.shiftDate}`;
  }

  async createIndex() {}

  async findOne(filter) {
    return structuredClone(
      [...this.documents.values()].find((document) =>
        Object.entries(filter).every(([key, value]) => document[key] === value),
      ) ?? null,
    );
  }

  find(filter) {
    return {
      toArray: async () =>
        structuredClone(
          [...this.documents.values()].filter((document) =>
            Object.entries(filter).every(([key, value]) => document[key] === value),
          ),
        ),
    };
  }

  async insertOne(document) {
    const key = this.key(document);
    if (this.documents.has(key)) {
      const error = new Error("duplicate key");
      error.code = 11000;
      throw error;
    }
    this.documents.set(key, structuredClone(document));
  }

  async findOneAndUpdate(filter, update) {
    const entry = [...this.documents.entries()].find(([, document]) =>
      Object.entries(filter).every(([key, value]) =>
        value === null
          ? document[key] == null
          : document[key] === value,
      ),
    );
    if (!entry) return null;
    const [key, document] = entry;
    Object.assign(document, structuredClone(update.$set));
    for (const [field, amount] of Object.entries(update.$inc || {})) {
      document[field] = (document[field] ?? 0) + amount;
    }
    this.documents.set(key, document);
    return structuredClone(document);
  }
}

function createMemoryDatabase() {
  const collections = new Map();
  return {
    collection(name) {
      if (!collections.has(name)) collections.set(name, new MemoryCollection());
      return collections.get(name);
    },
  };
}

function createResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
}

function createRequest(userId, method, url, body) {
  return {
    method,
    url,
    headers: {
      ...(userId ? { cookie: `timecloud.session_token=${userId}-token` } : {}),
      origin: "https://time-cloud.vercel.app",
    },
    body,
  };
}

async function callApi(database, request) {
  const response = createResponse();
  await handleApiRequestWithErrors(request, response, {
    loadMongoDb: async () => database,
    loadAuth: async () => ({
      api: {
        getSession: async ({ headers }) => {
          const token = headers
            .get("cookie")
            ?.match(/(?:^|;\s*)timecloud\.session_token=([^;]+)/)?.[1];
          const userId = token?.replace(/-token$/, "");
          return userId ? { user: { id: userId } } : null;
        },
      },
    }),
    loadConfig: () => ({ origin: "https://time-cloud.vercel.app" }),
  });
  return response;
}

test("workspace validation rejects malformed, oversized, and plaintext financial data", () => {
  assert.throws(
    () => validateWorkspaceData([]),
    (error) => error instanceof ApiError && error.code === "INVALID_WORKSPACE",
  );
  assert.throws(
    () => validateWorkspaceData({ settings: { dailyWage: "1000" } }),
    (error) =>
      error instanceof ApiError &&
      error.code === "PRIVATE_DATA_IN_WORKSPACE" &&
      /encrypted salary vault/.test(error.message),
  );
  assert.throws(
    () => validateWorkspaceData({ description: "x".repeat(1_048_600) }),
    (error) => error instanceof ApiError && error.code === "WORKSPACE_TOO_LARGE",
  );
  assert.deepEqual(validateWorkspaceData({ holidays: [] }), { holidays: [] });
});

test("private financial field detection checks nested and array values", () => {
  assert.equal(containsPrivateFinancialData({ dailyWage: "1000" }), true);
  assert.equal(
    containsPrivateFinancialData({ attendance: [{ overtimeAmount: 50 }] }),
    true,
  );
  assert.equal(
    containsPrivateFinancialData({ employeeIncentives: [{ amount: 25 }] }),
    true,
  );
  assert.equal(containsPrivateFinancialData({ sssFrequency: "monthly" }), true);
  assert.equal(containsPrivateFinancialData({ shiftStartTime: "09:00" }), false);
});

test("vault validation accepts only the encrypted envelope and supported versions", () => {
  const record = {
    ciphertext: "A".repeat(32),
    nonce: "A".repeat(16),
    salt: "A".repeat(22) + "==",
    format_version: 1,
    key_version: 1,
  };
  assert.deepEqual(validateVaultRecord(record), record);
  assert.throws(
    () => validateVaultRecord({ ...record, plaintext: "salary" }),
    (error) => error instanceof ApiError && error.code === "INVALID_VAULT",
  );
  assert.throws(
    () => validateVaultRecord({ ...record, nonce: "invalid" }),
    (error) => error instanceof ApiError && error.code === "INVALID_VAULT",
  );
});

test("shift dates reject impossible dates", () => {
  assert.equal(validateShiftDate("2026-11-10"), "2026-11-10");
  assert.throws(
    () => validateShiftDate("2026-02-30"),
    (error) => error instanceof ApiError && error.code === "INVALID_SHIFT_DATE",
  );
  assert.throws(
    () => validateShiftDate("2026/11/10"),
    (error) => error instanceof ApiError && error.code === "INVALID_SHIFT_DATE",
  );
});

test("clock-in window validation handles early punches and overnight shifts", () => {
  const dayShift = {
    shiftDate: "2026-11-10",
    shiftStart: 9 * 60,
    shiftEnd: 17 * 60,
  };
  assert.equal(
    isWithinClockInWindow({
      ...dayShift,
      clock: { date: "2026-11-10", minutes: 8 * 60 + 45 },
    }),
    true,
  );
  assert.equal(
    isWithinClockInWindow({
      ...dayShift,
      clock: { date: "2026-11-10", minutes: 8 * 60 + 44 },
    }),
    false,
  );
  assert.equal(
    isWithinClockInWindow({
      shiftDate: "2026-11-10",
      shiftStart: 22 * 60,
      shiftEnd: 6 * 60,
      clock: { date: "2026-11-11", minutes: 5 * 60 + 59 },
    }),
    true,
  );
  assert.equal(
    isWithinClockInWindow({
      shiftDate: "2026-11-10",
      shiftStart: 22 * 60,
      shiftEnd: 6 * 60,
      clock: { date: "2026-11-11", minutes: 6 * 60 },
    }),
    false,
  );
});

test("state-changing API requests reject a different Origin", () => {
  assert.throws(
    () =>
      assertSameOrigin(
        new Headers({ origin: "https://attacker.example" }),
        { origin: "https://time-cloud.vercel.app" },
      ),
    (error) => error instanceof ApiError && error.status === 403,
  );
  assert.doesNotThrow(() =>
    assertSameOrigin(
      new Headers({ origin: "https://time-cloud.vercel.app" }),
      { origin: "https://time-cloud.vercel.app" },
    ),
  );
});

test("workspace API derives ownership from the authenticated session", async () => {
  const database = createMemoryDatabase();
  const aliceSave = await callApi(
    database,
    createRequest("alice", "PUT", "/api/workspace", {
      data: { selectedLocality: "Manila" },
      expectedRevision: 0,
    }),
  );
  assert.equal(aliceSave.statusCode, 200);
  assert.deepEqual(aliceSave.body.data, { revision: 1 });

  const bobRead = await callApi(
    database,
    createRequest("bob", "GET", "/api/workspace"),
  );
  assert.equal(bobRead.body.data.data, null);
  assert.equal(bobRead.body.data.revision, 0);

  await callApi(
    database,
    createRequest("bob", "PUT", "/api/workspace", {
      userId: "alice",
      data: { selectedLocality: "Cebu" },
      expectedRevision: 0,
    }),
  );
  const aliceRead = await callApi(
    database,
    createRequest("alice", "GET", "/api/workspace"),
  );
  const bobReadAfterWrite = await callApi(
    database,
    createRequest("bob", "GET", "/api/workspace"),
  );
  assert.equal(aliceRead.body.data.data.selectedLocality, "Manila");
  assert.equal(bobReadAfterWrite.body.data.data.selectedLocality, "Cebu");
});

test("workspace API rejects requests without a verified session cookie", async () => {
  const database = createMemoryDatabase();
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);

  try {
    const response = await callApi(
      database,
      {
        ...createRequest(null, "GET", "/api/workspace"),
        headers: {
          "x-test-user": "alice",
          origin: "https://time-cloud.vercel.app",
        },
      },
    );

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.error.code, "AUTH_REQUIRED");
    assert.equal(warnings.length, 1);
    assert.deepEqual(warnings[0][1], {
      method: "GET",
      origin: "https://time-cloud.vercel.app",
      cookieHeaderPresent: false,
    });
  } finally {
    console.warn = originalWarn;
  }
});

test("workspace API rejects stale revision writes without replacing newer data", async () => {
  const database = createMemoryDatabase();
  await callApi(
    database,
    createRequest("alice", "PUT", "/api/workspace", {
      data: { selectedLocality: "Manila" },
      expectedRevision: 0,
    }),
  );
  const staleWrite = await callApi(
    database,
    createRequest("alice", "PUT", "/api/workspace", {
      data: { selectedLocality: "Cebu" },
      expectedRevision: 0,
    }),
  );
  assert.equal(staleWrite.statusCode, 409);
  assert.equal(staleWrite.body.error.code, "REVISION_CONFLICT");
  const read = await callApi(
    database,
    createRequest("alice", "GET", "/api/workspace"),
  );
  assert.equal(read.body.data.data.selectedLocality, "Manila");
});

test("salary vault API isolates users and stores only ciphertext envelopes", async () => {
  const database = createMemoryDatabase();
  const record = {
    ciphertext: "A".repeat(32),
    nonce: "A".repeat(16),
    salt: `${"A".repeat(22)}==`,
    format_version: 1,
    key_version: 1,
  };
  const save = await callApi(
    database,
    createRequest("alice", "PUT", "/api/salary-vault", {
      record,
      expectedRevision: 0,
    }),
  );
  const bobRead = await callApi(
    database,
    createRequest("bob", "GET", "/api/salary-vault"),
  );

  assert.equal(save.statusCode, 200);
  assert.deepEqual(save.body.data, { revision: 1 });
  assert.equal(bobRead.body.data, null);
  assert.deepEqual(
    await database.collection("private_salary_vault").findOne({ _id: "alice" }),
    {
      _id: "alice",
      ...record,
      revision: 1,
      updatedAt: (await database.collection("private_salary_vault").findOne({ _id: "alice" })).updatedAt,
    },
  );
});

function getCurrentManilaShift() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  const currentMinute = Number(parts.hour) * 60 + Number(parts.minute);
  const shiftStart = Math.max(0, currentMinute - 1);
  const shiftEnd = (shiftStart + 60) % 1440;
  const toTime = (minutes) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return {
    shiftDate: `${parts.year}-${parts.month}-${parts.day}`,
    shiftStartTime: toTime(shiftStart),
    shiftEndTime: toTime(shiftEnd),
  };
}

test("ordinary punch endpoints enforce schedule, uniqueness, and server timestamps", async () => {
  const database = createMemoryDatabase();
  const shift = getCurrentManilaShift();
  const schedule = {
    type: "Regular",
    hasAssignedShift: true,
    ...shift,
  };
  await callApi(
    database,
    createRequest("alice", "PUT", "/api/workspace", {
      data: { attendance: { [shift.shiftDate]: schedule } },
      expectedRevision: 0,
    }),
  );

  const clockIn = await callApi(
    database,
    createRequest("alice", "POST", "/api/punches/clock-in", {
      shiftDate: shift.shiftDate,
    }),
  );
  const duplicateClockIn = await callApi(
    database,
    createRequest("alice", "POST", "/api/punches/clock-in", {
      shiftDate: shift.shiftDate,
    }),
  );
  const clockOut = await callApi(
    database,
    createRequest("alice", "POST", "/api/punches/clock-out", {
      shiftDate: shift.shiftDate,
    }),
  );
  const duplicateClockOut = await callApi(
    database,
    createRequest("alice", "POST", "/api/punches/clock-out", {
      shiftDate: shift.shiftDate,
    }),
  );

  assert.equal(clockIn.statusCode, 201);
  assert.equal(clockIn.body.data.record.clockedIn, true);
  assert.equal(typeof clockIn.body.data.timeAt, "string");
  assert.equal(duplicateClockIn.statusCode, 409);
  assert.equal(duplicateClockIn.body.error.code, "PUNCH_ALREADY_EXISTS");
  assert.equal(clockOut.statusCode, 200);
  assert.equal(clockOut.body.data.record.clockedIn, false);
  assert.equal(duplicateClockOut.statusCode, 409);
  assert.equal(duplicateClockOut.body.error.code, "ACTIVE_PUNCH_REQUIRED");
});
