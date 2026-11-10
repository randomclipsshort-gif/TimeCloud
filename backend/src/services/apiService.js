import { getServerConfig, ServerConfigError } from "../config/config.js";
import { getMongoDb } from "../config/mongodb.js";
import { getAuth } from "./auth.js";

const MAX_WORKSPACE_BYTES = 1_048_576;
const MAX_REQUEST_BYTES = 1_100_000;
const privateFieldPattern =
  /(salary|wage|pay|earning|compensation|rate|bonus|commission|incentive|income|gross|deduction|tax|payroll|allowance|night.?differential|overtime.?multiplier|overtime.?amount|^(base|ot|penalty|est)$)|^(sss|philhealth|pagibig)(frequency|monthlycutoff|firstcutoffamount|secondcutoffamount)$/i;
const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function respond(response, status, payload) {
  response.statusCode = status;
  for (const [name, value] of Object.entries(JSON_HEADERS)) {
    response.setHeader(name, value);
  }
  response.end(JSON.stringify(payload));
}

function success(response, data, status = 200) {
  respond(response, status, { data });
}

function getRequestHeaders(headers = {}) {
  const requestHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) requestHeaders.append(name, item);
    } else {
      requestHeaders.set(name, value);
    }
  }
  return requestHeaders;
}

export function assertSameOrigin(requestHeaders, config) {
  const origin = requestHeaders.get("origin");
  const appOrigin = config.appOrigin ?? config.origin;
  if (origin && origin !== appOrigin) {
    throw new ApiError(403, "ORIGIN_REJECTED", "Cross-origin request rejected.");
  }
}

export async function readJsonBody(request, maximumBytes = MAX_REQUEST_BYTES) {
  if (request.body !== undefined && request.body !== null) {
    if (typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
      const serialized = JSON.stringify(request.body);
      if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
        throw new ApiError(413, "BODY_TOO_LARGE", "The request body is too large.");
      }
      return request.body;
    }
    const raw = Buffer.isBuffer(request.body)
      ? request.body.toString("utf8")
      : String(request.body);
    if (Buffer.byteLength(raw, "utf8") > maximumBytes) {
      throw new ApiError(413, "BODY_TOO_LARGE", "The request body is too large.");
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
    }
  }

  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > maximumBytes) {
      throw new ApiError(413, "BODY_TOO_LARGE", "The request body is too large.");
    }
    chunks.push(buffer);
  }
  if (length === 0) {
    throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasPrivateFields(value) {
  if (Array.isArray(value)) return value.some(hasPrivateFields);
  if (!isObject(value)) return false;
  return Object.entries(value).some(
    ([key, nestedValue]) =>
      privateFieldPattern.test(key) || hasPrivateFields(nestedValue),
  );
}

export function containsPrivateFinancialData(value) {
  return hasPrivateFields(value);
}

export function validateWorkspaceData(data) {
  if (!isObject(data)) {
    throw new ApiError(400, "INVALID_WORKSPACE", "Workspace data must be an object.");
  }
  if (hasPrivateFields(data)) {
    throw new ApiError(
      400,
      "PRIVATE_DATA_IN_WORKSPACE",
      "Private financial data must be saved through the encrypted salary vault.",
    );
  }
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, "utf8") > MAX_WORKSPACE_BYTES) {
    throw new ApiError(413, "WORKSPACE_TOO_LARGE", "Workspace data exceeds the 1 MiB limit.");
  }
  return data;
}

function readRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ApiError(400, "INVALID_REVISION", "A valid expected revision is required.");
  }
  return value;
}

function assertExpectedUserId(expectedUserId, authenticatedUserId) {
  if (
    expectedUserId !== undefined &&
    expectedUserId !== authenticatedUserId
  ) {
    throw new ApiError(
      409,
      "ACCOUNT_CHANGED",
      "The signed-in account changed. Reload the page before trying again.",
    );
  }
}

