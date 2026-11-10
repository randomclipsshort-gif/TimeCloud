# TimeCloud frontend

React, Vite, and Tailwind CSS frontend for TimeCloud. All database access and
authentication logic are handled by the separate backend; this application
contains no MongoDB credentials or backend authentication secrets.

## Local development

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

The Vite development server proxies `/api` to
`http://127.0.0.1:10000`. Set `VITE_API_BASE_URL` only when intentionally
using a public API origin; leave it empty for the same-origin proxy.

Run frontend tests and build:

```powershell
npm test
npm run build
```

## Vercel deployment

- Root Directory: `frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Set the private, non-`VITE_` environment variable `RENDER_API_URL` to the
Render service origin so `api/[...path].js` can proxy requests. Keep
`VITE_API_BASE_URL` empty for the same-origin production API. `RENDER_API_URL`
is read only by the Vercel function and is not included in the browser bundle.

See the root [README](../README.md) and
[backend deployment guide](../backend/README.md) for the complete setup.
