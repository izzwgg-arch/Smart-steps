# Database Change Template

Use only when schema/model/index/migration changes are explicitly requested.

1. Read `CURSOR_START_HERE.md`, `DATA_MODEL.md`, `SAFE_CHANGE_ZONES.md`.
2. Confirm app boundary and schema file.
3. Identify all code paths that read/write the model.
4. Do not run migrations without explicit approval.
5. Prepare rollback and deployment notes.
6. Consider existing production data.
7. Update `DATA_MODEL.md`.

Risk default: extreme.

If user did not explicitly request database/schema work, do not modify Prisma schema.
