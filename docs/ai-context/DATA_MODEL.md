# Data Model

Schemas:
- Root app: `prisma/schema.prisma`.
- A Plus scheduling: `aplus-center-scheduling/server/prisma/schema.prisma`.
- SmartSteps: `aplus-center-scheduling/smart-steps/prisma/schema.prisma`.

## A Plus Scheduling Important Models

### User
- Purpose: staff/admin accounts.
- Role enum: `ADMIN`, `BCBA`, `STAFF`.
- Sensitive fields: password hash/reset/invite fields if present in schema.
- Risk: auth/permissions.

### Client
- Purpose: clinic clients.
- Relationships: appointments, invoices, payments, reports, files, waitlist, documents.
- Sensitive fields: contact, health/intake details, address, insurance-like fields.
- Tenant scoped: no Tenant model found in scheduling schema. `UNKNOWN — verify before changing`.

### Appointment
- Purpose: scheduled service.
- Relationships: Client, Provider, Service, Invoice, Report, ReminderJob.
- Fields include `startsAt`, `endsAt`, `durationMinutes`, status, recurrence fields, pricing snapshots.
- High-risk warnings: completion creates invoice; recurrence materializes rows; changes affect reminders, billing, dashboard.

### Invoice
- Purpose: billing record.
- Relationships: Client, optional unique Appointment, line items, payments, activities.
- Sensitive fields: totals, balance, QB/payment IDs, hosted checkout link.
- High-risk warnings: line item edits affect totals/balance; appointment invoices may update duration; QuickBooks sync fields are coupled.

### InvoiceLineItem
- Purpose: invoice row with `description`, `quantity`, `unitPrice`, `amount`, optional `serviceDate`.
- High-risk warnings: update route deletes and recreates all line items when payload includes `lineItems`.

### Payment
- Purpose: manual/provider payment record.
- Relationships: Invoice, Client, Refunds.
- Sensitive fields: external IDs, card brand/last4, billing info, Sola tokens/ref numbers.
- High-risk warnings: `externalPaymentId` is unique; webhook idempotency and QB sync depend on it.

### ClientFile / ClientDocumentRoot / Document
- Purpose: file manager and default folders.
- Relationships: Client; file tree/folders.
- Sensitive fields: file paths, uploaded clinical documents.
- High-risk warnings: do not leak across clients; do not break filesystem/DB alignment.

### Assessment / AssessmentTemplate / AssessmentTemplateSection
- Purpose: client assessment JSON records and reusable ABA assessment template definitions.
- Template sections store `title`, `order`, and rich-text HTML `content` for default clinical wording.
- Template content may contain merge placeholders such as `{{client_name}}`, `{{dob}}`, `{{address}}`, `{{provider_name}}`, and `{{assessment_date}}`.
- When a new template of `type: "ASSESSMENT"` is created, 18 sections are seeded automatically from `DEFAULT_ABA_SECTIONS` in `assessmentTemplate.routes.js`. Each section includes a title and default clinical HTML content with placeholders. Sections 8, 9, 16, and 17 include pre-structured tables (Mastered Goals, Current Goals, Treatment Recommendations, Daily Schedule). Existing templates are never backfilled.
- Section `content` supports sanitized rich-text tables using `table`, `thead`, `tbody`, `tr`, `th`, `td`, plus safe `colspan`/`rowspan` attributes.
- Scope: A Plus scheduling templates are currently global and authenticated-only; no Tenant/Organization model was confirmed.
- High-risk warnings: preserve existing client assessments and report data; sanitize rich-text HTML before saving/rendering.

