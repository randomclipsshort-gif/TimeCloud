# Backend and Supabase setup

TimeCloud uses Supabase Auth and PostgreSQL directly from the existing Vite
frontend. A separate application server is not required: the browser receives
only the public publishable key, while PostgreSQL Row Level Security limits
each authenticated account to its own workspace document.

## Set up a Supabase project

1. Create a Supabase project and configure email/password authentication.
2. Set the project URL and publishable key in `Frontend/.env.local`, using
   `Frontend/.env.example` as a template.
3. From the repository root, authenticate the Supabase CLI and link this
   existing project:

   ```powershell
   npx supabase@latest login
   npx supabase@latest link --project-ref huvkchqrutgztqpkvlvf
   ```

   The CLI may prompt for the project's database password. Enter it in the
   prompt; do not put it in a command, source file, or frontend variable.
4. Review the pending migrations, then apply them with:

   ```powershell
   npx supabase@latest migration list
   npx supabase@latest db push
   ```

   `db push` applies
   `202610250001_private_workspaces.sql`,
   `202610270001_attendance_punch_guard.sql`, and
   `202610280001_workspace_rpc_write_lockdown.sql` in timestamp order. The
   final migration is a non-destructive privilege hardening for deployments
   that already applied the original workspace migration. It does not import,
   rewrite, or delete existing workspace documents.
5. In Supabase Dashboard → Authentication → URL Configuration, set the Site
   URL to the local development origin while testing (normally
   `http://localhost:5173`) and add that origin to Redirect URLs. Before
   launch, set the Site URL to the actual HTTPS production origin and add
   both the production origin and required local origin to Redirect URLs.
   The production origin is not known or configured in this workspace.
6. Configure the same two `VITE_` variables in the frontend hosting provider.
   Never put a service-role key, database password, or other privileged secret
   in a `VITE_` variable.

For Vercel or Netlify, set the frontend project root/base directory to
`Frontend`, the build command to `npm run build`, and the publish/output
directory to `dist`. Add both `VITE_` variables to the provider's production
environment, then redeploy. HTTPS is supplied by the hosting provider; set the
resulting origin as the Supabase Auth site URL and redirect allow-list entry.
The current frontend has no client-side route table beyond `/`, so there are
no nested routes requiring a rewrite.

The migration creates `public.user_workspaces`, enables RLS, and grants the
authenticated role read access only to rows whose `user_id` equals
`auth.uid()`. All client writes go through the security-definer
`save_user_workspace` RPC; direct table writes are revoked so clients cannot
bypass optimistic revision checks. That RPC derives ownership from
`auth.uid()` and rejects a stale expected revision.
Workspace data is a JSON document (up to 1 MiB) to preserve the existing
frontend model without replacing its UI. This is an ownership boundary, not
field-level encryption: Supabase project operators can access stored data.

The second, additive migration creates `public.attendance_punches` with a
unique `(user_id, shift_date)` key and check constraints. This permits at most
one ordinary punch per user per shift date. Direct writes to that table are
revoked. Security-definer `clock_in_for_shift` and
`clock_out_for_shift` operations derive ownership from `auth.uid()`, record
server timestamps, reject duplicate time-ins, and require exactly one active
time-in before time-out. The existing frontend calls these operations for
ordinary punches and reloads their records from the protected table. Existing
JSON attendance remains untouched; it is not backfilled as trusted punches.
If any older deployment has an in-progress JSON-only punch, complete it before
deploying this migration or correct it using Manual Entry afterward.

## Important implementation limits

This is a staged migration, not a fully normalized payroll schema. Leave,
shift assignments, manual attendance corrections, expenses, and preferences
remain in the owner's JSON document. The punch RPC checks only schedule fields
included in the client-supplied record; it cannot confirm that a shift really
exists or validate the scheduled punch window, current shift date, or time-out
cutoff in PostgreSQL. An authenticated user can call it directly with a
fabricated schedule record and arbitrary shift date. The RPC currently guards
duplicate punches and transition order, not attendance authenticity. UI
schedule rules remain frontend-enforced. Manual attendance entries are
corrections, not trusted punch events. Do not treat the application as an
audited payroll system or finalized attendance authority.

