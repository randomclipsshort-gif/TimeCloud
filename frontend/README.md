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
`http://127.0.0.1:10000`. `VITE_API_BASE_URL` can override that target during
local development. Production builds always use same-origin `/api` requests.

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
Render service origin (for production, `https://timecloud.onrender.com`) so
`api/proxy.js` can proxy requests. Vercel rewrites `/api/:path*` to this shared
function, including nested Better Auth paths. `VITE_API_BASE_URL` is ignored
in production; production browser requests always use the same-origin Vercel
API function. `RENDER_API_URL` is read only by the Vercel function and is not
included in the browser bundle.
This same-origin proxy is important for authentication: direct browser calls
from `vercel.app` to `onrender.com` use cross-site cookies and may be blocked
by third-party-cookie restrictions, even when the backend cookie uses
`SameSite=None; Secure`. Keep the explicit `/api/:path*` rewrite to the proxy
function; do not rewrite API paths to the SPA.

See the root [README](../README.md) and
[backend deployment guide](../backend/README.md) for the complete setup.
