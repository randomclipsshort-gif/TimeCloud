import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";

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

function createDatabase() {
  return {
    async command(command) {
      assert.deepEqual(command, { ping: 1 });
    },
    collection() {
      return {
        async createIndex() {},
      };
    },
  };
}

const config = {
  appOrigin: "http://localhost:5173",
  apiOrigin: "http://localhost:10000",
};
const productionConfig = { ...config, isProduction: true };
const gatewaySecret = "a".repeat(64);
const productionEnv = {
  NODE_ENV: "production",
  TIMECLOUD_GATEWAY_SECRET: gatewaySecret,
};

function gatewayHeaders(clientIp, extraHeaders = {}) {
  return {
    "x-timecloud-gateway-secret": gatewaySecret,
    "x-timecloud-client-ip": clientIp,
    ...extraHeaders,
  };
}

test("Express health endpoint checks MongoDB and returns JSON", async () => {
  const app = createApp({
    config,
    loadMongoDb: async () => createDatabase(),
  });

  await withServer(app, async (origin) => {
    const response = await fetch(`${origin}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });
});

test("Express CORS permits credentialed requests only from the configured app", async () => {
  const app = createApp({
    config,
    loadMongoDb: async () => createDatabase(),
    loadAuth: async () => ({ api: { getSession: async () => null } }),
  });

  await withServer(app, async (origin) => {
    const allowed = await fetch(`${origin}/api/session`, {
      headers: { origin: config.appOrigin },
    });
    assert.equal(allowed.headers.get("access-control-allow-origin"), config.appOrigin);
    assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
    assert.equal(allowed.status, 200);

    const rejected = await fetch(`${origin}/api/session`, {
      headers: { origin: "https://attacker.example" },
    });
    assert.equal(rejected.headers.get("access-control-allow-origin"), null);
    assert.equal(rejected.status, 200);
  });
});

test("Express handles credentialed browser preflight", async () => {
  const app = createApp({ config });

  await withServer(app, async (origin) => {
    const response = await fetch(`${origin}/api/workspace`, {
      method: "OPTIONS",
      headers: {
        origin: config.appOrigin,
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type",
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), config.appOrigin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.match(response.headers.get("access-control-allow-methods"), /PUT/);
  });
});

test("production gateway authenticates requests and passes only the canonical IP to Better Auth", async () => {
  let receivedHeaders;
  const app = createApp({
    config: productionConfig,
    env: productionEnv,
    loadAuth: async () => ({
      api: {
        async getSession({ headers }) {
          receivedHeaders = headers;
          return null;
        },
      },
    }),
  });

  await withServer(app, async (origin) => {
    const response = await fetch(`${origin}/api/session`, {
      headers: {
        ...gatewayHeaders("198.51.100.20", {
          "x-forwarded-for": "203.0.113.10",
          "x-real-ip": "203.0.113.11",
          "x-vercel-forwarded-for": "203.0.113.12",
        }),
      },
    });
    assert.equal(response.status, 200);
    assert.equal(receivedHeaders.get("x-timecloud-client-ip"), "198.51.100.20");
    assert.equal(receivedHeaders.has("x-timecloud-gateway-secret"), false);
    assert.equal(receivedHeaders.has("x-forwarded-for"), false);
    assert.equal(receivedHeaders.has("x-real-ip"), false);
    assert.equal(receivedHeaders.has("x-vercel-forwarded-for"), false);
  });
});

test("production API and Better Auth routes reject requests without valid gateway authentication", async () => {
  let authLoads = 0;
  let limiterCalls = 0;
  const app = createApp({
    config: productionConfig,
    env: productionEnv,
    apiRateLimitMiddleware: (_request, _response, next) => {
      limiterCalls += 1;
      next();
    },
    loadAuth: async () => {
      authLoads += 1;
      return { api: { getSession: async () => null } };
    },
  });

  await withServer(app, async (origin) => {
    for (const path of ["/api/session", "/api/auth/get-session"]) {
      const response = await fetch(`${origin}${path}`, {
        headers: {
          "x-timecloud-client-ip": "203.0.113.20",
          "x-forwarded-for": "203.0.113.21",
          "x-real-ip": "203.0.113.22",
        },
      });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, "GATEWAY_AUTH_REQUIRED");
    }
    assert.equal(authLoads, 0);
    assert.equal(limiterCalls, 0);
  });
});

test("production gateway rejects an invalid supplied secret", async () => {
  let authLoads = 0;
  const app = createApp({
    config: productionConfig,
    env: productionEnv,
    loadAuth: async () => {
      authLoads += 1;
      return { api: { getSession: async () => null } };
    },
  });

  await withServer(app, async (origin) => {
    for (const suppliedSecret of ["b".repeat(64), "short"]) {
      const response = await fetch(`${origin}/api/session`, {
        headers: gatewayHeaders("198.51.100.20", {
          "x-timecloud-gateway-secret": suppliedSecret,
        }),
      });
      assert.equal(response.status, 401);
    }
    assert.equal(authLoads, 0);
  });
});

test("production gateway rejects requests when its configured secret is missing or malformed", async () => {
  const invalidEnvironments = [
    { NODE_ENV: "production" },
    { NODE_ENV: "production", TIMECLOUD_GATEWAY_SECRET: "too-short" },
  ];

  for (const env of invalidEnvironments) {
    let authLoads = 0;
    const app = createApp({
      config: productionConfig,
      env,
      loadAuth: async () => {
        authLoads += 1;
        return { api: { getSession: async () => null } };
      },
    });

    await withServer(app, async (origin) => {
      const response = await fetch(`${origin}/api/session`, {
        headers: gatewayHeaders("198.51.100.20"),
      });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, "API_UNAVAILABLE");
      assert.equal(authLoads, 0);
    });
  }
});

test("production gateway rejects missing and invalid canonical IPs before application handlers", async () => {
  let authLoads = 0;
  const app = createApp({
    config: productionConfig,
    env: productionEnv,
    loadAuth: async () => {
      authLoads += 1;
      return { api: { getSession: async () => null } };
    },
  });
  const invalidIps = [undefined, "not-an-ip", "198.51.100.20,203.0.113.20"];

  await withServer(app, async (origin) => {
    for (const clientIp of invalidIps) {
      const headers = gatewayHeaders(clientIp);
      if (clientIp === undefined) delete headers["x-timecloud-client-ip"];
      const response = await fetch(`${origin}/api/session`, { headers });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, "INVALID_CLIENT_IP");
    }
    assert.equal(authLoads, 0);
  });
});

test("production health checks remain available while the API health route is protected", async () => {
  const app = createApp({
    config: productionConfig,
    env: productionEnv,
    loadMongoDb: async () => createDatabase(),
  });

  await withServer(app, async (origin) => {
    const health = await fetch(`${origin}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    const untrustedApiHealth = await fetch(`${origin}/api/health`);
    assert.equal(untrustedApiHealth.status, 401);

    const trustedApiHealth = await fetch(`${origin}/api/health`, {
      headers: gatewayHeaders("198.51.100.20"),
    });
    assert.equal(trustedApiHealth.status, 200);
  });
});

test("local auth ignores a client-supplied internal IP header", async () => {
  let receivedHeaders;
  const app = createApp({
    config,
    env: { NODE_ENV: "development" },
    loadAuth: async () => ({
      api: {
        async getSession({ headers }) {
          receivedHeaders = headers;
          return null;
        },
      },
    }),
  });

  await withServer(app, async (origin) => {
    const response = await fetch(`${origin}/api/session`, {
      headers: {
        "x-timecloud-client-ip": "203.0.113.99",
        "x-timecloud-gateway-secret": gatewaySecret,
        "x-forwarded-for": "203.0.113.100",
        "x-real-ip": "203.0.113.101",
      },
    });
    assert.equal(response.status, 200);
    assert.equal(receivedHeaders.has("x-timecloud-client-ip"), false);
    assert.equal(receivedHeaders.has("x-timecloud-gateway-secret"), false);
    assert.equal(receivedHeaders.has("x-forwarded-for"), false);
    assert.equal(receivedHeaders.has("x-real-ip"), false);
    assert.equal(app.get("trust proxy"), false);
  });
});

test("NODE_ENV production cannot use the local gateway bypass", async () => {
  const app = createApp({
    config: { ...config, isProduction: false },
    env: { NODE_ENV: "production" },
  });

  await withServer(app, async (origin) => {
    const response = await fetch(`${origin}/api/session`);
    assert.equal(response.status, 503);
  });
});
