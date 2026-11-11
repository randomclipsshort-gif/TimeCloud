# TimeCloud

TimeCloud is organized as two independent applications:

- [`frontend/`](./frontend/) — React, Vite, Tailwind CSS, and the Vercel API
  proxy.
- [`backend/`](./backend/) — Express, Better Auth, and the MongoDB Atlas API
  deployed to Render.

## Local setup

1. Configure the backend by copying `backend/.env.example` to
   `backend/.env`, then set the MongoDB URI, a new empty database name, a
   random `AUTH_SECRET` of at least 32 bytes, and
   `APP_ORIGIN=http://localhost:5173`.
2. In one terminal:

   ```powershell
   cd backend
   npm install
   npm start
   ```

3. In a second terminal:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

The Vite development server proxies `/api` requests to the backend on port
`10000`. Keep `VITE_API_BASE_URL` empty for the same-origin proxy.

## Deployment

- Deploy `frontend/` as a Vite project to Vercel. Set its Root Directory to
  `frontend`, build with `npm run build`, and use `dist` as the output
  directory. Configure the private `RENDER_API_URL` and
  `TIMECLOUD_GATEWAY_SECRET` variables for the Vercel `/api/*` proxy.
- Deploy `backend/` as a Node web service to Render. Set its Root Directory to
  `backend`, build with `npm install`, start with `npm start`, and set the
  health check path to `/health`. Set `TIMECLOUD_GATEWAY_SECRET` to the same
  value on both platforms; keep other backend secrets in Render. Configure
  `PRIVATE_DATA_ENCRYPTION_KEY` on Render before using financial data.
- Full environment and deployment steps are documented in
  [`backend/README.md`](./backend/README.md).

## Fresh database

This application starts with new accounts and empty application collections.
Do not import historical users, application data, or encryption keys. Use a
new, empty MongoDB database; the backend refuses an unmarked non-empty
database and does not modify existing data.

## Validation

Run the applications independently:

```powershell
cd frontend
npm test
npm run build
```

```powershell
cd backend
npm test
```

Passing local tests and builds do not verify a live Atlas connection, Render
service, Vercel proxy, or production authentication cookies.

## Private financial data

TimeCloud encrypts private financial data on the backend using
`PRIVATE_DATA_ENCRYPTION_KEY`. Generate a random 32-byte hexadecimal key and
configure it only in the backend environment (for example, Render and local
`backend/.env`):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the key backed up securely and unchanged: losing it makes stored financial
data unrecoverable. Never add it to frontend variables or source control. Users
with an existing client-side salary vault enter its passphrase once to migrate;
the browser decrypts the legacy data, sends the plaintext only over the
authenticated API (HTTPS in deployment), and the backend encrypts it before
storage. The passphrase is not sent or stored. See
[`backend/README.md`](./backend/README.md) for storage and migration details.
