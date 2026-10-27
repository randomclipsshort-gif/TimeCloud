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

Sign-in, registration, session restoration, password recovery, and sign-out use Supabase Auth. Private workspace changes are synchronized to an RLS-protected JSON document in PostgreSQL through a revision-checked RPC; direct client writes are revoked. There is no localStorage fallback or offline write queue; cloud-save failures are surfaced and success messages wait for database confirmation. Ordinary punches also use an atomic server-side ledger to reject duplicate time-ins and invalid time-out transitions. The ledger does not yet verify that client-supplied shift metadata is genuine; see the backend setup guide before relying on attendance as an audited record.

The 2026 Philippine national holiday list is preloaded and editable in **Settings → Manage Holidays**. It distinguishes Regular Holiday, Special Non-Working Day, Special Working Day, Local Holiday, and Ordinary Working Day. A locality must be entered in Settings for configured local holidays to appear; local holiday pay treatment remains unconfigured rather than assumed nationwide. Only 2026 national dates are preloaded; other years need their own official declarations added to `holidayCalendarByYear` or configured in Settings. A holiday classification is displayed separately from the user's attendance status and schedule, and does not itself create an absence. Holiday pay is shown as an estimate only when daily wage, schedule, attendance hours, and eligibility inputs are provided. New accounts have no configured salary or personal records; unworked special non-working days remain unpaid by default, and local/company-specific pay rules are not estimated.

Night differential defaults to 10% of hourly base pay for shift hours worked between 10 PM and 6 AM. Earnings summaries are estimates, not finalized payroll; statutory deductions are not calculated. Account deletion uses a Supabase Edge Function and removes the account-owned workspace. Existing browser-only prototype state is not imported automatically because it cannot be safely attributed to an account.
