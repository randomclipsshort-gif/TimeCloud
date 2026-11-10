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