Safe next migration stages, before any normalization:

1. Back up the current `user_workspaces` table using the project's configured
   Supabase backup/export mechanism and verify the backup outside this app.
2. Add normalized attendance and shift tables with owner foreign keys and RLS.
   Design an explicit, versioned import that validates JSON dates and records,
   reports invalid/duplicate rows, and leaves original JSON unchanged.
3. Add database operations that enforce the configured shift start window,
   Manila time-zone cutoff, overnight shift association, rest days, leave, and
   manual corrections. Run parallel read-only comparisons against the JSON
   representation before switching UI reads.
4. After verified two-account RLS, concurrency, and record-count checks, switch
   reads/writes; keep the old JSON data until a separately reviewed retention
   decision. Do not silently drop it.

## Account deletion function

The `delete-account` Edge Function verifies the caller's access token, then
uses the platform-provided service-role secret only in the trusted function
runtime to delete that caller's Auth account. The foreign-key cascade removes
the corresponding workspace. Deploy it with:

```sh
supabase functions deploy delete-account
```

Do not expose or copy `SUPABASE_SERVICE_ROLE_KEY` into the frontend. The
function uses Supabase runtime secrets and must retain JWT verification.
Deploy it to the linked project with:

```powershell
npx supabase@latest functions deploy delete-account --project-ref huvkchqrutgztqpkvlvf
```

The function accepts no user ID in its request body; it verifies the bearer
session with `auth.getUser()` and deletes only that verified user's Auth
account. The foreign key cascade removes the workspace and punch rows. Do not
test deletion against a real account without explicit authorization.

## Export, privacy, backup, and restore

The application export downloads the signed-in user's workspace document as
JSON. Treat the export as sensitive attendance and compensation information.
Supabase backups and point-in-time recovery depend on the selected plan; check
the project's current Supabase plan and backup settings. No backup or restore
has been performed or verified as part of this source change.

New accounts start with no attendance, expenses, scheduled shifts, leave
credits, or salary value. Existing browser-only data is not automatically
imported because it cannot be safely attributed to an authenticated account.
There is no offline queue or localStorage fallback.

## Manual verification before production

After applying the migration and deploying the function, create two test
accounts in separate browser profiles. Save distinct expenses and shifts for
each, refresh each profile, and verify that the saved records remain isolated.
While signed in as account A, query `user_workspaces` through the authenticated
Supabase client for account B's user ID; SELECT should return no row, and
direct INSERT, UPDATE, and DELETE requests to `user_workspaces` should be
rejected because clients have no table-write privileges. Perform workspace
changes only through `save_user_workspace`. Repeat the checks with the accounts
reversed. Do not use the dashboard SQL editor as an RLS test because privileged
SQL-editor sessions may bypass the policies.

These live-account, RLS, migration, backup/restore, and deployment checks have
not been run in this workspace because the Supabase CLI is unavailable and no
database password or authenticated CLI session was provided. The project URL
and public publishable key are configured locally. The public Auth settings
endpoint reported email sign-up enabled and email confirmation required. A
public REST probe reported that `public.user_workspaces` is not present in the
API schema cache; therefore the migration is not confirmed as applied and
appears unapplied.

For attendance concurrency checks after migration, sign in as one test account
in two browser sessions, issue `clock_in_for_shift` twice concurrently for the
same date, and verify exactly one succeeds. Call `clock_out_for_shift` before
time-in (must fail), then twice after the successful time-in (exactly one must
succeed). Repeat with another account and verify the first account's ledger
rows are not selectable. Also race saves using the same workspace revision;
the losing `save_user_workspace` call must return a revision conflict and
preserve the winner's data. Never perform account deletion as part of these
tests.
