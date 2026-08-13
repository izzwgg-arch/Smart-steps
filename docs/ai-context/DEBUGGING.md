# Debugging

## Safe Diagnostics
- Use `rg` for exact text search.
- Use `Glob` to locate files.
- Read only relevant files.
- For frontend build checks:
  - Scheduling client: `npm run build` in `aplus-center-scheduling/client`.
  - SmartSteps: `npm run build` in `aplus-center-scheduling/smart-steps`.
- For JavaScript syntax checks:
  - `node --check <file>` in `aplus-center-scheduling/server`.

## A Plus Scheduling Health
Evidence from deployment docs:
- `curl -I http://127.0.0.1:4000/api/health`
- `curl -I http://127.0.0.1:4000/api/health/db`

Routes:
- Health: `server/src/app.js`.
- DB health: `server/src/app.js`.

## Logs
- PM2 process name from repo: `aba-app`.
- PM2 home in deploy script: `/home/aba/.pm2`.
- Safe read-only diagnostics may include `pm2 status` or `pm2 logs --lines`, but do not restart or deploy unless explicitly requested.

## Payment Debugging
- Invoice activity: `GET /api/invoices/:id/activity`.
- QuickBooks sync endpoint: `POST /api/invoices/:id/sync/quickbooks`.
- Payment routes: `server/src/routes/payment.routes.js`.
- Payment aggregate balance: `server/src/services/payments/paymentService.js`.
- Integration logs: `IntegrationSyncLog`, `QuickBooksApiCallLog`.

## Client File Debugging
- Route: `server/src/routes/clientFiles.routes.js`.
- Default roots: `server/src/services/documentRootsService.js`.
- Upload directory: `UPLOAD_DIR` / `env.uploadDir`.
- Public static mount: `/uploads`.

## SmartSteps Debugging
- API route paths live under `smart-steps/src/app/api`.
- Auth uses `auth()` from `@/auth`.
- SSO bridge: `smart-steps/src/app/api/sso/route.ts`.
- Offline store: `smart-steps/src/store/abaStore.ts`.
- Base path: `/smart-steps`.

## Do Not Use As First Step
- Do not run migrations.
- Do not restart PM2.
- Do not deploy.
- Do not alter env/server/nginx.
- Do not clear localStorage/data unless user requests.
