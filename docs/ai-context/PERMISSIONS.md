# Permissions (Phase 1 — Granular RBAC)

> Status: Phase 1 implemented across both apps (see `PENDING`/`Phase 2` notes at
> the bottom). This replaces the pre-Phase-1 investigation notes that used to
> live in this file; the old flat `ADMIN/BCBA/STAFF` role-string gates
> described there no longer exist — every route now resolves access through
> the `Role`/`Permission`/`RolePermission` tables described below.

Both apps keep their **own** database and their **own** Role/Permission
tables — there is no shared identity store. The SSO bridge
(`smart-steps/src/app/api/sso/route.ts`) still mints a SmartSteps session from
an A+ Center JWT, but each side resolves permissions independently from its
own DB once the session exists.

## Architecture (both apps, same shape)

```
User.roleId  ──►  Role  ──►  RolePermission  ──►  Permission.key
 (nullable FK)   (system    (boolean grant,      (e.g. "aplus.clients.view",
                  or later   role either has it   "smartsteps.reports.edit")
                  custom)    or doesn't)
```

- `Role` (A Plus) / `AppRole` (SmartSteps): `id, key, name, description, isSystem, isActive`. Seeded system roles are `isSystem: true`; Phase 1 only supports **editing** the seeded roles' permission sets, not creating brand-new custom roles (that's Phase 2).
- `Permission` (A Plus) / `AppPermission` (SmartSteps): `id, key (unique), category, label`. Seeded once from a static catalog file — **not** admin-editable in Phase 1 (the catalog is the single source of truth; adding a new permission means adding a new route check + catalog entry + re-seeding, not a UI action).
- `RolePermission` (A Plus) / `AppRolePermission` (SmartSteps): join table, `@@unique([roleId, permissionId])` — a role either has a permission or it doesn't. There is no per-user override in Phase 1.
- `User.roleId` (A Plus) / `User.appRoleId` (SmartSteps): nullable FK added **alongside** the pre-existing legacy `role` enum column, which is kept for backward compatibility/display and is **no longer used for any access decision**.

A user with no `roleId`/`appRoleId` set (or whose role has been deactivated) resolves to an **empty permission set** — fail closed, not "trust the legacy enum."

Migrations:
- A Plus: `server/prisma/migrations/20260702000000_permission_system/migration.sql`
- SmartSteps: `smart-steps/prisma/migrations/20260702000000_permission_system/migration.sql`

Seed scripts (idempotent — safe to re-run; upserts permissions/roles, backfills `roleId`/`appRoleId` for any user missing it):
- A Plus: `server/src/scripts/seedPermissions.js` (npm script: `seed:permissions`)
- SmartSteps: `smart-steps/prisma/seedPermissions.ts` (npm script: `seed:permissions`)

Both are pure-additive migrations. Nothing was dropped or renamed; rollback = redeploy the previous code version, leaving the new tables/columns inert.

## Permission catalogs (single source of truth)

- A Plus: `server/src/config/permissions.js` — exports `PERMISSIONS`, `PERMISSION_KEYS`, `SYSTEM_ROLES`, `LEGACY_ROLE_KEY_MAP`.
- SmartSteps: `smart-steps/src/lib/permissionKeys.ts` — same shape, plus `scopedKeyPair(baseKey)` for the assigned/all scoping convention below.

Key naming convention: `{app}.{category}.{action}`, e.g. `aplus.appointments.cancel`, `smartsteps.report_templates.manage`. SmartSteps additionally encodes **scope** directly in the key for anything client-scoped: `smartsteps.clients.view.assigned` vs `smartsteps.clients.view.all` — there is no separate scope flag, matching the plan's own examples.

### A Plus categories (see `server/src/config/permissions.js` for the full ~70-key list)
dashboard, clients, appointments, billing, providers, services, reports, settings, quickbooks, integrations, communications, users, audit, waitlist, data_tracking, intake, client_files, assessments, assessment_templates, assessment_reports.

