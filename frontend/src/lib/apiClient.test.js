import test from "node:test";
import assert from "node:assert/strict";
import { loadWorkspace } from "./workspace.js";

test("workspace loads send credentials to session, workspace, and private-data endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    const requestUrl = new URL(String(url), "http://localhost");
    const data = requestUrl.pathname.endsWith("/session")
      ? {
          user: { id: "user-1" },
          session: { createdAt: "2026-11-11T00:00:00.000Z" },
        }
      : requestUrl.pathname.endsWith("/private-financial-data")
        ? { data: null, revision: 0, legacyVault: null }
        : {
            data: null,
            revision: 0,
            punchRows: [],
            attendancePunchLoadError: null,
          };
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await loadWorkspace("user-1");

    assert.deepEqual(
      requests.map(({ url }) => new URL(url, "http://localhost").pathname).sort(),
      [
        "/api/private-financial-data",
        "/api/session",
        "/api/workspace",
      ],
    );
    assert.ok(requests.every(({ options }) => options.credentials === "include"));
    assert.ok(requests.every(({ options }) => options.cache === "no-store"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
