# API Change Template

Use for Express routes, Next.js route handlers, server actions, request/response changes.

1. Read `CURSOR_START_HERE.md`, `API_ROUTES.md`, `PERMISSIONS.md`.
2. Identify route mount and middleware order.
3. Identify consumers in UI/services.
4. Identify models and side effects.
5. For public webhooks or auth routes, stop and request explicit approval.
6. Preserve backward-compatible payload shape unless user approves breaking change.
7. Run syntax/build checks.
8. Update `API_ROUTES.md` and affected domain docs.

Risk default: medium; high/extreme if auth, payments, QuickBooks, scheduling, files, or payroll.
