# Test Inventory

## Evidence Found

This pass focused on repo navigation and did not run a full test discovery. Known commands from package files:

## Root App
- `npm run build`
- `npm run lint`
- Prisma commands: `db:generate`, `db:push`, `db:migrate`, `db:studio`

## A Plus Scheduling
- Root `aplus-center-scheduling/package.json`:
  - `npm run dev`
  - `npm run dev:client`
  - `npm run dev:all`
  - `npm run build`
  - `npm run start`
  - Prisma scripts delegated to server workspace.
- Client:
  - `npm run build`
  - `npm run dev`
  - `npm run preview`
- Server:
  - `npm run dev`
  - `npm run start`
  - `npm run prisma:generate`
  - `npm run prisma:migrate`
  - `npm run prisma:deploy`

## SmartSteps
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:migrate`
- `npm run seed`

## Unknowns
- Automated test suites: `UNKNOWN — verify before changing.`
- E2E tests: `UNKNOWN — verify before changing.`
- CI workflow status: `UNKNOWN — verify before changing.`

## Safe Verification Rules
- For docs-only tasks, no build required.
- For client UI changes, run the relevant client build.
- For server JS changes, use `node --check <file>` and targeted route tests if safe.
- For schema/database changes, require explicit user approval and a migration/deploy plan.