### SmartSteps categories (see `smart-steps/src/lib/permissionKeys.ts` for the full ~70-key list)
dashboard, clients, goals, targets, sessions, trials, notes, behavior_plan, assessments, assessment_templates, reports, report_templates, goal_library, parent_goal_library, target_library, staff, assignments, organization_settings, permissions, parent_portal, insights, programs, sync, audit.

### Seeded system roles

**A Plus** (`SYSTEM_ROLES` in `permissions.js`): `Admin`, `BCBA`, `Staff` (legacy-faithful backfill targets — every existing account keeps **exactly** its current effective access), plus curated Phase-1 presets an admin can move people into: `Owner`, `Office Admin`, `Scheduler`, `Billing Manager`, `Receptionist`, `Provider`, `Read Only`.

**SmartSteps** (`SYSTEM_ROLES` in `permissionKeys.ts`): `RBT`, `BCBA`, `Admin` (legacy-faithful backfill targets), plus `Supervisor` (BCBA + `assignments.manage`), `Parent Viewer` (single-client read-only, used by the parent-portal token path, not staff logins), `Read Only`.

**Important, approved behavior change:** SmartSteps RBTs previously could read/write **any** client via the API despite the UI only showing assigned ones (no `ClientAssignment` check existed anywhere). Phase 1 introduces real assigned-vs-all scope enforcement for RBTs — this is an intentional security fix per the approved plan, not a regression. BCBA/Admin retain unrestricted (`.all`) access, matching prior behavior.

**Stricter RBT model (final, approved 2026-07-03):** the default RBT preset does **not** grant `smartsteps.assessments.view.assigned`, `smartsteps.reports.view.assigned`, or `smartsteps.organization_settings.view` — RBT has zero access to assessments (scoring + results), clinical reports (viewer/generation/export), and organization settings, even for their own assigned clients. RBT keeps only: assigned clients (`clients.view.assigned`), read-only goals/targets/programs for assigned clients, data entry (sessions/trials), session notes, and read-only goal/parent-goal libraries. Because `BCBA_PERMISSIONS` is partly derived by filtering `RBT_PERMISSIONS`, removing `organization_settings.view` from RBT required re-adding it explicitly to `BCBA_PERMISSIONS` (it was previously inherited) — see `permissionKeys.ts`. Enforcement is three-layered: (1) top-nav items for Assessments/Reports/Organization settings are hidden via `anyOf` checks in `(main)/layout.tsx` and `(main)/settings/page.tsx`; (2) every assessment/report page (top-level and per-client) is wrapped in `<RequirePermission>` so a direct URL renders "Access denied" instead of a broken/blank page; (3) the API routes (`canForClient`/`requireClientAccessResponse` in `permissions.ts`) fail closed — an RBT holding neither the `.assigned` nor `.all` variant of a scoped key gets a `403` even when hitting their own assigned client's assessment/report URL directly.

### Legacy role → system role backfill map
- A Plus: `ADMIN→ADMIN, BCBA→BCBA, STAFF→STAFF` (`LEGACY_ROLE_KEY_MAP` in `permissions.js`).
- SmartSteps: `ADMIN→ADMIN, BCBA→BCBA, RBT→RBT` (`LEGACY_ROLE_KEY_MAP` in `permissionKeys.ts`).

## Centralized enforcement helpers

**A Plus** — `server/src/services/permissionsService.js` + `server/src/middleware/permissions.js`:
- `getUserPermissions(userId)` / `getUserRoleKey(userId)` — resolve from `User.roleId → Role → RolePermission → Permission.key`, cached in-memory per-user for 5s (`CACHE_TTL_MS`) so a role/permission edit takes effect within a few seconds without requiring logout.
- `can(userId, key)`, `canAny(userId, keys)` — inline checks.
- `requirePermission(key)`, `requireAnyPermission(...keys)` — Express middleware; on denial, responds `403` and writes a `PERMISSION_DENIED` audit log entry (path/method/required-permission in `metadata`).
- `invalidateUserCache(userId)` / `invalidateAllCache()` — called by every route that mutates a role's grants or a user's role assignment.

