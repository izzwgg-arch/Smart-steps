# Token Cost Hotspots

Avoid loading these unless required.

## Generated / Dependency Folders
- `node_modules/`
- `.next/`
- `aplus-center-scheduling/client/dist/`
- `coverage/`
- build outputs and cache folders.

## Archives / Deploy Bundles
Examples found:
- `*.zip`
- `*.tar`
- `*.tar.gz`
- `*.tgz`
- `deploy-invoice-renumber.zip`
- `deploy-smartsteps-analytics.tgz`
- `aplus-center-scheduling/deploy_*.tar.gz`
- `aplus-center-scheduling/deploy_*.tgz`
- `aplus-center-scheduling/scheduling_client_dist.zip`
- `aplus-center-scheduling/client/dist-*.zip`
- `aplus-center-scheduling/smart-steps/deploy_bundle*.tar.gz`
- `aplus-center-scheduling/smart-steps/deploy_data_linkage_fix.zip`

## Backup / Duplicate Source Trees
- `aplus-center-scheduling/server-pages-backup/`
- `aplus-center-scheduling/smart-steps/deploy_data_linkage_fix/`
- `smart-steps-android-backup/`

These may contain stale duplicates. Do not treat as source of truth unless explicitly investigating rollback/backups.

## Giant Files To Avoid First
- Large page components:
  - `aplus-center-scheduling/client/src/pages/aplus/AppointmentDetailsDrawer.jsx`
  - `aplus-center-scheduling/client/src/pages/aplus/InvoicesPage.jsx`
  - `aplus-center-scheduling/client/src/pages/aplus/ClientDetailPage.jsx`
  - SmartSteps client goal/session components under `smart-steps/src/app/(main)/clients/[clientId]/_components`.
- Prisma schemas are important but high-token; read only relevant model sections when possible.

## Preferred Search Strategy
- Use `rg` for exact route/model/function names.
- Use `Glob` to locate likely files.
- Read small file ranges with offsets for large files.
- Use domain docs in `docs/ai-context` before reading source.
