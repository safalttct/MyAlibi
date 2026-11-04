# MyAlibi

A personal **Leave & WFH tracker** built with Angular 21, Signals, Tailwind CSS 4 and Supabase.

Track Work From Home, Casual, Sick, Compensatory (Comp Off) and Carry Forward leave against
per-period allocations, with a dashboard, records table, calendar, analytics and a comp-off ledger.

## Stack

| Area      | Choice                                                                   |
| --------- | ------------------------------------------------------------------------ |
| Framework | Angular 21 (standalone components, Signals, `OnPush`, Reactive Forms)    |
| Styling   | Tailwind CSS 4 + CSS variables (dark default, light theme), shadcn-style UI primitives |
| Icons     | `@lucide/angular`                                                        |
| Dates     | `date-fns`                                                               |
| Backend   | Supabase (Postgres + Auth + RLS) via `@supabase/supabase-js`             |
| Tests     | Vitest through `ng test`                                                 |
| Lint      | `angular-eslint` flat config                                             |
| Packages  | **pnpm**                                                                 |

## Getting started

```bash
pnpm install
cp .env.example .env        # then fill in your Supabase values
pnpm start                  # http://localhost:4200
```

`.env` (never committed):

```
NG_APP_SUPABASE_URL=https://<project-ref>.supabase.co
NG_APP_SUPABASE_PUBLISHABLE_KEY=<publishable or anon key>
```

`scripts/set-env.mjs` turns those variables into `src/environments/environment.generated.ts`
(git-ignored). It runs automatically before `start`, `build` and `test`, and reads real environment
variables first, so CI/Vercel only need the two `NG_APP_SUPABASE_*` variables. Without them the app
shows a **"Supabase not configured"** screen instead of crashing.
`src/environments/environment.ts` re-exports the generated file with a typed interface.

### Scripts

| Command                          | Purpose                                         |
| -------------------------------- | ----------------------------------------------- |
| `pnpm start`                     | Generate env + dev server                       |
| `pnpm build`                     | Generate env + production build (`dist/myalibi/browser`) |
| `pnpm test` / `pnpm exec ng test --watch=false` | Unit tests (Vitest)             |
| `pnpm lint`                      | ESLint (TypeScript + inline templates)          |

## Database

SQL migrations live in `supabase/migrations/`:

1. `0001_schema.sql` – tables (`profiles`, `leave_records`, `leave_allocations`, `comp_off_transactions`,
   `app_settings`, `import_batches`), constraints and indexes. `leave_records.days` is a **generated
   column** derived from `duration`; the app never sends `days` on insert/update.
2. `0002_rls.sql` – row level security: every table is scoped to `auth.uid()`.
3. `0003_balances.sql` – the `leave_balances` view, `monthly_usage` and `export_user_backup` RPCs, and
   the trigger that mirrors Compensatory Leave records into the comp-off ledger as `used` entries.
4. `0004_secure_functions.sql` – sets `search_path` on helper functions and revokes public `EXECUTE` on
   `SECURITY DEFINER` trigger functions.
5. `0005_fk_indexes.sql` – adds the covering foreign-key indexes `import_batches (user_id)` and
   `leave_records (import_batch_id)`. They are also part of `0001_schema.sql` for fresh installs, and
   0005 uses `if not exists`, so it is a no-op there but upgrades databases created earlier.

Apply them with the Supabase CLI (`supabase db push`) or the SQL editor / MCP tools.

The cloud Supabase project for this repo is **MyAlibi** (`cdwftsuyppligysuwcoj`, `ap-south-1`).
Copy its URL and publishable key into `.env` (see `.env.example`).

### Business rules

- **Balances are never hard-coded.** Dashboard and analytics read the `leave_balances` view; allocations
  are edited in *Settings → Allocations*.
