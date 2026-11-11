const INSTALLATION_ID = "fresh-installation";
const SCHEMA_VERSION = 1;
const applicationCollections = [
  "workspaces",
  "attendance_punches",
  "private_salary_vault",
  "private_financial_data",
];

export class FreshDatabaseError extends Error {
  constructor(message) {
    super(message);
    this.name = "FreshDatabaseError";
  }
}

async function readInstallation(database) {
  const installation = await database
    .collection("timecloud_metadata")
    .findOne({ _id: INSTALLATION_ID });
  if (!installation) return false;
  if (installation.schemaVersion !== SCHEMA_VERSION) {
    throw new FreshDatabaseError(
      "The configured MongoDB database has an unsupported TimeCloud schema version.",
    );
  }
  return true;
}

async function ensureCollection(database, name) {
  try {
    await database.createCollection(name);
  } catch (error) {
    if (error?.code !== 48) throw error;
    const exists = await database
      .listCollections({ name }, { nameOnly: true })
      .hasNext();
    if (!exists) throw error;
  }
}

async function initializeCollections(database) {
  for (const name of applicationCollections) {
    await ensureCollection(database, name);
  }
  await database.collection("attendance_punches").createIndex(
    { userId: 1, shiftDate: 1 },
    { unique: true, name: "user_shift_once" },
  );
}

export async function initializeFreshDatabase(database) {
  if (await readInstallation(database)) {
    await initializeCollections(database);
    return;
  }

  const existingCollections = await database
    .listCollections({}, { nameOnly: true })
    .toArray();
  if (existingCollections.length > 0) {
    if (await readInstallation(database)) return;
    throw new FreshDatabaseError(
      "The configured MongoDB database is not empty and has no TimeCloud installation marker. Choose a new empty database; existing data was not changed.",
    );
  }

  try {
    await database.collection("timecloud_metadata").insertOne({
      _id: INSTALLATION_ID,
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date(),
    });
  } catch (error) {
    if (error?.code !== 11000 || !(await readInstallation(database))) {
      throw error;
    }
  }

  await initializeCollections(database);
}
