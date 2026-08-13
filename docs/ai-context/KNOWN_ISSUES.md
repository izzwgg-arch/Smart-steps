# Known Issues and Unknowns

These are documented from repo evidence only. Do not fix them unless explicitly requested.

## A Plus Scheduling
- **RESOLVED (Phase 1 permission system, see `PERMISSIONS.md`)**: every route (appointments, payments, client files, etc.) now goes through `requirePermission("aplus.<area>.<action>")` instead of bare `requireAuth`/`requireRole`, and `Sidebar.jsx` filters nav via `usePermissions().can()`. The old flat `ADMIN/BCBA/STAFF` role gates no longer drive any access decision — see `PERMISSIONS.md` for the full catalog and the exact permission set each seeded role (including BCBA) was granted to preserve day-1 behavior.
- A Plus assessment templates are currently global/authenticated-only because no Tenant/Organization model was confirmed. Add tenant scoping only after the intended isolation model is verified.
- Assessment report PDF/DOCX export via server-side generation is deferred: `pdfkit` (already installed) supports only programmatic plain-text output and cannot render the rich HTML section content (headings, tables, lists). Phase 4 uses browser print / "Save as PDF" as the PDF path. Add server-side PDF only after approving an HTML-to-PDF library (e.g. Puppeteer, WeasyPrint).
- Recurring appointment creation materializes rows and may silently skip conflicted occurrences. No series-wide update API was confirmed.
- `Invoice.pdfPath` exists in Prisma but no server usage was found in `server/src`; status is `UNKNOWN — verify before changing`.
- There are parallel document/file concepts: `ClientFile` / `ClientDocumentRoot` and legacy-looking `Document`. Which UI still uses `Document` is `UNKNOWN — verify before changing`.
- `webhooks.routes.js` VoIP.ms auth path may reference `env` without importing it. Runtime behavior is `UNKNOWN — verify before changing`.
- Voiding invoice sets `status: VOID`; balance recalculation service does not appear to preserve VOID if called later. Confirm before touching invoice lifecycle.

## Billing / Payments / QuickBooks
- QuickBooks invoice lines use hardcoded `ItemRef: { value: "1", name: "Services" }`.
- Payment sync dedupes by successful `IntegrationSyncLog` rows for `entityType: "Payment"`.
- Payment webhooks and browser-post confirmation are public by design; moving auth middleware would break payment providers.
- Payment Hub webhook signature requires configured secret; Sola webhook skips HMAC when secret is unset.
- Exact production payload shapes for Payment Hub/Sola webhooks are `UNKNOWN — verify before changing`.

## SmartSteps ABA
- **RESOLVED (Phase 1 permission system, see `PERMISSIONS.md`)**: the demo-credentials path in `smart-steps/src/auth.ts` is now gated behind `ALLOW_DEMO_LOGIN === "true"` (default off). Every API route now resolves access via `requirePermission*`/`canForClient` against `ClientAssignment`, closing the previous gap where any authenticated RBT could read/write any client's data via the API. `middleware`/`auth.config.ts`'s `authorized()` was rewritten from a 4-substring gate to an explicit allow-list, so every non-public path (including `/assessments`, `/goal-library`, `/staff`, `/goals-and-targets`) now gets a real server-side auth redirect.
- Some SmartSteps APIs appear broad if parameters are omitted, e.g. sessions listing without `clientId`. Re-verify against the Phase 1 `.assigned`/`.all` scoping in `PERMISSIONS.md` before assuming this is still a gap.
- Schedule bridge joins A Plus scheduling clients by lower-trimmed full name; name mismatch risks missing schedule data.

## Payroll / Timesheets
- Payroll, timesheet, and fingerprint scanner code was not found in `aplus-center-scheduling` by static search.
- Root app likely contains timesheet/invoicing functionality based on root `package.json`, but it was not fully mapped in this pass.

## Repo Hygiene
- Many deploy archives and rollback bundles exist in the repo tree.
- `aplus-center-scheduling/server-pages-backup` duplicates page files.
- `smart-steps/deploy_data_linkage_fix` duplicates source-like files and previously caused build/type noise in conversation history.
