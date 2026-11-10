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
| `PORT` | Supplied by Render; do not hardcode a production port. |
| `API_ORIGIN` | Optional. Defaults to `APP_ORIGIN`; if set, use the browser-visible API origin through the Vercel proxy. |
| `SMTP_URL` | Optional SMTP/SMTPS URL for password-reset email. |
| `SMTP_FROM` | Optional sender address; configure together with `SMTP_URL`. |
| `NODE_ENV` | Set to `production`. |

Generate a secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

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

Do not prefix this variable with `VITE_`. Leave `VITE_API_BASE_URL` empty in
Vercel so browser calls use the Vercel `/api/*` function. This keeps auth
cookies same-origin and avoids third-party-cookie requirements.

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
