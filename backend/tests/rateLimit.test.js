import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";
import { createApiRateLimit } from "../src/middleware/apiRateLimit.js";

const config = {
  appOrigin: "https://time-cloud.vercel.app",
  apiOrigin: "https://timecloud.onrender.com",
  isProduction: true,
};
const gatewaySecret = "a".repeat(64);

async function withServer(app, run) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function gatewayHeaders(clientIp, extraHeaders = {}) {
  return {
    "x-timecloud-gateway-secret": gatewaySecret,
    "x-timecloud-client-ip": clientIp,
    ...extraHeaders,
  };
}

test("API rate limits share buckets by canonical IP and separate different IPs", async () => {
  let authLoads = 0;
  const app = createApp({
    config,
    env: {
      NODE_ENV: "production",
      TIMECLOUD_GATEWAY_SECRET: gatewaySecret,
    },
    apiRateLimitMiddleware: createApiRateLimit({ limit: 1, windowMs: 60_000 }),
    loadAuth: async () => {
      authLoads += 1;
      return { api: { getSession: async () => null } };
    },
  });

  await withServer(app, async (origin) => {
    const first = await fetch(`${origin}/api/session`, {
      headers: gatewayHeaders("198.51.100.20", {
        "x-forwarded-for": "203.0.113.20",
      }),
    });
    assert.equal(first.status, 200);

    const sameClient = await fetch(`${origin}/api/session`, {
      headers: gatewayHeaders("198.51.100.20", {
        "x-forwarded-for": "192.0.2.90",
        "x-real-ip": "192.0.2.91",
      }),
    });
    assert.equal(sameClient.status, 429);

    const differentClient = await fetch(`${origin}/api/session`, {
      headers: gatewayHeaders("198.51.100.21"),
    });
    assert.equal(differentClient.status, 200);
    assert.equal(authLoads, 2);
  });
});