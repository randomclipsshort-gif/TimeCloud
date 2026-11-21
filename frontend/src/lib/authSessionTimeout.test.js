import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_IDLE_TIMEOUT_MS,
  getInitialAuthActivityTimestamp,
  getAuthActivityStorageKey,
  isAuthSessionExpired,
  parseAuthActivityTimestamp,
} from "./authSessionTimeout.js";

test("auth inactivity expires at the one-hour threshold", () => {
  const lastActivity = 1_800_000_000_000;

  assert.equal(isAuthSessionExpired(lastActivity, lastActivity + AUTH_IDLE_TIMEOUT_MS - 1), false);
  assert.equal(isAuthSessionExpired(lastActivity, lastActivity + AUTH_IDLE_TIMEOUT_MS), true);
});

test("invalid or future activity timestamps do not expire a session", () => {
  assert.equal(parseAuthActivityTimestamp("not-a-timestamp"), null);
  assert.equal(parseAuthActivityTimestamp("-1"), null);
  assert.equal(isAuthSessionExpired(Number.NaN, 1_800_000_000_000), false);
  assert.equal(isAuthSessionExpired(1_800_000_000_001, 1_800_000_000_000), false);
});

test("activity timestamps are scoped to the signed-in user", () => {
  assert.equal(
    getAuthActivityStorageKey("user-123"),
    "timecloud:auth:last-activity:user-123",
  );
  assert.equal(parseAuthActivityTimestamp("1800000000000"), 1_800_000_000_000);
});

test("a previous session's activity timestamp does not expire a new session", () => {
  const previousActivity = 1_800_000_000_000;
  const newSessionCreatedAt = previousActivity + AUTH_IDLE_TIMEOUT_MS + 1;

  assert.equal(
    getInitialAuthActivityTimestamp(previousActivity, newSessionCreatedAt),
    newSessionCreatedAt,
  );
});

test("activity within the current session is preserved", () => {
  const sessionCreatedAt = 1_800_000_000_000;
  const currentActivity = sessionCreatedAt + 5_000;

  assert.equal(
    getInitialAuthActivityTimestamp(currentActivity, sessionCreatedAt),
    currentActivity,
  );
});
