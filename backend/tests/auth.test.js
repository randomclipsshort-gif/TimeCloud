import test from "node:test";
import assert from "node:assert/strict";
import { deleteUserAppData } from "../src/services/auth.js";

function createDatabase(initialDocuments = {}) {
  const collections = new Map(
    Object.entries(initialDocuments).map(([name, documents]) => [
      name,
      structuredClone(documents),
    ]),
  );
  const wrappers = new Map();
  const database = {
    sessionEnded: false,
    collection(name) {
      if (wrappers.has(name)) return wrappers.get(name);
      if (!collections.has(name)) collections.set(name, []);
      const documents = collections.get(name);
      const collection = {
        async deleteOne(filter) {
          const index = documents.findIndex((document) =>
            Object.entries(filter).every(([key, value]) => document[key] === value),
          );
          if (index >= 0) documents.splice(index, 1);
        },
        async deleteMany(filter) {
          for (let index = documents.length - 1; index >= 0; index -= 1) {
            if (
              Object.entries(filter).every(
                ([key, value]) => documents[index][key] === value,
              )
            ) {
              documents.splice(index, 1);
            }
          }
        },
        async findOne(filter) {
          return (
            documents.find((document) =>
              Object.entries(filter).every(
                ([key, value]) => document[key] === value,
              ),
            ) ?? null
          );
        },
      };
      wrappers.set(name, collection);
      return collection;
    },
    client: {
      startSession() {
        return {
          async withTransaction(operation) {
            await operation();
          },
          async endSession() {
            database.sessionEnded = true;
          },
        };
      },
    },
  };
  return database;
}

test("account cleanup removes only the target user's application documents", async () => {
  const database = createDatabase({
    workspaces: [
      { _id: "alice", data: {} },
      { _id: "bob", data: {} },
    ],
    attendance_punches: [
      { _id: "alice:2026-11-01", userId: "alice" },
      { _id: "bob:2026-11-01", userId: "bob" },
    ],
    private_salary_vault: [
      { _id: "alice", ciphertext: "encrypted" },
      { _id: "bob", ciphertext: "encrypted" },
    ],
  });

  await deleteUserAppData(database, "alice");

  assert.deepEqual(await database.collection("workspaces").findOne({ _id: "alice" }), null);
  assert.equal((await database.collection("workspaces").findOne({ _id: "bob" }))._id, "bob");
  assert.equal(
    (await database.collection("attendance_punches").findOne({ userId: "alice" })),
    null,
  );
  assert.equal(
    (await database.collection("private_salary_vault").findOne({ _id: "alice" })),
    null,
  );
  assert.equal(database.sessionEnded, true);
});

test("account cleanup ends the MongoDB session when deletion fails", async () => {
  const database = createDatabase();
  database.collection("attendance_punches").deleteMany = async () => {
    throw new Error("database write failed");
  };

  await assert.rejects(deleteUserAppData(database, "alice"), /database write failed/);
  assert.equal(database.sessionEnded, true);
});
