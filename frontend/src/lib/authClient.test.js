import test from "node:test";
import assert from "node:assert/strict";
import { authClient } from "./authClient.js";

test("frontend auth client calls Better Auth through the same-origin API", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    const body = options?.method === "GET"
      ? { user: { id: "user-1" }, session: { id: "session-1" } }
      : { token: "session-token" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await authClient.signIn.email({
      email: "person@example.com",
      password: "example-password",
    });

    assert.deepEqual(result, {
      data: { token: "session-token" },
      error: null,
    });
    assert.equal(requests[0].url, "/api/auth/sign-in/email");
    assert.equal(requests[0].options.credentials, "include");
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      email: "person@example.com",
      password: "example-password",
    });
    assert.equal(requests[1].url, "/api/auth/get-session");
    assert.equal(requests[1].options.method, "GET");
    assert.equal(requests[1].options.credentials, "include");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("registration and logout refresh session state using credentialed requests", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  let signedIn = true;
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith("/get-session")) {
      return new Response(
        JSON.stringify(
          signedIn
            ? { user: { id: "user-1" }, session: { id: "session-1" } }
            : null,
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (String(url).endsWith("/sign-out")) signedIn = false;
    if (String(url).endsWith("/sign-in/email")) signedIn = true;
    return new Response(JSON.stringify({ token: "session-token" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const registration = await authClient.signUp.email({
      name: "Person",
      email: "person@example.com",
      password: "example-password",
    });
    const logout = await authClient.signOut();
    const loginAfterLogout = await authClient.signIn.email({
      email: "person@example.com",
      password: "example-password",
    });

    assert.equal(registration.error, null);
    assert.equal(logout.error, null);
    assert.equal(loginAfterLogout.error, null);
    assert.deepEqual(
      requests.map(({ url }) => url),
      [
        "/api/auth/sign-up/email",
        "/api/auth/get-session",
        "/api/auth/sign-out",
        "/api/auth/get-session",
        "/api/auth/sign-in/email",
        "/api/auth/get-session",
      ],
    );
    assert.ok(requests.every(({ options }) => options.credentials === "include"));
    assert.equal(requests[1].options.method, "GET");
    assert.equal(requests[3].options.method, "GET");
    assert.equal(requests[5].options.method, "GET");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("frontend auth client returns server errors in the established error shape", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ message: "Invalid credentials", code: "INVALID_EMAIL_OR_PASSWORD" }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    },
  );

  try {
    const result = await authClient.signIn.email({
      email: "person@example.com",
      password: "wrong-password",
    });
    assert.equal(result.data, null);
    assert.deepEqual(result.error, {
      message: "Invalid credentials",
      code: "INVALID_EMAIL_OR_PASSWORD",
      status: 401,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