**SmartSteps** — `smart-steps/src/lib/permissions.ts`:
- `getUserPermissions`, `getUserRoleKey`, `can`, `canAny` — same shape/cache TTL as A Plus, resolving `User.appRoleId → AppRole → AppRolePermission → AppPermission.key`.
- `canForClient(userId, clientId, baseKey)` / `accessibleClientIds(userId, baseKey)` — the assigned/all scoping logic: holding the `.all` variant of `baseKey` grants unconditional access; holding only `.assigned` requires a matching `ClientAssignment` row for that `clientId` (checked at the query level, not just in the UI).
- `requirePermissionResponse`, `requireAnyPermissionResponse`, `requireClientAccessResponse` — route-guard helpers returning a `403 NextResponse` (with a `PERMISSION_DENIED` audit log write) or `null` to proceed. Usage pattern in every route:
  ```ts
  const user = await requireSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermissionResponse(user.id, "smartsteps.staff.view");
  if (denied) return denied;
  ```
- `requireSession()` (`smart-steps/src/lib/session.ts`) centralizes the previous ad hoc `auth()` + `ensureUser()` pattern (previously called from only ~2 of ~30 route files) so the DB `User`/`appRoleId` row is always in sync before any permission check runs.

## Identity/session fixes shipped alongside the permission system

- **Role-mapping gap fixed**: `smart-steps/src/lib/roleMapping.ts` (`mapAplusRoleToSmartStepsRole`) explicitly maps A+ `ADMIN/BCBA/STAFF → ADMIN/BCBA/RBT`, replacing the old `role: payload.role || "RBT"` passthrough that let a literal `"STAFF"` slip through unmapped and silently fail `=== "RBT"` checks. Used by both `src/auth.ts` and `src/app/api/sso/route.ts`.
- **Demo-login backdoor gated**: the standalone credentials path (`*@admin.com`/`*@bcba.com` + password `"demo"`/`"password"`) in `src/auth.ts` is now gated behind `process.env.ALLOW_DEMO_LOGIN === "true"` (defaults off/production-safe). The SSO path is unaffected.
- **Middleware allow/deny list rewritten**: `smart-steps/src/auth.config.ts`'s `authorized()` callback replaced the old substring gate (`path.includes("/dashboard"|"/clients"|"/reports"|"/settings")`, which left `/assessments`, `/goal-library`, `/staff`, `/goals-and-targets` etc. rendering client-side with **no** server-side auth check) with an explicit `PUBLIC_EXACT_PATHS`/`PUBLIC_PREFIXES` allow-list; everything else requires a session or redirects to `/login`. Note: middleware runs on the Edge runtime and only checks *authentication*, not fine-grained permissions (Edge can't hold a DB connection) — granular permission checks happen in the API routes and in a client-side `RequirePermission` gate (see below).

## UI enforcement

**A Plus** (`client/src/...`):
- `context/PermissionsContext.jsx` — `PermissionsProvider` + `usePermissions()` hook. Fetches `/api/auth/permissions`, caches for 30s, exposes `permissions` (Set), `roleKey`, `can`, `canAny`, `canAll`, `refresh`.
- `components/common/PermissionRoute.jsx` — `PermissionRoute` (top-level route wrapper, includes auth check) and `RequirePermission` (nested-route wrapper, permission check only); both render an `AccessDenied` state rather than silently hiding content.
- `components/layout/Sidebar.jsx` — filters nav `links` by `can(item.permission)`.
- `App.jsx` — every `/aplus/*` route wrapped in `RequirePermission` with its required key.
- `pages/aplus/PermissionsPage.jsx` (`/aplus/settings/permissions`) — role list w/ user counts, per-role permission checklist (grouped by category, save via `PATCH /api/roles/:id`), per-user role reassignment (`PATCH /api/users/:id/role-id`).

