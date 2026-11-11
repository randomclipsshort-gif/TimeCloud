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
  value on both platforms; keep other backend secrets in Render.
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
