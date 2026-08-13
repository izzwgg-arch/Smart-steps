# Client Files

## Purpose

The A Plus scheduling app has a client file manager with folder roots, nested folders, upload/download, rename, move, and soft delete.

## Important Files
- API: `aplus-center-scheduling/server/src/routes/clientFiles.routes.js`.
- Default folders/root service: `aplus-center-scheduling/server/src/services/documentRootsService.js`.
- UI: `aplus-center-scheduling/client/src/pages/aplus/ClientFilesTab.jsx`.
- Upload middleware: `server/src/middleware/upload.js`.
- Static serving: `server/src/app.js` serves `/uploads`.

## Sections / Default Folder Areas

`clientFiles.routes.js` defines valid sections:
- `files`
- `bba`
- `bbr`
- `ctr`
- `supplements`
- `registration_form`
- `assessments`

These map to folder areas requested by the product:
- BBA
- BBR
- CTR
- Supplements
- Assessments
- Registration Form

## Behavior From Evidence
- List files/folders with search/filter/sort.
- Create folder.
- Upload multipart files.
- Download.
- Rename.
- Move.
- Soft-delete.
- Cascade delete for folder tree.
- Helpers for roots and folder IDs.
- Default client folders are created/ensured by `documentRootsService`.
- Files are stored under `clients/${clientId}/...` in configured upload directory.

## Models
- `ClientFile`
- `ClientDocumentRoot`
- `Document` also exists and may be legacy/parallel.

Status of `Document` usage:
- `UNKNOWN — verify before changing.`

## Risks
- High. Files contain sensitive client documents.
- Do not change path building casually.
- Do not change auth/permissions casually.
- Do not hard-delete unless explicitly required.
- Do not merge folder systems without migration plan.
- Ensure no client can access another client's file tree.
