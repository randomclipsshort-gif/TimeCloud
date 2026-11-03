export const AUTH_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const AUTH_ACTIVITY_WRITE_INTERVAL_MS = 10 * 1000;

export function getAuthActivityStorageKey(userId) {
  return `timecloud:auth:last-activity:${userId}`;
}

export function parseAuthActivityTimestamp(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) && timestamp > 0 ? timestamp : null;
}

export function isAuthSessionExpired(
  lastActivityAt,
  now = Date.now(),
  timeout = AUTH_IDLE_TIMEOUT_MS,
) {
  return Number.isFinite(lastActivityAt) &&
    Number.isFinite(now) &&
    Number.isFinite(timeout) &&
    timeout > 0 &&
    now >= lastActivityAt &&
    now - lastActivityAt >= timeout;
}
