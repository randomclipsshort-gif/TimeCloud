import test from "node:test";
import assert from "node:assert/strict";
import {
  FreshDatabaseError,
  initializeFreshDatabase,
} from "../src/services/initializeDatabase.js";

function createDatabase(initialCollections = {}) {
  const collections = new Map(
    Object.entries(initialCollections).map(([name, documents]) => [
      name,
      structuredClone(documents),
    ]),
  );
  const indexes = [];
  return {
    collections,
    indexes,
    collection(name) {
      return {
        async findOne(filter) {
          return collections.get(name)?.find((document) =>
            Object.entries(filter).every(([key, value]) => document[key] === value),
          ) ?? null;
        },
        async insertOne(document) {
          if (!collections.has(name)) collections.set(name, []);
          if (collections.get(name).some((item) => item._id === document._id)) {
            throw Object.assign(new Error("Duplicate key"), { code: 11000 });
          }
          collections.get(name).push(structuredClone(document));
        },
        async createIndex(keys, options) {
          indexes.push({ collection: name, keys, options });
        },
      };
    },
    async createCollection(name) {
      if (collections.has(name)) {
        throw Object.assign(new Error("Collection already exists"), { code: 48 });
      }
      collections.set(name, []);
    },
    listCollections(filter = {}) {
      const names = [...collections.keys()].filter(
        (name) => !filter.name || filter.name === name,
      );
      return {
        async toArray() {
          return names.map((name) => ({ name }));
        },
        async hasNext() {
          return names.length > 0;
        },
      };
    },
  };
}

test("fresh database initialization creates empty app collections and unique punch index", async () => {
  const database = createDatabase();

  await initializeFreshDatabase(database);

  assert.deepEqual([...database.collections.keys()].sort(), [
    "attendance_punches",
    "private_salary_vault",
    "timecloud_metadata",
    "workspaces",
  ]);
  assert.deepEqual(database.collections.get("workspaces"), []);
  assert.deepEqual(database.collections.get("attendance_punches"), []);
  assert.deepEqual(database.collections.get("private_salary_vault"), []);
  assert.deepEqual(database.indexes, [{
    collection: "attendance_punches",
    keys: { userId: 1, shiftDate: 1 },
    options: { unique: true, name: "user_shift_once" },
  }]);

  await initializeFreshDatabase(database);
  assert.equal(database.collections.get("timecloud_metadata").length, 1);
  assert.equal(database.indexes.length, 2);
});

test("fresh database initialization refuses non-empty unmarked databases without modifying them", async () => {
  const database = createDatabase({
    user: [{ _id: "old-account" }],
  });

  await assert.rejects(
    initializeFreshDatabase(database),
    (error) =>
      error instanceof FreshDatabaseError &&
      /Choose a new empty database/.test(error.message),
  );
  assert.deepEqual([...database.collections.keys()], ["user"]);
  assert.deepEqual(database.collections.get("user"), [{ _id: "old-account" }]);
});

test("initialized databases can finish creating collections after an interrupted bootstrap", async () => {
  const database = createDatabase({
    timecloud_metadata: [{
      _id: "fresh-installation",
      schemaVersion: 1,
    }],
  });

  await initializeFreshDatabase(database);

  assert.equal(database.collections.has("workspaces"), true);
  assert.equal(database.collections.has("attendance_punches"), true);
  assert.equal(database.collections.has("private_salary_vault"), true);
});
