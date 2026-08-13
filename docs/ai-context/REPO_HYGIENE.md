# Repo Hygiene

## Current Hygiene Findings

The repo contains source apps plus generated/deploy/backup artifacts.

High-cost artifacts found:
- Deploy archives: `*.zip`, `*.tar`, `*.tar.gz`, `*.tgz`.
- Built client output: `aplus-center-scheduling/client/dist`.
- SmartSteps deploy bundles under `aplus-center-scheduling/smart-steps`.
- Backup page tree: `aplus-center-scheduling/server-pages-backup`.
- Android backup app: `smart-steps-android-backup`.

## Source of Truth Rules
- A Plus scheduling server source: `aplus-center-scheduling/server/src`.
- A Plus scheduling client source: `aplus-center-scheduling/client/src`.
- SmartSteps source: `aplus-center-scheduling/smart-steps/src`.
- Do not use `server-pages-backup`, deploy bundles, archives, or generated dirs as source of truth unless doing rollback/forensics.

## Cursor Ignore Policy
`.cursorignore` should exclude:
- dependencies
- builds
- generated artifacts
- archives
- logs
- backups
- temporary diagnostics

It must not exclude active source directories.

## Cleanup Recommendation
Do not delete in this task. For future repo hygiene:
1. Inventory archives/backups.
2. Confirm what is needed for rollback.
3. Move artifacts outside repo or document retention policy.
4. Add source-control ignore patterns.
5. Remove only after explicit approval.
