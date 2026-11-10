import { MongoClient } from "mongodb";
import { getMongoConfig } from "./config.js";
import {
  FreshDatabaseError,
  initializeFreshDatabase,
} from "../services/initializeDatabase.js";

const cacheKey = Symbol.for("timecloud.mongo-client-cache");
const cache = (globalThis[cacheKey] ??= {});

export function createMongoDbGetter({
  getEnv = () => process.env,
  createClient = (uri, options) => new MongoClient(uri, options),
  initializeDatabase = initializeFreshDatabase,
  cache: connectionCache = {},
} = {}) {
  return async function getMongoDb() {
    const { uri, dbName } = getMongoConfig(getEnv());
    const key = `${uri}\n${dbName}`;
    if (connectionCache.key !== key || !connectionCache.promise) {
      connectionCache.key = key;
      const pendingConnection = (async () => {
        let client;
        try {
          client = createClient(uri, {
            maxPoolSize: 10,
            minPoolSize: 0,
            serverSelectionTimeoutMS: 5000,
            retryReads: true,
            retryWrites: true,
          });
          await client.connect();
          const database = client.db(dbName);
          await initializeDatabase(database);
          return database;
        } catch (error) {
          if (client) {
            try {
              await client.close();
            } catch (closeError) {
              console.error("MongoDB client cleanup after connection failure failed.", {
                name: closeError instanceof Error ? closeError.name : "UnknownError",
              });
            }
          }
          const failureDetails = {
            name: error instanceof Error ? error.name : "UnknownError",
            code:
              error && typeof error === "object" && "code" in error
                ? String(error.code)
                : undefined,
          };
          if (error instanceof FreshDatabaseError) {
            failureDetails.message = error.message;
          }
          console.error("MongoDB connection or initialization failed.", failureDetails);
          throw new Error(
            "MongoDB connection or fresh database initialization failed. Check server configuration, network access, and that the configured database is new and empty.",
            { cause: error },
          );
        }
      })();
      connectionCache.promise = pendingConnection;
      pendingConnection.catch(() => {
        if (connectionCache.promise === pendingConnection) {
          connectionCache.promise = null;
          connectionCache.key = null;
        }
      });
    }
    return connectionCache.promise;
  };
}

export const getMongoDb = createMongoDbGetter({ cache });