**SmartSteps** (`smart-steps/src/...`):
- `hooks/usePermissions.ts` — React Query hook (`@tanstack/react-query`), fetches `/smart-steps/api/permissions/me`, `staleTime: 30s`, exposes `permissions`, `roleKey`, `can`, `canAny`, `canAll`, `refresh`. Fails closed (`can()` returns `false`) while loading/unauthenticated.
- `components/common/RequirePermission.tsx` — client-side page gate; renders an "Access denied" state instead of page content when the permission check fails. (Final enforcement is always the API route; this matches the page-level UX so users don't hit broken/empty pages, since Edge middleware can't do a DB-backed granular check.)
- `app/(main)/layout.tsx` — `NAV` array items each carry an `anyOf: string[] | null` permission list; `visibleNav = NAV.filter((item) => canAny(item.anyOf))`. `anyOf: null` (Settings) means always visible to any authenticated user.
- `app/(main)/settings/permissions/page.tsx` (`/smart-steps/settings/permissions`, gated by `smartsteps.permissions.manage`) — same shape as the A Plus page: role list, per-role permission checklist (`PATCH /smart-steps/api/roles/:roleId`), per-user role reassignment (`PATCH /smart-steps/api/staff/:userId` with `{ appRoleId }`).
- `app/(main)/settings/page.tsx` — links to the permissions page, shown only when `can("smartsteps.permissions.manage")`.

## New API surface (management pages)

**A Plus**: `server/src/routes/role.routes.js` (mounted `/api/roles`) — `GET /` (list + user counts), `GET /:id` (detail + assigned users), `PATCH /:id` (name/description/isActive/permission-checklist; invalidates all caches, writes `ROLE_UPDATED` audit log). `server/src/routes/permission.routes.js` (mounted `/api/permissions`) — `GET /` (catalog grouped by category). `server/src/routes/auth.routes.js` gained `GET /api/auth/permissions` (effective permissions + roleKey for the caller).

