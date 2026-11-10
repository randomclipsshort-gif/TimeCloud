import test from "node:test";
import assert from "node:assert/strict";
import {
  getMongoConfig,
  getServerConfig,
  ServerConfigError,
} from "../src/config/config.js";
import { createMongoDbGetter } from "../src/config/mongodb.js";

const validEnv = {
  MONGODB_URI: "mongodb://user:password@localhost:27017",
  MONGODB_DB_NAME: "timecloud",
  AUTH_SECRET: "a".repeat(32),
  APP_ORIGIN: "https://app.example.com",
  API_ORIGIN: "https://api.example.com",
};

test("MongoDB configuration requires a URI and database name", () => {
  assert.throws(
    () => getMongoConfig({ MONGODB_URI: validEnv.MONGODB_URI }),
    (error) => error instanceof ServerConfigError && /MONGODB_DB_NAME/.test(error.message),
  );
  assert.throws(
    () => getMongoConfig({ MONGODB_URI: "postgres://private", MONGODB_DB_NAME: "timecloud" }),
    (error) => error instanceof ServerConfigError && !error.message.includes("private"),
  );
});

test("server configuration validates frontend/API origins, secret, and optional SMTP", () => {
  assert.throws(
    () => getServerConfig({ ...validEnv, AUTH_SECRET: "short" }),
    /at least 32 bytes/,
  );
  assert.throws(
    () => getServerConfig({ ...validEnv, APP_ORIGIN: "http://example.com" }),
    /HTTPS origin/,
  );
  assert.throws(
    () => getServerConfig({ ...validEnv, SMTP_URL: "smtps://smtp.example.com" }),
    /both SMTP_URL and SMTP_FROM/,
  );
  assert.equal(
    getServerConfig({
      ...validEnv,
      APP_ORIGIN: "http://localhost:5173",
      API_ORIGIN: "http://localhost:10000",
    }).appOrigin,
    "http://localhost:5173",
  );
  const config = getServerConfig(validEnv);
  assert.equal(config.appOrigin, "https://app.example.com");
  assert.equal(config.apiOrigin, "https://api.example.com");
  assert.equal(
    getServerConfig({ ...validEnv, API_ORIGIN: "" }).apiOrigin,
    validEnv.APP_ORIGIN,
  );
});

test("MongoDB getter reuses a connected client and database", async () => {
  const cache = {};
  let connectCount = 0;
  let clientCount = 0;
  let initializationCount = 0;
  const expectedDb = { collection: () => ({}) };
  class FakeMongoClient {
    constructor(uri, options) {
      assert.equal(uri, validEnv.MONGODB_URI);
      assert.equal(options.maxPoolSize, 10);
      clientCount += 1;
    }

    async connect() {
      connectCount += 1;
      return this;
    }

    db(name) {
      assert.equal(name, "timecloud");
      return expectedDb;
    }
  }
  const getDb = createMongoDbGetter({
    getEnv: () => validEnv,
    createClient: (uri, options) => new FakeMongoClient(uri, options),
    initializeDatabase: async (database) => {
      assert.equal(database, expectedDb);
      initializationCount += 1;
    },
    cache,
  });

  assert.equal(await getDb(), expectedDb);
  assert.equal(await getDb(), expectedDb);
  assert.equal(clientCount, 1);
  assert.equal(connectCount, 1);
  assert.equal(initializationCount, 1);
});

test("MongoDB getter clears a failed connection so the next request can retry", async () => {
  const cache = {};
  let connectCount = 0;
  let closeCount = 0;
  const getDb = createMongoDbGetter({
    getEnv: () => validEnv,
    createClient: () => ({
      async connect() {
        connectCount += 1;
        throw new Error("private connection details");
      },
      async close() {
        closeCount += 1;
      },
    }),
    cache,
  });

  await assert.rejects(getDb(), /MongoDB connection or fresh database initialization failed/);
  await assert.rejects(getDb(), /MongoDB connection or fresh database initialization failed/);
  assert.equal(connectCount, 2);
  assert.equal(closeCount, 2);
});
