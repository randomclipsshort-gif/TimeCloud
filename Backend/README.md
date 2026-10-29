# Backend and Supabase setup

TimeCloud uses Supabase Auth and PostgreSQL directly from the existing Vite
frontend. A separate application server is not required: the browser receives
only the public publishable key, while PostgreSQL Row Level Security limits
each authenticated account to its own workspace document.

## Set up a Supabase project

1. Create a Supabase project and configure email/password authentication.
2. Set the project URL and publishable key in `Frontend/.env.local`, using
   `Frontend/.env.example` as a template.
3. From the repository root, authenticate the Supabase CLI and link the same
   project configured in `Frontend/.env.local`. The project reference is the
   hostname portion of `VITE_SUPABASE_URL` (the value between `https://` and
   `.supabase.co`):

   ```powershell
   npx supabase@latest login
   npx supabase@latest link --project-ref YOUR_PROJECT_REF
   ```

   The CLI may prompt for the project's database password. Enter it in the
   prompt; do not put it in a command, source file, or frontend variable.
4. Review the linked project's migration history and preview the changes before
   applying anything:

   ```powershell
   npx supabase@latest migration list --linked
   npx supabase@latest db push --dry-run --linked
   ```

   As of the last linked-project check, migrations `202610250001`,
   `202610270001`, and `202610280001` are applied, while
   `202610280002_private_financial_data.sql` is pending. That migration has
   been changed to preserve existing salary fields and add the encrypted vault;
   verify the linked migration status and review its current contents before
   applying it. Confirm the CLI is linked to the project whose hostname
   matches `VITE_SUPABASE_URL`:

   ```powershell
   npx supabase@latest migration list --linked
   npx supabase@latest db push --dry-run --linked
   ```

   The migration adds `private_salary_vault` and a revision-checked save RPC,
   enables per-user read RLS, and removes matching financial fields from new
   client workspace payloads. The RPC preserves historical financial fields
   already present in workspace JSON; the migration does not delete or encrypt
   those old values. Users can initialize or unlock the vault in **Settings →
   Earnings & Rates**. Only after verifying encrypted vault copies and obtaining
   separate approval should a future reviewed migration remove legacy plaintext
   fields. Never apply a cleanup migration before that approval.

   After reviewing the additive migration and confirming the correct linked
   project, apply it and verify migration history:

   ```powershell
   npx supabase@latest db push --linked
   npx supabase@latest migration list --linked
   ```
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

The initial migration creates `public.user_workspaces`, enables RLS, and grants the
authenticated role read access only to rows whose `user_id` equals
`auth.uid()`. All client writes go through the security-definer
`save_user_workspace` RPC; direct table writes are revoked so clients cannot
bypass optimistic revision checks. That RPC derives ownership from
`auth.uid()`, rejects a stale expected revision, and strips salary/pay fields
from incoming workspace data while preserving already-stored legacy financial
fields until a separately approved cleanup.
Workspace data is a JSON document (up to 1 MiB) to preserve the existing
frontend model without replacing its UI. It contains shifts, manual attendance
corrections, leave, preferences, and expenses.

The additive `private_salary_vault` table stores AES-GCM ciphertext, a random
nonce and salt, format/key versions, revision, and update time. It does not
store salary plaintext or decryption keys. RLS permits authenticated users to
read only their own ciphertext; saves go through
`save_private_salary_vault`, which uses `auth.uid()` and revision checks.
Frontend encryption uses Web Crypto AES-256-GCM and PBKDF2-HMAC-SHA-256 (310,000
iterations); the user-held vault passphrase is required on each device and is
not sent to Supabase or stored in browser persistent storage. An unlocked
device can re-encrypt the vault under a new passphrase and increment the key
version. Losing the passphrase and all unlocked devices makes the vault
unrecoverable. RLS is
additional access control, not the encryption mechanism. Project operators can
read vault metadata and ciphertext, but not decrypt it without the passphrase.
Historical salary values in workspace or punch JSON remain plaintext and
accessible to project operators until a separate cleanup is reviewed and
approved. End-to-end encryption does not protect a compromised or unlocked
device. User-requested JSON exports may contain decrypted salary data and must
be kept private.

The second, additive migration creates `public.attendance_punches` with a
unique `(user_id, shift_date)` key and check constraints. This permits at most
one ordinary punch per user per shift date. Direct writes to that table are
revoked. Security-definer `clock_in_for_shift` and
`clock_out_for_shift` operations derive ownership from `auth.uid()`, record
server timestamps in Asia/Manila, reject duplicate time-ins, validate clock-in
against the caller's saved shift, and require exactly one active time-in before
time-out. The frontend calls these operations for ordinary punches and reloads
their records from the protected table. Manual entries and corrections remain
in `user_workspaces`, not `attendance_punches`. Existing JSON attendance is not
backfilled as trusted punches. If any older deployment has an in-progress
JSON-only punch, complete it before deploying the punch migration or correct
it using Manual Entry afterward.

## Implementation limits

This is a staged migration, not a fully normalized payroll schema. Leave,
shift assignments, manual attendance corrections, expenses, and preferences
remain in the owner's JSON document. The punch RPC checks only schedule fields
stored in the caller's workspace, enforces the configured early-punch window,
and limits clock-in and clock-out to the saved shift window using server time
in Asia/Manila. It does not create an immutable audit trail for manual
corrections or independently verify that client-entered manual timestamps
reflect actual attendance. Manual entries are corrections, not trusted punch
events. Do not treat the application as an audited payroll system or finalized
attendance authority.

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
The command deploys to the project linked in step 3.

The function accepts no user ID in its request body; it verifies the bearer
session with `auth.getUser()` and deletes only that verified user's Auth
account. Foreign-key cascades remove the workspace, punch rows, and encrypted
salary-vault row. An older plaintext browser-local copy is not cloud data and
must be removed separately if the app could not clear it. Do not test deletion
against a real account without explicit authorization.

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

The linked project's migration history was checked with the Supabase CLI:
`202610250001`, `202610270001`, and `202610280001` are applied, and
`202610280002_private_financial_data.sql` is pending. A linked dry run previews
only that pending migration; it has not been applied by this change. Local SQL
lint could not connect because no local database was running at
`127.0.0.1:54322`. Live account-level persistence, RLS isolation,
backup/restore, and deployment tests have not been performed. Do not treat the
dry run as SQL execution or proof of live behavior.

For attendance concurrency checks after migration, sign in as one test account
in two browser sessions, issue `clock_in_for_shift` twice concurrently for the
same date, and verify exactly one succeeds. Call `clock_out_for_shift` before
time-in (must fail), then twice after the successful time-in (exactly one must
succeed). Repeat with another account and verify the first account's ledger
rows are not selectable. Also race saves using the same workspace revision;
the losing `save_user_workspace` call must return a revision conflict and
preserve the winner's data. Never perform account deletion as part of these
tests.
