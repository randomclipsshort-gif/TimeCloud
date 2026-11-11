import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
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
    "content-encoding": "br",
    "content-length": "25",
  });
  for (const cookie of cookies) upstreamHeaders.append("set-cookie", cookie);
  let upstreamUrl;
  let upstreamOptions;
  let diagnostic;
  const originalInfo = console.info;
  console.info = (message, details) => {
    diagnostic = { message, details };
  };
  const handler = createProxyHandler({
    env: { RENDER_API_URL: "https://timecloud.onrender.com" },
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

  try {
    await handler({
      method: "GET",
      url: "/api/proxy?__tc_path=%2Fapi%2Fauth%2Fget-session&probe=1",
      headers: {
        cookie: "timecloud.session_token=old",
        origin: "https://time-cloud.vercel.app",
        connection: "keep-alive",
      },
    }, response);
  } finally {
    console.info = originalInfo;
  }

  assert.equal(
    upstreamUrl.href,
    "https://timecloud.onrender.com/api/auth/get-session?probe=1",
  );
  assert.equal(upstreamOptions.headers.get("cookie"), "timecloud.session_token=old");
  assert.equal(upstreamOptions.headers.get("origin"), "https://time-cloud.vercel.app");
  assert.equal(upstreamOptions.headers.get("accept-encoding"), "identity");
  assert.equal(upstreamOptions.headers.has("connection"), false);
  assert.deepEqual(response.headers.get("set-cookie"), cookies);
  assert.equal(response.headers.get("content-encoding"), undefined);
  assert.equal(response.headers.get("content-length"), undefined);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.toString(), '{"data":{"user":null}}');
  assert.deepEqual(diagnostic, {
    message: "TimeCloud Render API response.",
    details: {
      status: 200,
      path: "/api/auth/get-session",
      contentType: "application/json",
      contentEncoding: "br",
    },
  });
});

test("Vercel API proxy forwards methods and JSON request bodies without logging them", async () => {
  const cases = [
    { method: "POST", body: '{"password":"password-marker","token":"session-token-marker"}' },
    { method: "PATCH", body: '{"action":"patch"}' },
    { method: "PUT", body: '{"action":"replace"}' },
    { method: "DELETE", body: '{"action":"delete"}' },
    { method: "HEAD" },
  ];
  const diagnostics = [];
  const originalInfo = console.info;
  console.info = (message, details) => diagnostics.push({ message, details });

  try {
    for (const { method, body } of cases) {
      let forwardedOptions;
      let forwardedBody = "";
      const requestBody = body
        ? Readable.from([Buffer.from(body)])
        : undefined;
      const handler = createProxyHandler({
        env: { RENDER_API_URL: "https://timecloud.onrender.com" },
        fetchImpl: async (_url, options) => {
          forwardedOptions = options;
          if (options.body) {
            const chunks = [];
            for await (const chunk of options.body) chunks.push(Buffer.from(chunk));
            forwardedBody = Buffer.concat(chunks).toString("utf8");
          }
          return new Response(null, { status: method === "HEAD" ? 204 : 202 });
        },
      });
      const response = createResponse();
      const request = {
        method,
        url: "/api/proxy?__tc_path=%2Fapi%2Fworkspace",
        headers: {
          cookie: "timecloud.session_token=session-token-marker",
          "content-type": "application/json",
        },
      };
      if (requestBody) {
        request[Symbol.asyncIterator] =
          requestBody[Symbol.asyncIterator].bind(requestBody);
      }

      await handler(request, response);

      assert.equal(forwardedOptions.method, method);
      assert.equal(forwardedOptions.redirect, "manual");
      assert.equal(
        forwardedOptions.body === undefined,
        method === "HEAD",
        `${method} body forwarding`,
      );
      if (body) {
        assert.equal(forwardedOptions.duplex, "half");
        assert.equal(forwardedBody, body);
      } else {
        assert.equal(forwardedOptions.duplex, undefined);
      }
      assert.equal(response.statusCode, method === "HEAD" ? 204 : 202);
    }
  } finally {
    console.info = originalInfo;
  }

  const logText = JSON.stringify(diagnostics);
  assert.equal(logText.includes("password-marker"), false);
  assert.equal(logText.includes("session-token-marker"), false);
  assert.equal(logText.includes("timecloud.session_token"), false);
});

test("Vercel API proxy failure logs do not include sensitive request data", async () => {
  const sensitiveValues = [
    "password-marker",
    "session-token-marker",
    "timecloud.session_token=session-token-marker",
  ];
  let diagnostic;
  const originalError = console.error;
  console.error = (message, details) => {
    diagnostic = { message, details };
  };
  const handler = createProxyHandler({
    env: { RENDER_API_URL: "https://timecloud.onrender.com" },
    fetchImpl: async () => {
      throw new Error(sensitiveValues.join(" "));
    },
  });
  const response = createResponse();
  const requestBody = Readable.from([
    Buffer.from(JSON.stringify({ password: sensitiveValues[0] })),
  ]);

  try {
    await handler({
      method: "POST",
      url: "/api/proxy?__tc_path=%2Fapi%2Fauth%2Fsign-in%2Femail",
      headers: {
        cookie: sensitiveValues[2],
        "content-type": "application/json",
      },
      [Symbol.asyncIterator]:
        requestBody[Symbol.asyncIterator].bind(requestBody),
    }, response);
  } finally {
    console.error = originalError;
  }

  assert.equal(response.statusCode, 502);
  assert.equal(diagnostic.message, "TimeCloud Render API request failed.");
  assert.deepEqual(diagnostic.details, { name: "Error" });
  const logText = JSON.stringify(diagnostic);
  for (const value of sensitiveValues) {
    assert.equal(logText.includes(value), false);
  }
});

test("Vercel API proxy preserves manual redirect status and Location header", async () => {
  let forwardedOptions;
  const handler = createProxyHandler({
    env: { RENDER_API_URL: "https://timecloud.onrender.com" },
    fetchImpl: async (_url, options) => {
      forwardedOptions = options;
      return new Response(null, {
        status: 302,
        headers: { location: "https://time-cloud.vercel.app/sign-in" },
      });
    },
  });
  const response = createResponse();

  await handler({
    method: "POST",
    url: "/api/proxy?__tc_path=%2Fapi%2Fauth%2Fsign-in%2Femail",
    headers: {},
  }, response);

  assert.equal(forwardedOptions.redirect, "manual");
  assert.equal(response.statusCode, 302);
  assert.equal(
    response.headers.get("location"),
    "https://time-cloud.vercel.app/sign-in",
  );
});

test("Vercel API proxy rejects request URLs that could escape the configured Render origin", async () => {
  let forwarded = false;
  const handler = createProxyHandler({
    env: { RENDER_API_URL: "https://timecloud.onrender.com" },
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
