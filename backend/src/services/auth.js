import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import nodemailer from "nodemailer";
import { getServerConfig } from "../config/config.js";
import { getMongoDb } from "../config/mongodb.js";

export async function deleteUserAppData(database, userId) {
  if (!database || typeof userId !== "string" || !userId) {
    throw new Error("A MongoDB database and user ID are required for deletion.");
  }
  const mongoSession = database.client.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      await database
        .collection("workspaces")
        .deleteOne({ _id: userId }, { session: mongoSession });
      await database
        .collection("attendance_punches")
        .deleteMany({ userId }, { session: mongoSession });
      await database
        .collection("private_salary_vault")
        .deleteOne({ _id: userId }, { session: mongoSession });

      const workspace = await database.collection("workspaces").findOne(
        { _id: userId },
        { session: mongoSession, projection: { _id: 1 } },
      );
      const punch = await database.collection("attendance_punches").findOne(
        { userId },
        { session: mongoSession, projection: { _id: 1 } },
      );
      const salaryVault = await database.collection("private_salary_vault").findOne(
        { _id: userId },
        { session: mongoSession, projection: { _id: 1 } },
      );
      if (workspace || punch || salaryVault) {
        throw new Error("Account data deletion could not be verified.");
      }
    });
  } finally {
    await mongoSession.endSession();
  }
}

export function createAuth({
  database,
  env = process.env,
  createTransport = nodemailer.createTransport,
} = {}) {
  if (!database) {
    throw new Error("A MongoDB database is required to initialize authentication.");
  }
  const config = getServerConfig(env);
  let emailTransport;
  const sendMail = async ({ to, subject, url, purpose }) => {
    if (!config.smtpUrl || !config.smtpFrom) {
      throw new Error(
        "Email delivery is not configured. Set SMTP_URL and SMTP_FROM.",
      );
    }
    emailTransport ??= createTransport(config.smtpUrl);
    await emailTransport.sendMail({
      from: config.smtpFrom,
      to,
      subject,
      text: `Use this link to ${purpose} for your TimeCloud account:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    });
  };
  const trustedOrigins = [config.appOrigin];
  if (!config.isProduction && config.appOrigin !== "http://localhost:5173") {
    trustedOrigins.push("http://localhost:5173");
  }
  if (!config.isProduction && config.appOrigin !== "http://127.0.0.1:5173") {
    trustedOrigins.push("http://127.0.0.1:5173");
  }

  return betterAuth({
    appName: "TimeCloud",
    baseURL: config.apiOrigin,
    basePath: "/api/auth",
    secret: config.secret,
    database: mongodbAdapter(database),
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendMail({
          to: user.email,
          subject: "Reset your TimeCloud password",
          url,
          purpose: "reset the password",
        });
      },
    },
    session: {
      expiresIn: 60 * 60,
      updateAge: 15 * 60,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        afterDelete: async (user) => {
          const userDatabase = await getMongoDb();
          await deleteUserAppData(userDatabase, user.id);
        },
      },
    },
    advanced: {
      cookiePrefix: "timecloud",
      useSecureCookies: config.apiOrigin.startsWith("https://"),
      defaultCookieAttributes: {
        httpOnly: true,
        secure: config.apiOrigin.startsWith("https://"),
        sameSite: "lax",
        path: "/",
      },
    },
  });
}

let authPromise;

export async function getAuth() {
  if (!authPromise) {
    const pendingAuth = getMongoDb().then((database) => createAuth({ database }));
    authPromise = pendingAuth;
    pendingAuth.catch(() => {
      if (authPromise === pendingAuth) authPromise = null;
    });
  }
  return authPromise;
}