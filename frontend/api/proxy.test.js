import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createProxyHandler } from "./proxy.js";

function createResponse() {
  const headers = new Map();
  return {
    headers,
    statusCode: 200,
    body: null,
    headersSent: false,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    end(body) {
      this.body = body;
      this.headersSent = true;
    },
  };
}

test("Vercel routes nested API requests to the shared proxy function", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(config.rewrites, [
    {
      source: "/api/:path*",
      destination: "/api/proxy?__tc_path=/api/:path*",
    },
  ]);
});

test("Vercel API proxy forwards rewritten nested requests, query, and auth cookies", async () => {
  const cookies = [
    "timecloud.session_token=one; Path=/; HttpOnly; Secure; SameSite=None",
    "timecloud.session_data=two; Path=/; HttpOnly; Secure; SameSite=None",
  ];
  const upstreamHeaders = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  for (const cookie of cookies) upstreamHeaders.append("set-cookie", cookie);
  let upstreamUrl;
  let upstreamOptions;
  const handler = createProxyHandler({
    env: { RENDER_API_URL: "https://timecloud-api.onrender.com" },
    fetchImpl: async (url, options) => {
      upstreamUrl = url;
      upstreamOptions = options;
      return new Response('{"data":{"user":null}}', {
        status: 200,
        headers: upstreamHeaders,
      });
    },
  });
  const response = createResponse();

  await handler({
    method: "GET",
    url: "/api/proxy?__tc_path=%2Fapi%2Fauth%2Fget-session&probe=1",
    headers: {
      cookie: "timecloud.session_token=old",
      origin: "https://time-cloud.vercel.app",
      connection: "keep-alive",
    },
  }, response);

  assert.equal(
    upstreamUrl.href,
    "https://timecloud-api.onrender.com/api/auth/get-session?probe=1",
  );
  assert.equal(upstreamOptions.headers.get("cookie"), "timecloud.session_token=old");
  assert.equal(upstreamOptions.headers.get("origin"), "https://time-cloud.vercel.app");
  assert.equal(upstreamOptions.headers.has("connection"), false);
  assert.deepEqual(response.headers.get("set-cookie"), cookies);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.toString(), '{"data":{"user":null}}');
});

test("Vercel API proxy rejects request URLs that could escape the configured Render origin", async () => {
  let forwarded = false;
  const handler = createProxyHandler({
    env: { RENDER_API_URL: "https://timecloud-api.onrender.com" },
    fetchImpl: async () => {
      forwarded = true;
      return new Response("unexpected");
    },
  });
  const response = createResponse();

  await handler({
    method: "GET",
    url: "/api/proxy?__tc_path=https%3A%2F%2Fattacker.example%2Fapi%2Fhealth",
    headers: {},
  }, response);

  assert.equal(forwarded, false);
  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).error.code, "INVALID_PROXY_PATH");
});