**SmartSteps**: `app/api/roles/route.ts` (`GET /smart-steps/api/roles`), `app/api/roles/[roleId]/route.ts` (`GET`/`PATCH`, same shape as A Plus), `app/api/permissions/route.ts` (catalog), `app/api/permissions/me/route.ts` (effective permissions + roleKey for the caller). `app/api/staff/[userId]/route.ts` PATCH now accepts `appRoleId` (requires `smartsteps.staff.manage_roles`, invalidates that user's cache, writes `USER_ROLE_ASSIGNED`).

All four management endpoints (both apps) are gated behind `aplus.settings.manage_permissions` / `smartsteps.permissions.manage` respectively — granted only to `Admin`/`Owner` (A Plus) and `Admin` (SmartSteps) by default.

## Audit logging

Both apps already had a flexible free-text `action` audit table (A Plus `AuditLog`, SmartSteps `AuditEntry`) — no schema change was needed, just new `action` values written through the existing services (`server/src/services/auditLogService.js` → `writeAuditLog`, `smart-steps/src/lib/auditLogger.ts` → `auditLog`). New/relevant action values:

| Action | Where written | Notes |
|---|---|---|
| `PERMISSION_DENIED` | `middleware/permissions.js` (A Plus), `lib/permissions.ts` `logDenied()` (SmartSteps) | Written centrally by every `requirePermission*`/`requireAnyPermission*`/`requireClientAccessResponse` helper on a 403 — no per-route wiring needed. |
| `ROLE_UPDATED` | `routes/role.routes.js` PATCH (A Plus), `api/roles/[roleId]/route.ts` PATCH (SmartSteps) | `metadata`/`details` include `roleKey`, `changedFields`, whether the permission set changed and the new count. |
| `USER_ROLE_ASSIGNED` | `routes/user.routes.js` `PATCH /:id/role-id` (A Plus), `api/staff/[userId]/route.ts` PATCH (SmartSteps, when `appRoleId` present) | Records the target user + new role id/key/name. |
| `CLIENT_ASSIGNMENT_CREATED` / `CLIENT_ASSIGNMENT_REMOVED` | `api/clients/[clientId]/assignments/route.ts` POST/DELETE (SmartSteps only — A Plus has no client-assignment concept) | Records `clientId`, `userId`, assignment role. |

A dedicated audit-log **UI** for SmartSteps (A Plus already has `AuditLogsPage.jsx`) is deferred to Phase 2 (see below); entries are written from Phase 1 onward regardless, so no data is lost by deferring the viewer.

## Testing

- Unit tests for the pure permission-resolution/caching/scoping logic (mocking the Prisma singleton's model delegates directly — no live DB required):
  - A Plus: `server/src/services/permissionsService.test.js` (11 tests — resolution, fail-closed cases, cache TTL, `invalidateUserCache`/`invalidateAllCache`, `can`/`canAny`).
  - SmartSteps: `smart-steps/src/lib/permissions.test.ts` (17 tests — same coverage plus `canForClient`/`accessibleClientIds` assigned-vs-all scoping and the `require*Response` 403 shapes).
  - Run via `npm test` in each app (`server`: `node --test "src/**/*.test.js"`; `smart-steps`: `node --import tsx --test "src/**/*.test.ts"` — both package.json `test` scripts were fixed as part of this work; the previous `node --test src` invocation didn't recurse correctly on this toolchain).
- `npx tsc --noEmit` (SmartSteps) — clean.
- `npx eslint .` (SmartSteps) — 0 errors/warnings in every file touched by this project; the ~90 pre-existing errors/warnings reported elsewhere in the app (`goals-and-targets/page.tsx`, `reports/page.tsx`, `app/page.tsx`, etc.) predate this work and are out of scope.
- `npm run build` (A Plus client, `vite build`) — clean.
- `npm run build` (SmartSteps, `next build`) — clean production build, including the new `/settings/permissions` page and `/api/roles`, `/api/permissions` routes.
- A Plus server: `node --check` on every new/modified route file, plus a full `app.js` import smoke test — clean.
- **Not done / blocked in this environment**: a live manual smoke-test + screenshot pass against running dev servers. Neither app has a `.env`/`DATABASE_URL` configured in this workspace (no local Postgres instance), so the dev servers can't actually boot against real data. The validation checklist below should be run manually once a dev DB is available, before deploying.

### Manual validation checklist (run once a dev DB is available)
1. Seed both DBs (`npm run seed:permissions` in each app) and confirm every existing user still has the same effective access as before (spot-check one ADMIN/Admin, one BCBA, one STAFF/RBT account per app).
2. Log in as an RBT: confirm nav hides Staff; confirm `/staff` renders "Access denied"; confirm the API returns 403 for another client's data and 200 for an assigned client's data.
3. Log in as Admin/BCBA: confirm full nav, confirm `/settings/permissions` (SmartSteps) / `/aplus/settings/permissions` (A Plus) loads, edit a role's permission checklist, save, and confirm a logged-in user in that role sees the nav change within ~30s without re-login.
4. Reassign a user to a different role from the Permissions page; confirm `USER_ROLE_ASSIGNED` appears in the audit log (A Plus: Audit Logs page; SmartSteps: query `AuditEntry` directly, no UI yet).
5. Open the previously-404ing assessment report link (`clients/[clientId]/assessments` → click a generated report) and confirm it now opens successfully.
6. Confirm `ALLOW_DEMO_LOGIN` unset/false blocks the `*@admin.com`/`*@bcba.com` demo credentials path in production-like config.

## Must Never Leak (unchanged from pre-Phase-1 audit)
- Client demographics/contact/diagnosis/intake/insurance.
- Client files and folders.
- Appointment details.
- Payment/invoice records.
- ABA session/trial data.
- Parent portal links/tokens.
- Cross-client or cross-tenant data (now enforced for SmartSteps RBTs via `ClientAssignment` scoping — previously not enforced at all beyond UI hiding).

## Phase 2 (explicitly deferred, not built)
- Free-form custom role creation (new role names beyond the seeded set — Phase 1 only supports editing seeded roles' permission checklists).
- Effective-permissions debug viewer.
- Per-user direct grant/deny overrides (permissions are role-level only in Phase 1).
- Dedicated SmartSteps audit-log UI/report screen (entries are written from Phase 1 onward; A Plus already has one).
- Goal-attach / parent-goal-attach from the assessment/report editor (confirmed not implemented anywhere pre-Phase-1; unrelated net-new feature).