export function validateShiftDate(value) {
  const parsedDate =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00.000Z`)
      : null;
  if (
    !parsedDate ||
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== value
  ) {
    throw new ApiError(400, "INVALID_SHIFT_DATE", "A valid shift date is required.");
  }
  return value;
}

function validateShiftTime(value) {
  if (
    typeof value !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  ) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getManilaClock(date = new Date()) {
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
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  const displayTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    time: `${parts.hour}:${parts.minute}`,
    displayTime,
  };
}

function getShiftRecord(workspaceData, shiftDate) {
  const record = workspaceData?.attendance?.[shiftDate];
  if (
    !isObject(record) ||
    record.type !== "Regular" ||
    record.hasAssignedShift !== true
  ) {
    throw new ApiError(400, "SCHEDULE_REQUIRED", "A saved scheduled shift is required.");
  }
  const shiftStart = validateShiftTime(record.shiftStartTime);
  const shiftEnd = validateShiftTime(record.shiftEndTime);
  if (shiftStart === null || shiftEnd === null) {
    throw new ApiError(400, "INVALID_SCHEDULE", "The saved shift has invalid times.");
  }
  return { record, shiftStart, shiftEnd };
}

function getPunchMinutes(clock, shiftDate, shiftStart, shiftEnd) {
  const overnight = shiftEnd <= shiftStart;
  if (clock.date === shiftDate) return clock.minutes;
  const nextDate = new Date(`${shiftDate}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  if (overnight && clock.date === nextDate.toISOString().slice(0, 10)) {
    return clock.minutes + 1440;
  }
  return -1;
}

export function isWithinClockInWindow({
  clock,
  shiftDate,
  shiftStart,
  shiftEnd,
  earlyWindow = 15,
}) {
  const shiftEndAbsolute = shiftEnd <= shiftStart ? shiftEnd + 1440 : shiftEnd;
  const punchMinutes = getPunchMinutes(clock, shiftDate, shiftStart, shiftEnd);
  return (
    punchMinutes >= shiftStart - earlyWindow &&
    punchMinutes < shiftEndAbsolute
  );
}

export function validateVaultRecord(record) {
  const allowedFields = new Set([
    "ciphertext",
    "nonce",
    "salt",
    "format_version",
    "key_version",
  ]);
  if (
    !isObject(record) ||
    Object.keys(record).some((key) => !allowedFields.has(key)) ||
    typeof record.ciphertext !== "string" ||
    record.ciphertext.length < 24 ||
    record.ciphertext.length > 1_000_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(record.ciphertext) ||
    typeof record.nonce !== "string" ||
    !/^[A-Za-z0-9+/]{16}$/.test(record.nonce) ||
    typeof record.salt !== "string" ||
    !/^[A-Za-z0-9+/]{22}==$/.test(record.salt) ||
    record.format_version !== 1 ||
    !Number.isSafeInteger(record.key_version) ||
    record.key_version < 1
  ) {
    throw new ApiError(400, "INVALID_VAULT", "Encrypted salary-vault data is invalid.");
  }
  return {
    ciphertext: record.ciphertext,
    nonce: record.nonce,
    salt: record.salt,
    format_version: record.format_version,
    key_version: record.key_version,
  };
}

async function getSession(requestHeaders, loadAuth = getAuth) {
  const auth = await loadAuth();
  return auth.api.getSession({ headers: requestHeaders });
}