### AssessmentReport / AssessmentReportSection
- Purpose: client-specific narrative assessment reports generated from assessment templates.
- Generated reports copy template sections into independent `AssessmentReportSection` rows, replacing known placeholders where source data exists and leaving unknown/unavailable placeholders visible.
- Generated report section `content` uses the same sanitized rich-text/table HTML storage as template sections.
- Relationships: `AssessmentReport.clientId` links the report to `Client`; nullable `templateId` records the source template and should not be required for report survival.
- Phase 2 warning: generated report sections are editable snapshots and must not mutate source template sections.
- Phase 4 (print): a "Print / Export PDF" button in the report editor opens a standalone browser window containing a sanitized clinical-layout HTML document and calls `window.print()`. No report data is mutated; content is read directly from React state. Browser "Save as PDF" provides PDF output.
- Not implemented: server-side PDF generation (pdfkit cannot render rich HTML), DOCX export, signatures, version history, autosave, locking, collaborative editing, or advanced spreadsheet/table engine.

### IntegrationAccount / IntegrationSyncLog / QuickBooksApiCallLog
- Purpose: encrypted integration tokens, sync audit, QuickBooks call logging.
- Sensitive fields: encrypted access/refresh tokens, webhook secrets, realm IDs.
- High-risk warnings: token handling and sync logs affect external accounting/payment systems.

### PayrollBatch / Timesheet / Employee
- In A Plus scheduling schema search: not found.
- Status: `UNKNOWN — verify before changing.`

## SmartSteps Important Models

### User / Role
- Role enum: `RBT`, `BCBA`, `ADMIN`.
- Relationships: assignments, sessions, notes, completed assessments, target annotations.

### Client
- Purpose: ABA client profile.
- Relationships: assignments, programs, parent goals, sessions, notes, attachments, behavior plan, assessments, reports.
- Sensitive fields: diagnosis, guardian contact, address, school, insurance ID, intake notes.

### ClientAssignment
- Purpose: assign users to clients.
- Unique: `[clientId, userId]`.
- High-risk warning: governs data access in some, not all, routes.

### Program / ParentGoal / SubGoal / Target
- Purpose: ABA goal/target hierarchy.
- Relationships: targets connect to trials and annotations.
- Target lifecycle (UI): stored on `Target.phase` string — `NEW` (not yet in active treatment), `ACQUISITION` (in treatment), `MASTERED` (mastered). Also supports legacy phases `BASELINE`, `MAINTENANCE`, `GENERALIZATION`. Default for new targets: `NEW`. Mastered uses existing `phase === "MASTERED"` and `dateMastered`.
- High-risk warning: target IDs must link correctly to sessions/trials/charts.

### Session / Trial / BehaviorEvent / IntervalRecording
- Purpose: ABA data capture.
- Relationships: session belongs to client/user; trials belong to target/session.
- High-risk warning: broken links cause analytics/raw data loss.

### AssessmentTemplate / AssessmentSection / AssessmentItem
- Purpose: skill-scoring assessment instruments.

### ClientAssessment / ClientAssessmentResponse
- Purpose: assigned/completed assessment responses.

### ReportTemplate / ReportTemplateSection
- Purpose: document-style ABA clinical report templates (distinct from scoring instruments).
- Stored in DB as `ReportTemplate` + `ReportTemplateSection`. Not to be confused with `AssessmentTemplate`.
- Sections have: `id`, `title`, `order`, `content` (HTML with `{{placeholder}}` syntax).
- Default ABA Assessment template pre-builds 18 sections (Service Period, Biopsychosocial, Why ABA, skill domains, Goals, etc.).

### ClientReport / ClientReportSection
- Purpose: generated clinical report instances (snapshot per client).
- Created via `POST /api/report-templates/[templateId]/generate-report` with `{ clientId, title, assessmentType, bcbaUserId?, servicePeriodStart?, servicePeriodEnd? }`.
- Sections are stored as independent editable HTML; changes do not affect the source template.
- Status workflow: `DRAFT` → `IN_PROGRESS` → `COMPLETED` → `FINAL`.

#### Report Generation — auto-population (as of 2026-05-26)

Generation fetches: full `Client`, selected or session `User` (BCBA), all active `Program` rows, all `ParentGoal` + `Target` rows (active + mastered within 6 months), and a batch of recent `Trial` rows (last 30 days, max 500) for computing current performance levels.