- Records with `status = needs_review` (missing duration) never count towards usage.
- **WFH is tracked separately** from leave in summaries.
- **Comp Off balance comes from the ledger only** (`comp_off_transactions`). Creating a Compensatory
  Leave record adds a linked `used` entry via a DB trigger; manual `used` entries have no
  `leave_record_id`. Interactive overuse is rejected by the trigger; imports may go negative and are
  flagged in the UI.
- Usage percent is safe for zero allocations (0 used → 0 %, otherwise 100 %).

## Features

- **Login** – email/password sign-in and sign-up, error handling, configuration guard.
- **Dashboard** – five balance cards, this-month overview, upcoming/recent entries, quick-add dialogs, mini calendar.
- **Records** – search, category/month/date-range/duration filters, sorting, pagination, create/edit/delete, CSV export.
- **Calendar** – month grid with colour-coded categories, half-day indicator, category filter, add from any date.
- **Analytics** – fiscal (Apr–Mar) or calendar-year period; SVG charts for monthly usage, utilisation, period comparison and cumulative trend.
- **Comp Off** – ledger with running balance, earn / use / adjust forms, expiry handling.
- **Settings** – allocations per category & period, profile (display name, timezone), data management.
- **Data management** – CSV import with preview, validation and de-duplication; CSV export; JSON backup (`export_user_backup`) and client-side restore; import history.

### CSV import

Two sample files are bundled under `src/assets/data/`. Parsing is **by header name**, so column order
does not matter (`Entry, Date, Category, Month, Type, Notes` in any order). Rules:

- values are trimmed; categories are normalised; `April 1, 2026` → `2026-04-01` with no timezone shift;
- `Full Day` / `Half Day` map to 1 / 0.5 days; rows without a duration become `needs_review`;
- rows are identified by `source_key = normalized title | date | category | duration`; files are merged
  and re-imports skip keys already in the database.

The two bundled files reconcile to **29 unique rows (28 complete + 1 `needs_review`)** with totals
WFH 10, Casual 5, Sick 8, Comp 2.

## Project structure

```
src/app/
  core/
    models/        leave.models.ts (types, CATEGORIES, durationToDays)
    utils/         csv, csv-parse-leave, csv-reconcile, source-key, dates, calendar-grid, download
    services/      supabase, auth, leave-records, allocation, balance, comp-off, settings,
                   csv-import, theme, toast, leave-calculation(.service)
    guards/        authGuard, guestGuard
  shared/
    ui/            ui-button, ui-card, ui-badge, ui-input, ui-select, ui-field, ui-dialog,
                   ui-confirm-dialog, ui-empty-state, ui-skeleton, ui-progress, ui-toast-host,
                   ui-bar-chart, ui-line-chart
    components/    leave-record-dialog, settings-tabs, page-header
  layout/          app-shell (desktop sidebar + mobile bottom nav)
  features/        login, dashboard, leave-records, calendar, analytics, comp-off, settings
```

Routes (`app.routes.ts`): `/login` (guest only); behind `authGuard`: `/dashboard`,
`/records`, `/calendar`, `/analytics`, `/comp-off`, `/settings/allocations`, `/settings/profile`,
`/settings/data`. `''` redirects to `/dashboard`.

## Deployment (Vercel)

`vercel.json` builds with `pnpm run build`, serves `dist/myalibi/browser` and rewrites all routes to
`index.html` (SPA). Set `NG_APP_SUPABASE_URL` and `NG_APP_SUPABASE_PUBLISHABLE_KEY` in the Vercel project
environment variables. Only the publishable/anon key is used in the browser; RLS protects the data.

## Security notes

- `.env` and `src/environments/environment.generated.ts` are git-ignored; never commit credentials.
- Never ship a service-role key in the frontend.

## Testing

```bash
pnpm exec ng test --watch=false
```

Covers leave calculation (days, `needs_review` exclusion, zero allocation, categories, monthly usage,
comp-off ledger), CSV parsing for both column orders and incomplete rows, reconciliation of the bundled
CSVs, and `source_key` / `durationToDays`.
