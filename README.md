# A Plus Center - ABA Timesheet, Analytics & Insurance Invoicing Platform

A comprehensive web application for managing ABA (Applied Behavior Analysis) operations including timesheets, analytics, and insurance invoicing.

## Features

- **User Management**: Role-based access (Admin/User) with scheduled activation
- **Dashboard**: Centralized view with navigation to all modules
- **Provider Management**: Manage ABA providers with signatures
- **Client Management**: Track clients and their insurance information
- **BCBA Management**: Manage Board Certified Behavior Analysts
- **Insurance Management**: Configure insurance rates (rate changes don't affect existing invoices)
- **Timesheet System**: Create, submit, approve, and lock timesheets with workflow
- **Parent ABC notes**: Per-row behavior tracking (Antecedent / Behavior /
  Consequence on every line, not one behavior per sheet)
- **Multiple services per day**: A BCBA can log Treatment Planning and Supervision on the
  same day, with overlap checks keeping client, provider and BCBA times from colliding
- **Supervising BCBA (limited permit / LBA support)**: A BCBA timesheet can name an
  optional **Supervising BCBA** — the licensed BCBA whose license the work is billed
  under when the performing clinician holds a limited permit. See
  "Supervising BCBA on BCBA timesheets" below.
- **Automatic Invoicing**: Scheduled weekly invoice generation (Fridays at 4 PM ET)
- **Manual Invoicing**: Create invoices by date range
- **Payment Tracking**: Record payments with partial payment support
- **Advanced Analytics**: Visual charts (line, bar, pie, waterfall) with detailed filtering
- **Reports**: Generate PDF, CSV, and Excel reports
- **Audit Logs**: Complete audit trail for all critical actions
- **Notifications**: In-app notifications for important events

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **PDF Generation**: PDFKit
- **Scheduling**: node-cron
- **Deployment**: PM2 + Nginx

## Prerequisites

- Node.js 20.x or higher
- PostgreSQL 14 or higher
- npm or yarn

## Installation

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd a-plus-center
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and secrets
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
# Or use migrations: npx prisma migrate dev
```

5. Create an admin user (you'll need to create a script for this):
```bash
npm run create-admin
```

6. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Server Deployment

1. SSH into your server:
```bash
ssh root@66.94.105.43
```

2. Run the deployment script:
```bash
chmod +x deploy.sh
./deploy.sh
```

3. Upload your application files to `/var/www/aplus-center`

4. Configure environment variables:
```bash
cd /var/www/aplus-center
nano .env
# Update DATABASE_URL, NEXTAUTH_SECRET, etc.
```

5. Install dependencies and build:
```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

6. Start with PM2:
```bash
pm2 start deploy/pm2.config.js
pm2 save
pm2 startup
```

7. Configure Nginx:
```bash
cp deploy/nginx.conf /etc/nginx/sites-available/aplus-center
ln -s /etc/nginx/sites-available/aplus-center /etc/nginx/sites-enabled/
# Update server_name and SSL certificates
nginx -t
systemctl reload nginx
```

8. Set up SSL (optional but recommended):
```bash
apt-get install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

## Project Structure

```
a-plus-center/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── (auth)/            # Auth pages (login, etc.)
│   ├── dashboard/         # Dashboard page
│   ├── providers/         # Provider management
│   ├── clients/           # Client management
│   ├── bcbas/             # BCBA management
│   ├── insurance/         # Insurance management
│   ├── timesheets/        # Timesheet management
│   ├── invoices/          # Invoice management
│   ├── analytics/         # Analytics dashboard
│   ├── reports/           # Reports page
│   └── layout.tsx         # Root layout
├── components/            # React components
├── lib/                   # Utility functions
│   ├── prisma.ts         # Prisma client
│   ├── auth.ts           # NextAuth config
│   └── utils.ts          # Helper functions
├── prisma/               # Database schema
│   └── schema.prisma
├── types/                # TypeScript types
├── deploy/               # Deployment configs
└── public/               # Static assets
```

## Parent ABC notes: behavior is per row

On the Parent ABC data sheet (`/forms/parent-abc`,
`components/forms/ParentABCForm.tsx`) **each row records its own behavior**. The
table follows true A-B-C order — Antecedent, **Behavior**, Consequence — so one
sheet can log several different behaviors across the month.

Behavior used to be a single page-level header field, which forced every incident
on a sheet to share one behavior. That field is gone from both the on-screen and
printed headers.

- **Storage:** each row in `FormDocument.payload.rows` carries a `behavior`.
- **`FormDocument.behavior`** (the old header column) is kept populated with the
  distinct behaviors on the sheet, comma-separated, so the column stays
  informative. It is no longer the source of truth.
- **Back-compat:** when a sheet saved under the old scheme is opened, its single
  page-level `behavior` seeds every row, so historical records still read
  correctly. Re-saving writes the per-row values.
- Behavior is free text (like the old field), not a dropdown, and is **required on
  every row** — a row needs Date, Antecedent, Behavior and Consequence to save.
  A row that is started but left without a behavior blocks the save with a message
  naming how many rows are missing it, rather than being silently dropped.

### The `/bcbas/forms` routes are retired (2026-09-23)

Every route under `/bcbas/forms` was backed by tables that **do not exist in the
production database** — `ParentABCData`, `ParentABCDataRow`,
`ParentTrainingSignIn`, `ParentTrainingSignInRow`, `VisitAttestation`,
`VisitAttestationRow` are all absent; only `FormDocument` exists. Any real use
threw, and the ABC variant still applied one behavior to every row.

All seven pages are now thin `redirect()` stubs pointing at the working `/forms`
equivalents, so old links and bookmarks land somewhere that works. The original
implementations (and the unused `app/api/bcbas/forms/*` routes) remain in git
history. The `ParentABCData*` / `ParentTrainingSignIn*` / `VisitAttestation*`
models are still declared in `schema.prisma` but are unused by the live app.

## Overlap rules and multiple services per day

A BCBA can deliver more than one service on the same day — Treatment Planning **and**
Supervision, for example. Each day row on the BCBA timesheet has **`+ Add`**, which adds
another row for that same date with its own service type and time range; each row is
saved as its own entry. `Remove` appears only on extra rows, so a day always keeps at
least one (untick USE to exclude the day).

Overlap detection (`lib/server/timesheetOverlapValidation.ts`) now runs for **both**
timesheet types — it used to be skipped entirely for BCBA timesheets:

| Who | Matched against |
| --- | --- |
| **Client** (the child) | **Both** types — a child cannot be in two services at once, even across a regular and a BCBA timesheet |
| **Provider** | Regular ↔ regular only |
| **BCBA** | BCBA ↔ BCBA only |
| **Within one timesheet** | Always — this is what stops same-day Treatment Planning and Supervision from overlapping each other |

Two deliberate asymmetries, both load-bearing:

- **BCBA timesheets store a placeholder `providerId`** (the first active provider — see
  the POST route). Matching on it would raise conflicts against a provider who was never
  involved, so provider matching is restricted to regular timesheets.
- **A regular timesheet's BCBA is a supervisor of record**, not someone physically
  present, so that is not treated as a scheduling clash. `bcbaId` is only matched between
  BCBA timesheets, where it is the person who actually delivered the service.

Conflicts come back as `code: 'OVERLAP_CONFLICT'` with a `conflicts` array; both forms
highlight the offending rows and show the reason.

**Fixed alongside this:** the BCBA edit form used to load a day with
`dayEntries[0]` — it filtered every entry for a date then kept only the first, so a
timesheet with two same-day entries lost the second on edit + save. It now builds one row
per saved entry.

## Supervising BCBA (BCBA *and* regular timesheets)

A clinician working on a **limited permit** (an LBA) delivers BCBA-level services under
a licensed BCBA's license. Both timesheet types therefore carry two BCBAs:

| Field | Meaning |
| --- | --- |
| **BCBA** (`bcbaId`, required) | On a BCBA timesheet, the clinician who performed the sessions; on a regular timesheet, the BCBA of record for the provider's work. **All hours count toward this person.** |
| **Supervising BCBA** (`supervisingBcbaId`, optional) | The licensed BCBA whose license that person works under. Billing identity only. |

`supervisingBcbaId` lives on the shared `Timesheet` model and both API routes handle it
without an `isBCBA` gate, so the same field serves both types.

Set it in the Assignment section of either form. The dropdown excludes whoever is
already selected as the performing BCBA, and the API rejects a supervisor equal to the
performer.

**Being a supervisor never restricts that BCBA's own timesheets.** The performing **BCBA**
dropdown has no exclusions — every active BCBA is always selectable, including one who is
named as Supervising BCBA elsewhere. The exclusion above is scoped to a single timesheet
(so nobody is their own supervisor) and there is no unique constraint, so the same BCBA can
be supervisor on any number of an LBA's timesheets *and* the performing BCBA on her own,
covering the same dates and the same hours. BCBA timesheets skip overlap detection
entirely, so that raises no schedule conflict.

**What changes when a Supervising BCBA is set**

- The printed timesheet and PDF show **both names** on both timesheet types: the existing
  `BCBA` line plus an additional `Supervising BCBA` line. The performer is
  never replaced — these timesheets are the practice's own record of who delivered the
  sessions, and the biller decides what goes to the payer.
- **Signatures, BCBA timesheets only.** With a supervisor set, the signature area becomes
  two columns: `BCBA Signature` (the performing clinician, for their own hours) and
  `Supervising BCBA Signature` (because the work was delivered under that license).
  With no supervisor it stays a single `BCBA Signature` block, exactly as before
  (`lib/pdf/timesheetHtmlTemplate.ts`, `components/timesheets/TimesheetPrintPreview.tsx`).
  **Regular timesheets are unchanged here** — they sign Client + Provider and have never
  had a BCBA signature block, so the supervising BCBA appears by name only.
- The batch email summary lists the performing clinician, matching the PDF's `BCBA` line.
- Both timesheet lists show the BCBA with `under <supervisor>` beneath the name.

**What deliberately does NOT change — the supervising BCBA is never "interrupted"**

- **Hours stay attributed to `bcbaId`.** `supervisingBcbaId` appears in no aggregation,
  no `where` clause, and no totals anywhere in the app. Naming a supervisor cannot add
  a single minute to that person's own numbers.
- **Analytics and Reports** filter on `bcbaId` only (`app/api/analytics/route.ts`,
  `lib/reports/queryBuilder.ts`), so the supervisor's own totals are unaffected and the
  LBA keeps their own line.
- **Schedule / overlap detection is untouched.** `lib/server/timesheetOverlapValidation.ts`
  matches on `providerId` and `clientId` only and skips BCBA timesheets entirely
  (`isBCBA: false`), so a supervisor can never be flagged as double-booked for sessions
  they did not personally deliver.
- **Payroll is unrelated** — it is driven by scanner imports through `PayrollEmployee`
  and never reads `bcbaId` or `supervisingBcbaId`.
- **Invoicing** groups by client and insurance, not by BCBA.

The field is nullable and additive (migration
`prisma/migrations/20260923120000_add_timesheet_supervising_bcba`); existing timesheets
are untouched and behave exactly as before.

## Environment Variables

Required environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: Your application URL
- `NEXTAUTH_SECRET`: Secret for NextAuth (generate with `openssl rand -base64 32`)
- `NODE_ENV`: `development` or `production`
- `TZ`: Timezone (default: `America/New_York`)

## Password Requirements

User passwords must:
- Be 10-15 characters long
- Contain at least 1 uppercase letter
- Contain at least 1 lowercase letter
- Contain at least 1 special character

## Scheduled Jobs

The application includes automatic invoice generation:
- Runs every Friday at 4:00 PM America/New_York time
- Generates invoices for approved timesheets
- Locks related timesheets after invoicing

## License

Proprietary - All rights reserved

## Support

For issues or questions, please contact the development team.
