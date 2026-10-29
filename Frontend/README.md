# Timekeep Cloud

React, Vite, and Tailwind CSS frontend conversion of the original static Timekeep Cloud dashboard. The original [TimeCloud.html](./TimeCloud.html) file is retained unchanged as the visual and interaction reference.

## Run locally

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`. Authentication and cloud persistence remain
unavailable until a Supabase project is configured and the migration in
`../supabase/migrations/` is applied. See [`Backend/README.md`](../Backend/README.md)
for project setup, migration, deletion-function, and deployment instructions.

Create and preview a production build with:

```sh
npm run build
npm run preview
```

## Project structure

- `src/App.jsx` composes the page and manages shared UI state.
- `src/components/layout/` contains the header.
- `src/components/attendance/` contains the attendance dashboard.
- `src/components/finance/` contains the financial dashboard and expense tracker.
- `src/components/modals/` contains the standalone modal components.
- `src/components/ui/` contains toast notifications.
- `src/data/holidayCalendar.js` keeps year-specific holiday entries separate from holiday logic. The 2026 national baseline references [Proclamation No. 1006, s. 2025](https://www.officialgazette.gov.ph/2025/10/31/proclamation-no-1006-s-2025/); Eid dates are editable in **Settings → Manage Holidays** because they are subject to separate official declaration.
- `src/utils/holidayUtils.js` provides holiday lookup and classification helpers.
- `src/utils/holidayPay.js` contains isolated holiday-pay rate rules and estimate calculations.

The calendar starts with no attendance or shift assignments. Normal **Time In** is enabled from the configured early-punch window through the assigned shift cutoff, including while late and during the following morning of an active overnight shift. The early-punch window and Late grace period are independently configurable under **Settings → Earnings & Rates**. Late status is recorded only after the grace period, and its minutes count only the time beyond that grace period. Once clocked in, **Time Out** is enabled until the assigned shift cutoff, including the next calendar day for an active overnight shift; completing a shift disables both normal punches. Past and future dates outside an eligible active overnight window cannot be punched normally. After shift end, use Manual Entry to correct missed or inaccurate attendance. Manual Entry remains available for assigned past shifts, validates clock-in/out values against the shift, and recalculates Late and Undertime after every correction. Undertime is shown only after clock-out and counts minutes before the scheduled shift end; no separate undertime adjustment is configured. These indicators do not currently deduct from earnings. A scheduled shift without a valid attendance record is marked absent only after the shift ends; future and active shifts are not marked absent, and a holiday without a scheduled shift does not create an absence. Leave is granted immediately for a validated selected date range and deducted by day from the corresponding leave balance; leave dates are not marked absent and no approval workflow is used.

Sign-in, registration, session restoration, password recovery, and sign-out use Supabase Auth. Shifts, manual attendance, leave, preferences, holidays, and expenses are synchronized to an RLS-protected JSON document through a revision-checked RPC; direct client writes are revoked. Ordinary clock punches are stored in the separate RLS-protected `attendance_punches` table with server-generated timestamps, duplicate prevention, and clock-in validation against the saved shift. Manual attendance corrections remain user-entered records in the workspace; this is not a payroll-grade attendance authority.

Salary settings and pay-derived attendance values synchronize through a separate `private_salary_vault`. The browser encrypts them with Web Crypto AES-256-GCM before upload. A distinct user-held passphrase derives the key using PBKDF2-HMAC-SHA-256 (310,000 iterations) and a per-vault random salt; every encryption uses a fresh 96-bit nonce. The key stays in memory only while the vault is unlocked and is not sent to Supabase or saved in browser storage. Unlock the same vault passphrase on each device. If the passphrase and all unlocked devices are lost, the encrypted values cannot be recovered. The vault table contains ciphertext and minimal metadata, protected by per-user RLS and a revision-checked RPC.

The pending migration intentionally preserves historical salary/pay fields already present in workspace or punch JSON. Those legacy plaintext values remain visible to Supabase project operators until a separate cleanup is reviewed and approved; do not claim all historical data is end-to-end encrypted yet. New workspace requests exclude salary fields, and the workspace RPC preserves already-stored legacy values rather than silently deleting them. After a successful encrypted vault save, the previous browser-local plaintext copy is removed. A user-requested JSON export may contain decrypted salary data in its own local file; keep it private.

Cloud-save failures are surfaced and success messages wait for database confirmation. Sign-in tokens are persisted by the Supabase client in the browser; this is separate from application workspace data. Supabase Auth and the hosting provider may process account and technical metadata. Supabase project administrators can access cloud attendance, workspace records, and vault ciphertext/metadata; only the unlocked client can decrypt current vault contents. Encryption does not protect a compromised or unlocked device.

The 2026 Philippine national holiday list is preloaded and editable in **Settings → Manage Holidays**. It distinguishes Regular Holiday, Special Non-Working Day, Special Working Day, Local Holiday, and Ordinary Working Day. A locality must be entered in Settings for configured local holidays to appear; local holiday pay treatment remains unconfigured rather than assumed nationwide. Only 2026 national dates are preloaded; other years need their own official declarations added to `holidayCalendarByYear` or configured in Settings. A holiday classification is displayed separately from the user's attendance status and schedule, and does not itself create an absence. Holiday pay is shown as an estimate only when daily wage, schedule, attendance hours, and eligibility inputs are provided. New accounts have no configured salary or personal records; unworked special non-working days remain unpaid by default, and local/company-specific pay rules are not estimated.

Night differential defaults to 10% of hourly base pay for shift hours worked between 10 PM and 6 AM; salary and earnings calculations run locally in the browser. Earnings summaries are estimates, not finalized payroll; statutory deductions are not calculated. Account deletion uses a Supabase Edge Function and removes the account-owned workspace and attendance punches through cascading foreign keys. Supabase Auth and the hosting provider may still process email, optional display-name metadata, session, and technical request metadata. Existing browser-only prototype state is not imported automatically because it cannot be safely attributed to an account.
