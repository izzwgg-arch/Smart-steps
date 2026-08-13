# Rules

## Global Rules
- Evidence first. Do not invent functionality.
- If unclear, write `UNKNOWN — verify before changing.`
- Do not edit unrelated files.
- Do not alter production behavior during documentation/stabilization tasks.
- Never run migrations, deploy commands, PM2/nginx changes, or schema changes unless explicitly requested.
- Never change auth, roles, permissions, tenant/data visibility, payment webhooks, payroll calculations, QuickBooks sync, or billing rules casually.

## Source of Truth
- A Plus scheduling runtime server routes: `aplus-center-scheduling/server/src/app.js`.
- A Plus scheduling DB: `aplus-center-scheduling/server/prisma/schema.prisma`.
- A Plus scheduling client routes: `aplus-center-scheduling/client/src/App.jsx`.
- SmartSteps runtime pages/API: `aplus-center-scheduling/smart-steps/src/app`.
- SmartSteps DB: `aplus-center-scheduling/smart-steps/prisma/schema.prisma`.

## Documentation Rules
- Docs must name exact paths.
- Unknowns must remain unknown until verified by repo or runtime evidence.
- Do not copy secrets or production values into docs.
- Document high-risk areas when discovered.

## Coding Rules For Future Sessions
- List candidate files before editing.
- Read surrounding code before patching.
- Prefer local patterns over new abstractions.
- For database-backed behavior, identify model, route, service, UI, and deployment impact before edits.
- After edits, run the narrowest safe check available.

## High-Risk No-Go Without Explicit Approval
- Database migrations.
- Auth/session changes.
- Permission broadening or narrowing.
- Payment provider or webhook behavior.
- Payroll calculation logic.
- QuickBooks token/sync logic.
- Cross-client / cross-tenant data access.
- Server/nginx/PM2/deploy config.
