# Permissions Change Template

Use for auth, roles, admin/staff/BCBA/RBT gates, client assignment, data visibility.

1. Read `CURSOR_START_HERE.md`, `PERMISSIONS.md`, `DATA_MODEL.md`, `API_ROUTES.md`.
2. Identify current role checks in UI and API.
3. Identify data scope rules for each model.
4. Treat UI hiding as non-security.
5. Verify no cross-client/cross-tenant leak.
6. Ask for explicit expected permission matrix if unclear.
7. Update `PERMISSIONS.md`.

Risk default: extreme.

If unclear, write `UNKNOWN — verify before changing`.