async function handleApiRequest(
  request,
  response,
  {
    loadMongoDb = getMongoDb,
    loadAuth = getAuth,
    loadConfig = getServerConfig,
  } = {},
) {
  const url = new URL(request.url || "/", "http://localhost");
  const requestHeaders = getRequestHeaders(request.headers);
  const config = loadConfig();
  const method = (request.method || "GET").toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    assertSameOrigin(requestHeaders, config);
  }

  if (url.pathname === "/api/health" && method === "GET") {
    const database = await loadMongoDb();
    await database.command({ ping: 1 });
    success(response, { status: "ok" });
    return;
  }

  if (url.pathname === "/api/session" && method === "GET") {
    const session = await getSession(requestHeaders, loadAuth);
    success(
      response,
      session
        ? {
            user: {
              id: session.user.id,
              email: session.user.email,
              name: session.user.name,
            },
            session: {
              expiresAt: session.session.expiresAt,
              createdAt: session.session.createdAt,
            },
          }
        : null,
    );
    return;
  }

  if (!url.pathname.startsWith("/api/")) {
    throw new ApiError(404, "NOT_FOUND", "API endpoint not found.");
  }

  const session = await getSession(requestHeaders, loadAuth);
  if (!session?.user?.id) {
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in to continue.");
  }
  const userId = session.user.id;
  const database = await loadMongoDb();
  const workspaces = database.collection("workspaces");
  const punches = database.collection("attendance_punches");
  const vaults = database.collection("private_salary_vault");
  const indexSetup = ensurePunchIndex(database);
  await indexSetup;

  if (url.pathname === "/api/workspace" && method === "GET") {
    assertExpectedUserId(url.searchParams.get("expectedUserId") ?? undefined, userId);
    const workspace = await workspaces.findOne({ _id: userId });
    const [punchSettlement, vaultSettlement] = await Promise.allSettled([
      punches
        .find({ userId }, { projection: { shiftDate: 1, attendanceRecord: 1 } })
        .toArray(),
      vaults.findOne({ _id: userId }),
    ]);
    const punchRows =
      punchSettlement.status === "fulfilled" ? punchSettlement.value : [];
    const salaryVault =
      vaultSettlement.status === "fulfilled" ? vaultSettlement.value : null;
    success(response, {
      data: workspace?.data ?? null,
      revision: workspace?.revision ?? 0,
      punchRows: punchRows.map((row) => ({
        shift_date: row.shiftDate,
        attendance_record: row.attendanceRecord,
      })),
      salaryVault: salaryVault
        ? {
            ciphertext: salaryVault.ciphertext,
            nonce: salaryVault.nonce,
            salt: salaryVault.salt,
            format_version: salaryVault.format_version,
            key_version: salaryVault.key_version,
            revision: salaryVault.revision,
            updated_at: salaryVault.updatedAt,
          }
        : null,
      salaryVaultTableAvailable: true,
      salaryVaultLoadError:
          vaultSettlement.status === "rejected"
            ? {
                code: "SALARY_VAULT_LOAD_FAILED",
                message: "Encrypted salary-vault data could not be loaded.",
              }
            : null,
      attendancePunchLoadError:
          punchSettlement.status === "rejected"
            ? {
                code: "ATTENDANCE_PUNCH_LOAD_FAILED",
                message: "Attendance punch records could not be loaded.",
              }
            : null,
    });
    return;
  }

  if (url.pathname === "/api/workspace" && method === "PUT") {
    const body = await readJsonBody(request);
    assertExpectedUserId(body?.expectedUserId, userId);
    const data = validateWorkspaceData(body?.data);
    const expectedRevision = readRevision(body?.expectedRevision);
    const now = new Date();
    let saved;
    if (expectedRevision === 0) {
      try {
        await workspaces.insertOne({
          _id: userId,
          data,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        });
        saved = { revision: 1 };
      } catch (error) {
        if (error?.code === 11000) {
          throw new ApiError(
            409,
            "REVISION_CONFLICT",
            "Workspace changed in another session. Reload cloud data before saving again.",
          );
        }
        throw error;
      }
    } else {
      saved = await workspaces.findOneAndUpdate(
        { _id: userId, revision: expectedRevision },
        { $set: { data, updatedAt: now }, $inc: { revision: 1 } },
        { returnDocument: "after", projection: { revision: 1 } },
      );
      if (!saved) {
        throw new ApiError(
          409,
          "REVISION_CONFLICT",
          "Workspace changed in another session. Reload cloud data before saving again.",
        );
      }
    }
    success(response, { revision: saved.revision });
    return;
  }

  if (url.pathname === "/api/salary-vault" && method === "GET") {
    assertExpectedUserId(url.searchParams.get("expectedUserId") ?? undefined, userId);
    const salaryVault = await vaults.findOne({ _id: userId });
    success(
      response,
      salaryVault
        ? {
            ciphertext: salaryVault.ciphertext,
            nonce: salaryVault.nonce,
            salt: salaryVault.salt,
            format_version: salaryVault.format_version,
            key_version: salaryVault.key_version,
            revision: salaryVault.revision,
            updated_at: salaryVault.updatedAt,
          }
        : null,
    );
    return;
  }

  if (url.pathname === "/api/salary-vault" && method === "PUT") {
    const body = await readJsonBody(request);
    assertExpectedUserId(body?.expectedUserId, userId);
    const record = validateVaultRecord(body?.record);
    const expectedRevision = readRevision(body?.expectedRevision);
    const now = new Date();
    let saved;
    if (expectedRevision === 0) {
      try {
        await vaults.insertOne({
          _id: userId,
          ...record,
          revision: 1,
          updatedAt: now,
        });
        saved = { revision: 1 };
      } catch (error) {
        if (error?.code === 11000) {
          throw new ApiError(
            409,
            "REVISION_CONFLICT",
            "The salary vault changed in another session. Reload it before saving again.",
          );
        }
        throw error;
      }
    } else {
      saved = await vaults.findOneAndUpdate(
        { _id: userId, revision: expectedRevision },
        { $set: { ...record, updatedAt: now }, $inc: { revision: 1 } },
        { returnDocument: "after", projection: { revision: 1 } },
      );
      if (!saved) {
        throw new ApiError(
          409,
          "REVISION_CONFLICT",
          "The salary vault changed in another session. Reload it before saving again.",
        );
      }
    }
    success(response, { revision: saved.revision });
    return;
  }

  if (url.pathname === "/api/punches/clock-in" && method === "POST") {
    const body = await readJsonBody(request);
    assertExpectedUserId(body?.expectedUserId, userId);
    const shiftDate = validateShiftDate(body?.shiftDate);
    const workspace = await workspaces.findOne(
      { _id: userId },
      { projection: { data: 1 } },
    );
    if (!workspace) {
      throw new ApiError(400, "SCHEDULE_REQUIRED", "Save a scheduled shift before clocking in.");
    }
    const { record, shiftStart, shiftEnd } = getShiftRecord(
      workspace.data,
      shiftDate,
    );
    const now = new Date();
    const clock = getManilaClock(now);
    const configuredWindow = Number(workspace.data?.earlyPunchWindowMinutes);
    const earlyWindow =
      Number.isInteger(configuredWindow) && configuredWindow >= 0
        ? Math.min(120, configuredWindow)
        : 15;
    if (
      !isWithinClockInWindow({
        clock,
        shiftDate,
        shiftStart,
        shiftEnd,
        earlyWindow,
      })
    ) {
      throw new ApiError(
        400,
        "PUNCH_WINDOW_CLOSED",
        "The current time is outside the saved shift punch window.",
      );
    }
    const attendanceRecord = {
      ...record,
      in: clock.displayTime,
      out: "—",
      workStartTime: clock.time,
      workEndTime: "",
      clockedIn: true,
      punchSource: "ordinary",
      timeInAt: now.toISOString(),
      timeOutAt: null,
      timeZone: "Asia/Manila",
    };
    try {
      await punches.insertOne({
        userId,
        shiftDate,
        timeIn: now,
        timeOut: null,
        attendanceRecord,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (error?.code === 11000) {
        throw new ApiError(
          409,
          "PUNCH_ALREADY_EXISTS",
          "A time-in is already recorded for this shift.",
        );
      }
      throw error;
    }
    success(response, {
      timeAt: now.toISOString(),
      record: attendanceRecord,
    }, 201);
    return;
  }

  if (url.pathname === "/api/punches/clock-out" && method === "POST") {
    const body = await readJsonBody(request);
    assertExpectedUserId(body?.expectedUserId, userId);
    const shiftDate = validateShiftDate(body?.shiftDate);
    const punch = await punches.findOne({ userId, shiftDate });
    if (!punch || punch.timeOut) {
      throw new ApiError(
        409,
        "ACTIVE_PUNCH_REQUIRED",
        "Time-out requires one active time-in and can only be recorded once.",
      );
    }
    const shiftStart = validateShiftTime(punch.attendanceRecord?.shiftStartTime);
    const shiftEnd = validateShiftTime(punch.attendanceRecord?.shiftEndTime);
    if (shiftStart === null || shiftEnd === null) {
      throw new ApiError(400, "INVALID_SCHEDULE", "The saved shift has invalid times.");
    }
    const now = new Date();
    const clock = getManilaClock(now);
    const punchMinutes = getPunchMinutes(clock, shiftDate, shiftStart, shiftEnd);
    const shiftEndAbsolute = shiftEnd <= shiftStart ? shiftEnd + 1440 : shiftEnd;
    if (punchMinutes < 0 || punchMinutes >= shiftEndAbsolute) {
      throw new ApiError(
        400,
        "PUNCH_WINDOW_CLOSED",
        "The current time is outside the saved shift clock-out window.",
      );
    }
    const attendanceRecord = {
      ...punch.attendanceRecord,
      out: clock.displayTime,
      workEndTime: clock.time,
      clockedIn: false,
      timeOutAt: now.toISOString(),
      timeZone: "Asia/Manila",
    };
    const updated = await punches.findOneAndUpdate(
      { _id: punch._id, userId, timeOut: null },
      {
        $set: {
          timeOut: now,
          attendanceRecord,
          updatedAt: now,
        },
      },
      { returnDocument: "after", projection: { attendanceRecord: 1 } },
    );
    if (!updated) {
      throw new ApiError(
        409,
        "ACTIVE_PUNCH_REQUIRED",
        "Time-out requires one active time-in and can only be recorded once.",
      );
    }
    success(response, {
      timeAt: now.toISOString(),
      record: updated.attendanceRecord,
    });
    return;
  }

  throw new ApiError(404, "NOT_FOUND", "API endpoint not found.");
}

export async function handleApiRequestWithErrors(request, response, dependencies) {
  try {
    await handleApiRequest(request, response, dependencies);
  } catch (error) {
    const status = error instanceof ServerConfigError
      ? 503
      : Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
        ? error.status
        : 500;
    const code =
      typeof error?.code === "string"
        ? error.code
        : error instanceof ServerConfigError
          ? "CONFIGURATION_ERROR"
          : "INTERNAL_ERROR";
    if (status >= 500) {
      console.error("TimeCloud API request failed.", {
        code,
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }
    respond(response, status, {
      error: {
        code,
        message:
          status >= 500
            ? "The request could not be completed."
            : error instanceof Error
              ? error.message
              : "The request could not be completed.",
      },
    });
  }
}

const punchIndexes = new WeakMap();

async function ensurePunchIndex(database) {
  let indexPromise = punchIndexes.get(database);
  if (!indexPromise) {
    const pending = database
      .collection("attendance_punches")
      .createIndex(
        { userId: 1, shiftDate: 1 },
        { unique: true, name: "user_shift_once" },
      );
    indexPromise = pending;
    punchIndexes.set(database, pending);
    pending.catch(() => {
      if (punchIndexes.get(database) === pending) {
        punchIndexes.delete(database);
      }
    });
  }
  return indexPromise;
}