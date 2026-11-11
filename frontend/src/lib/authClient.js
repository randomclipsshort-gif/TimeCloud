import { useCallback, useEffect, useState } from "react";
import { getApiBaseUrl } from "./apiBaseUrl.js";

const configuredApiOrigin = getApiBaseUrl(
  import.meta.env?.VITE_API_BASE_URL,
  import.meta.env?.PROD,
);
const authBasePath = `${configuredApiOrigin || ""}/api/auth`;
const sessionListeners = new Set();
let sessionRequest;
let sessionRequestVersion = 0;
let sessionSnapshot = {
  data: null,
  isPending: true,
  error: null,
};

function publishSession(snapshot) {
  sessionSnapshot = snapshot;
  for (const listener of sessionListeners) listener(snapshot);
}

async function request(path, { method = "POST", body } = {}) {
  let response;
  try {
    response = await fetch(`${authBasePath}${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return {
      data: null,
      error: { message: "The authentication service could not be reached." },
    };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return {
      data: null,
      error: { message: "The authentication service returned an invalid response." },
    };
  }

  if (!response.ok) {
    return {
      data: null,
      error: {
        message:
          data?.message ||
          data?.error?.message ||
          "The authentication request could not be completed.",
        code: data?.code || data?.error?.code,
        status: response.status,
      },
    };
  }
  return { data, error: null };
}

function refreshSession({ force = false } = {}) {
  if (sessionRequest && !force) return sessionRequest;

  const requestVersion = ++sessionRequestVersion;
  const pendingRequest = request("/get-session", { method: "GET" })
    .then((result) => {
      if (requestVersion === sessionRequestVersion) {
        publishSession({
          data: result.error ? null : result.data,
          isPending: false,
          error: result.error,
        });
      }
      return result;
    })
    .finally(() => {
      if (sessionRequest === pendingRequest) sessionRequest = null;
    });
  sessionRequest = pendingRequest;
  return pendingRequest;
}

async function mutate(path, body) {
  const result = await request(path, { body });
  if (
    !result.error &&
    [
      "/sign-in/email",
      "/sign-up/email",
      "/sign-out",
      "/delete-user",
    ].includes(path)
  ) {
    const sessionResult = await refreshSession({ force: true });
    if (
      path === "/sign-in/email" &&
      (sessionResult.error ||
        !sessionResult.data?.user?.id ||
        !sessionResult.data?.session)
    ) {
      const error = {
        message:
          sessionResult.error?.message ||
          "The sign-in request succeeded, but no authenticated session was established. Check the API proxy and cookie settings.",
        code: "SESSION_NOT_ESTABLISHED",
      };
      if (sessionResult.error?.status) error.status = sessionResult.error.status;
      console.warn("Better Auth sign-in did not establish a session.", {
        status: sessionResult.error?.status ?? 200,
        code: error.code,
      });
      return { data: null, error };
    }
  }
  return result;
}

function useSession() {
  const [snapshot, setSnapshot] = useState(sessionSnapshot);
  const refetch = useCallback(() => refreshSession(), []);

  useEffect(() => {
    sessionListeners.add(setSnapshot);
    void refreshSession();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshSession();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      sessionListeners.delete(setSnapshot);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return { ...snapshot, refetch };
}

export const authClient = {
  useSession,
  signIn: {
    email: (input) => mutate("/sign-in/email", input),
  },
  signUp: {
    email: (input) => mutate("/sign-up/email", input),
  },
  signOut: () => mutate("/sign-out"),
  requestPasswordReset: (input) =>
    mutate("/request-password-reset", input),
  resetPassword: (input) => mutate("/reset-password", input),
  deleteUser: (input) => mutate("/delete-user", input),
};
