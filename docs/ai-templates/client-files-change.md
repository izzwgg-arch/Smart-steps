# Client Files Change Template

Use for folders, uploads, downloads, previews, file permissions, default folder creation.

1. Read `CURSOR_START_HERE.md`, `CLIENT_FILES.md`, `PERMISSIONS.md`, `DATA_MODEL.md`.
2. Identify route in `clientFiles.routes.js`.
3. Identify filesystem path behavior and DB row behavior.
4. Verify client scoping.
5. Avoid hard deletes unless explicitly requested.
6. Test upload/download/rename/move/delete path if behavior changes.
7. Update `CLIENT_FILES.md`.

Risk default: high.
