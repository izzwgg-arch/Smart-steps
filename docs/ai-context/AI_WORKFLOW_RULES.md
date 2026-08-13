# AI Workflow Rules

## Default Workflow
1. Read `CURSOR_START_HERE.md`.
2. Identify app boundary.
3. Identify task category and risk.
4. Load only the matching docs.
5. Search exact symbols/routes/models before reading large files.
6. State candidate files before editing.
7. For bugs: reproduce or identify the failing path before coding.
8. For features: map UI → API → service → model → integration impacts.
9. Run focused checks.
10. Update docs if behavior, routes, risks, or known issues change.

## Context Loading Rules
- Do not read all schemas unless the task is data-model related.
- Do not read giant UI pages unless the task touches that page.
- Use `rg` for exact text and `Glob` for file discovery.
- Avoid archives, generated builds, backups, logs, and `node_modules`.
- Prefer domain docs over broad repo exploration.

## Risk Escalation
- Any auth, permission, cross-client visibility, payment, payroll, QuickBooks, migration, or deploy change must be treated as high/extreme risk.
- If a low-risk task touches high-risk files, pause and reclassify.

## Final Response Expectations
- State files changed.
- State checks run.
- State unknowns.
- State production risk if any.

## Documentation-Only Tasks
- Create/edit docs only.
- `.cursorignore` updates are allowed if they do not exclude source code.
- Do not modify runtime files.
