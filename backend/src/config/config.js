export class ServerConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ServerConfigError";
  }
}

export function getMongoConfig(env = process.env) {
  const uri = env.MONGODB_URI?.trim();
  const dbName = env.MONGODB_DB_NAME?.trim();
  if (!uri || !dbName) {
    throw new ServerConfigError(
      "MongoDB is not configured. Set MONGODB_URI and MONGODB_DB_NAME.",
    );
  }
  if (!/^mongodb(?:\+srv)?:\/\/\S+$/.test(uri)) {
    throw new ServerConfigError("MONGODB_URI must be a MongoDB connection URI.");
  }
  if (!/^[A-Za-z0-9._-]{1,63}$/.test(dbName)) {
    throw new ServerConfigError("MONGODB_DB_NAME is invalid.");
  }
  return { uri, dbName };
}

export function getServerConfig(env = process.env) {
  const mongo = getMongoConfig(env);
  const secret = env.AUTH_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new ServerConfigError("AUTH_SECRET must contain at least 32 bytes.");
  }

  const parseOrigin = (value, name) => {
    if (!value) {
      throw new ServerConfigError(`${name} is required.`);
    }
    try {
      const parsedOrigin = new URL(value);
      const isLocalHttp =
        parsedOrigin.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname);
      if (
        !["http:", "https:"].includes(parsedOrigin.protocol) ||
        (!parsedOrigin.origin.startsWith("https://") && !isLocalHttp) ||
        parsedOrigin.pathname !== "/" ||
        parsedOrigin.search ||
        parsedOrigin.hash
      ) {
        throw new Error("Invalid origin.");
      }
      return parsedOrigin.origin;
    } catch {
      throw new ServerConfigError(
        `${name} must be an HTTPS origin (or a localhost origin for development).`,
      );
    }
  };
  const appOrigin = parseOrigin(env.APP_ORIGIN?.trim(), "APP_ORIGIN");
  const apiOrigin = parseOrigin(
    env.API_ORIGIN?.trim() || appOrigin,
    "API_ORIGIN",
  );

  const smtpUrl = env.SMTP_URL?.trim() || "";
  const smtpFrom = env.SMTP_FROM?.trim() || "";
  if (Boolean(smtpUrl) !== Boolean(smtpFrom)) {
    throw new ServerConfigError(
      "Configure both SMTP_URL and SMTP_FROM to enable password reset email.",
    );
  }
  if (smtpUrl) {
    try {
      const parsedSmtpUrl = new URL(smtpUrl);
      if (!["smtp:", "smtps:"].includes(parsedSmtpUrl.protocol)) {
        throw new Error("Invalid protocol.");
      }
    } catch {
      throw new ServerConfigError("SMTP_URL must be an SMTP or SMTPS URL.");
    }
  }

  return {
    ...mongo,
    secret,
    appOrigin,
    apiOrigin,
    smtpUrl,
    smtpFrom,
    isProduction: env.NODE_ENV === "production",
  };
}
