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
- Created via `POST /api/report-templates/[templateId]/generate-report` with `{ clientId, title, servicePeriodStart?, servicePeriodEnd? }`.
- Sections are stored as independent editable HTML; changes do not affect the source template.
- Status workflow: `DRAFT` → `IN_PROGRESS` → `COMPLETED` → `FINAL`.

#### Report Generation — auto-population (as of 2026-05-25)

Generation fetches: full `Client`, logged-in `User` (session), all active `Program` rows, and all `ParentGoal` + `Target` rows for the client (active phases + mastered within 6 months).

**Expanded placeholder map (`{{key}}` syntax in template HTML):**

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
| `{{provider_name}}` | `session.user.name` or email |
| `{{provider_email}}` | `session.user.email` |
| `{{provider_role}}` | `session.user.role` |
| `{{service_period_start}}` | from request body (optional input in modal) |
| `{{service_period_end}}` | from request body (optional input in modal) |

**Section-type auto-injection** (title keyword matching in `reportGenerationUtils.ts`):

| Section title contains… | Auto-injected content |
|---|---|
| "Service Period" / "Provider Info" | Two-column info table with all client + provider fields |
| "Biopsychosocial" / "Biophysical" | Narrative paragraph: age, diagnosis, school, guardian, intake notes |
| "Why ABA" / "Why Services Needed" | Rationale paragraph with diagnosis and client name |
| "Language" / "Communication" | Category summary + progress bar + goals table |
| "Social" | Category summary + goals table |
| "Adaptive" / "Daily Living" / "Self-Care" | Category summary + goals table |
| "Challenging Behavior" / "Behavior Reduction" | Category summary + goals table |
| "Mastered Goals" | Table of all targets mastered within past 6 months |
| "Current Goals" / "Goals and Objectives" | Table of all active NEW/ACQUISITION/BASELINE targets |
| Any other section | Placeholder substitution only (existing template content preserved) |

**Goal inclusion rules:**
- Included: `Target.phase IN (NEW, ACQUISITION, BASELINE, MAINTENANCE, GENERALIZATION)` AND `isActive = true`
- Included mastered: `Target.phase = MASTERED` AND `dateMastered >= now - 6 months`
- Excluded: `isActive = false`, `ParentGoal.status = ARCHIVED`

**Progress bars:** Unicode block characters (`█░`) — no CSS dependencies, survives HTML sanitizer.

**Not auto-populated (leave as editable placeholders):**
- `[Provider Phone]` — not stored in `User` model
- `[BCBA Credentials]` — not stored in `User` model
- Schema change required to auto-fill these fields.

### ReportTemplate / ReportTemplateSection / ClientReport / ClientReportSection
- Purpose: narrative clinical report templates and client reports.

### TargetAnnotation / TargetLibraryItem / AuditEntry
- Purpose: analytics annotations, reusable target library, audit history.

## Tenant / Organization
- No Tenant or Organization model was confirmed in A Plus scheduling or SmartSteps schemas from evidence.
- Cross-tenant isolation rules: `UNKNOWN — verify before changing.`