**Assessment type** (`assessmentType: "initial" | "reassessment"`):
- `initial`: no mastered goals; category paragraphs focus on current/future treatment.
- `reassessment` (default): includes mastered goals, progress summaries, in-treatment targets.

**BCBA selection** (`bcbaUserId?`):
- If provided: fetches that `User` for name/email/phone/credentials in the Provider Info section.
- If omitted: falls back to the session user.
- BCBA options loaded in the modal from `GET /api/clients/{clientId}/assignments` filtered to `role=BCBA`.

**Placeholder map — `{{key}}` syntax in template HTML:**

| Placeholder | Source |
|---|---|
| `{{client_name}}` | `Client.name` |
| `{{dob}}` | `Client.dob` (MM/DD/YYYY) |
| `{{age}}` | computed from `Client.dob` |
| `{{address}}` | `Client.address` |
| `{{assessment_date}}` | today's date |
| `{{diagnosis}}` | `Client.diagnosis.join(", ")` |
| `{{insurance_id}}` | `Client.insuranceId` |
| `{{guardian_name}}` | `Client.guardianName` |
| `{{guardian_phone}}` | `Client.guardianPhone` |
| `{{guardian_email}}` | `Client.guardianEmail` |
| `{{school}}` | `Client.school` |
| `{{intake_notes}}` | `Client.intakeNotes` |
| `{{provider_name}}` | selected BCBA name or session user |
| `{{provider_email}}` | BCBA email |
| `{{provider_role}}` | BCBA role |
| `{{provider_phone}}` | `User.phone` (new field) |
| `{{provider_credentials}}` | `User.credentials` (new field) |
| `{{service_period_start}}` | from request body |
| `{{service_period_end}}` | from request body |

**Bracket placeholder replacement** (allow-list, passthrough sections only):
- Patterns like `(Name)`, `(DOB)`, `[Address]`, `[BCBA]` etc. replaced from same values map.
- Only exact known field names from allow-list in `replaceBracketPlaceholders()` are replaced.
- Unknown brackets preserved intact.

**Section-type detection** (keyword matching in `reportGenerationUtils.ts`) — **REPLACE behavior (Option B1)**:

| Section title contains… | Generated content (replaces template) |
|---|---|
| "Service Period" / "Provider Info" | Two-column info table with all client + BCBA fields |
| "Biopsychosocial" / "Biophysical" | Narrative paragraph: age, diagnosis, school, guardian, notes |
| "Why ABA" / "Why Services Needed" | Rationale paragraph with diagnosis and client name |
| "Language" / "Communication" | Written paragraph FIRST, then 8-col active goals table, then mastered table (reassessment) |
| "Social", "Adaptive", "Behavior", "Executive", etc. | Same category paragraph + goals table pattern |
| "Mastered Goals" | Mastered goals table (3 cols); initial assessment shows "no mastered goals" note |
| "Current Goals" / "Goals and Objectives" / "Skill Acquisition" | 8-column active goals table with trial-based current level + progress % |
| "Parent Goals" | 7-column parent goals table: Behavior, Objective, Introduction Date, Baseline, Current Level, Comments, Carrying Over? |
| "New Goals" / "Upcoming Goals" | Table of NEW-phase targets only |
| Any other section | `replacePlaceholders` + `replaceBracketPlaceholders` applied; template content preserved |

**Active/Future Goals table columns:** Behavior/Goal, Objective, Start Date, Baseline Level, Current Level, Progress %, Status, Date Opened

- **Start Date** uses `Target.masteryRule.openedDate` when present (Pass 1), falls back to `Target.createdAt`.
- **Date Opened** uses `ParentGoal.createdAt` (parent goal introduction date).
- **Category group headers** inserted as full-width `<th colspan>` rows when goals span multiple categories (Pass 1).

**Mastered Goals table columns:** Behavior/Goal, Objective, Date Mastered
- Grouped by category with category header rows when multiple categories (Pass 1).

