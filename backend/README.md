# TimeCloud backend

Express API with Better Auth and the official MongoDB Node.js driver. Render
hosts this application; the frontend reaches it through Vercel's same-origin
`/api/*` proxy.

## Local development

Create `backend/.env` from the example (the server does not read `.env.example`
directly), then replace the MongoDB URI placeholders with your Atlas
connection details. Use a **new empty** database name and a newly generated
`AUTH_SECRET` with at least 32 bytes. Keep `APP_ORIGIN=http://localhost:5173`
for local frontend development.

```powershell
Copy-Item .env.example .env
notepad .env
npm install
npm start
```

The service binds to `0.0.0.0` and uses `PORT` (default `10000`). Check
`http://localhost:10000/health`.

Run backend tests:

```powershell
npm test
```

## Render deployment

Create a Node web service from the repository with:

| Render setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Node version | 20 or newer |

Set these variables in the Render service:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection URI for a least-privilege app user. |
| `MONGODB_DB_NAME` | A new, empty database name, such as `timecloud_fresh`. |
| `AUTH_SECRET` | New random secret of at least 32 bytes. |
| `APP_ORIGIN` | Exact frontend origin, currently `https://time-cloud.vercel.app`. |
| `API_ORIGIN` | Public backend origin, currently `https://timecloud.onrender.com`. |
| `TIMECLOUD_GATEWAY_SECRET` | Required in production; same random 64-character hexadecimal secret as Vercel. |
| `PORT` | Supplied by Render; do not hardcode a production port. |
| `SMTP_URL` | Optional SMTP/SMTPS URL for password-reset email. |
| `SMTP_FROM` | Optional sender address; configure together with `SMTP_URL`. |
| `NODE_ENV` | Set to `production`. |

Generate the Better Auth secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Generate a separate gateway secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set this exact value as `TIMECLOUD_GATEWAY_SECRET` in both Render and Vercel.
It must be 64 hexadecimal characters. Never commit it, prefix it with `VITE_`,
or print it in application logs. Local development does not require it.

Create a new database in Atlas and allow the Render service to connect. The
backend initializes empty app collections only in an empty database. It
refuses an unmarked database that already contains collections and never
imports, clears, or overwrites old data.

## Vercel proxy setup

Deploy `frontend/` as the Vercel project and set its private Production
environment variable:

| Variable | Value |
| --- | --- |
| `RENDER_API_URL` | Render service origin, e.g. `https://your-service.onrender.com`, without a trailing slash. |
| `TIMECLOUD_GATEWAY_SECRET` | Same random 64-character hexadecimal secret configured on Render; server-side only. |

Do not prefix this variable with `VITE_`. Production browser calls always use
the same-origin Vercel `/api/*` function; `VITE_API_BASE_URL` is ignored in
production. This keeps auth cookies same-origin and avoids third-party-cookie
requirements. The proxy forwards request cookies and preserves each backend
`Set-Cookie` header. It validates Vercel's single-address `x-forwarded-for`
value, overwrites the internal client-IP header, and authenticates to Render
with the shared secret. Render rejects production API requests without that
secret. Do not configure a catch-all rewrite that sends `/api/*` to the SPA.

Set `API_ORIGIN` to the Render service origin so Better Auth has the correct
public API base URL. Production Better Auth cookies use
`SameSite=None; Secure; HttpOnly` when the app and API use different hostnames,
and in production generally. Local development on `localhost` uses
`SameSite=Lax`; cookies are Secure only when the configured API origin is
HTTPS. The frontend auth client includes browser credentials for login,
signup, session checks, and logout.

`SameSite=None` does not override browser third-party-cookie blocking. Vercel's
`vercel.app` and Render's `onrender.com` hosts are on different sites, so a
direct browser-to-Render setup may still fail in browsers or privacy settings
that block third-party cookies. Prefer the Vercel same-origin `/api/*` proxy
with `VITE_API_BASE_URL` empty. For a first-party deployment without a proxy,
use custom domains on the same registrable domain, such as
`app.example.com` and `api.example.com`, and update `APP_ORIGIN`, `API_ORIGIN`,
and the frontend API configuration accordingly.

## API data and security

Better Auth manages its user, session, account, verification, and rate-limit
collections. TimeCloud uses:

- `timecloud_metadata` for the fresh-install marker and schema version.
- `workspaces` for schedules, attendance corrections, leave, holidays,
  preferences, regular expenses, and travel plans.
- `attendance_punches` for server-validated clock-in/out records.
- `private_salary_vault` for client-encrypted financial data.

User identity is derived from the verified server-side session. Workspace and
vault writes use revision checks. Registration does not require email
verification. Password reset is optional and requires `SMTP_URL` and
`SMTP_FROM`. Sessions use HttpOnly cookies and expire after one hour.

Salary, earnings, payslips, and designated financial attendance fields are
encrypted in the browser using AES-256-GCM and PBKDF2-HMAC-SHA-256. MongoDB
receives ciphertext and envelope metadata, never a passphrase or encryption
key. There is no import of historical accounts, records, or keys.

## Deployment verification

After configuration, verify `https://<render-service>/health`, then
`https://time-cloud.vercel.app/api/health`. Test new registration, login,
refresh/session persistence, logout, and account data isolation in a browser.
Local tests do not verify live Atlas, Render, Vercel, SMTP, or production
cookies.