**Parent Goals table columns:** Behavior, Objective, Introduction Date, Baseline Level, Current Level, Comments, Carrying Over?
- Grouped by category with category header rows when multiple categories (Pass 1).

**Category paragraph summaries** (Pass 1 — richer clinical narrative):
- Initial assessment: opens with baseline rationale, lists active targets by name, mentions new/upcoming goals, closes with treatment plan language.
- Reassessment: opens with progress review, names mastered goals (up to 3), describes maintenance/generalization phase if present, names active targets, names new goals, closes with future treatment direction.
- Uses client name throughout; avoids pronouns (uses "the client" / client name).
- Written in clinical paragraph narrative (NOT bullet lists).
- Covers: strengths, deficits, skill acquisition progress, mastered areas, areas still needing intervention, current treatment focus, future direction, behavioral trends, clinical observations.

**BCBA / Provider resolution** (Pass 1):
1. `bcbaUserId` → system user from DB (phone + credentials populated).
2. No `bcbaUserId` + `bcbaManualName` provided → manual entry fields used.
3. Neither → `[BCBA Name]` / `[BCBA Email]` placeholders. Does NOT fall back to session user.

Manual BCBA fields accepted by `generate-report` route: `bcbaManualName`, `bcbaManualEmail`, `bcbaManualCredentials`.

**Client Profile → Assessments page** (Pass 2 — `clients/[clientId]/assessments/page.tsx`):
- Now shows two sections: "Scoring Assessments" (unchanged) and "Clinical Reports" (new).
- Clinical Reports fetched from `GET /api/clients/[clientId]/reports`.
- Each report shows: title, status badge (Draft / Final / Archived), template type badge, sections count, created date, link to `/smart-steps/assessments/reports/[id]` (opens in new tab).

**Trial-based current level:**
- Batch query: last 30 days, max 500 trials per generation, grouped by targetId.
- `correct / total` = Current Level %; shown as "78% (12 trials)" or "—".
- Only `result IN (CORRECT, INDEPENDENT)` counted as correct.

**Goal inclusion rules:**
- Included: `Target.phase IN (NEW, ACQUISITION, BASELINE, MAINTENANCE, GENERALIZATION)` AND `isActive = true`
- Included mastered: `Target.phase = MASTERED` AND `dateMastered >= now - 6 months`
- Excluded: `isActive = false`, `ParentGoal.status = ARCHIVED`

**Print / Export:**
- `printReport()` in `reports/[id]/page.tsx` is async; fetches `GET /api/organization/settings` before printing.
- Org letterhead (logo, name, address, phone, email) injected above report header.
- Org footer injected below all sections.
- Custom `letterheadHtml` / `footerHtml` from `OrganizationSettings` take precedence over auto-generated blocks.

### User (SmartSteps — updated)
- Added fields (migration `20260526001_user_phone_org_settings`):
  - `phone String?` — BCBA/provider phone number for reports
  - `credentials String?` — BCBA credentials (e.g., "BCBA, LBA, MS") for reports

### OrganizationSettings (new — migration `20260526001_user_phone_org_settings`)
- Singleton table (`id = "singleton"`).
- Fields: `orgName`, `orgAddress`, `orgPhone`, `orgEmail`, `logoUrl`, `letterheadHtml`, `footerHtml`, `createdAt`, `updatedAt`.
- API: `GET /api/organization/settings` (all roles), `PATCH /api/organization/settings` (ADMIN/BCBA only).
- Seeded with default row `{ id: "singleton", orgName: "A+ Center" }` on first access.
- Used in printed report letterhead/footer.
- UI: Settings page → "Organization" section (editable by BCBA/ADMIN, read-only for RBT).

### TargetAnnotation / TargetLibraryItem / AuditEntry
- Purpose: analytics annotations, reusable target library, audit history.

## Tenant / Organization
- No Tenant model in A Plus scheduling or SmartSteps schemas.
- Cross-tenant isolation: `UNKNOWN — verify before changing.`
- `OrganizationSettings` in SmartSteps is a single-org singleton, not multi-tenant.
