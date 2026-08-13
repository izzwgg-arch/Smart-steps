# Deployment

Documentation only. Do not deploy unless the user explicitly asks.

## A Plus Scheduling Deployment Evidence

Files:
- `aplus-center-scheduling/deploy.sh`
- `aplus-center-scheduling/ecosystem.config.js`
- `aplus-center-scheduling/deploy/nginx.aplus-center.conf`
- `aplus-center-scheduling/DEPLOYMENT_CHECKLIST.md`

Observed details:
- Production path: `/opt/aba`.
- PM2 app: `aba-app`.
- PM2 command in script: `sudo -u aba bash -lc "export PM2_HOME=/home/aba/.pm2; pm2 startOrReload ecosystem.config.js --update-env && pm2 save"`.
- API/server process: `server/src/server.js`.
- Expected local health checks:
  - `http://127.0.0.1:4000/api/health`
  - `http://127.0.0.1:4000/api/health/db`
- nginx sample proxies `/` to `127.0.0.1:4000`.
- nginx sample rewrites `/smart-steps` to a SmartSteps Next server at `127.0.0.1:3000`.

## SmartSteps Deployment Evidence

Files:
- `aplus-center-scheduling/smart-steps/package.json`
- `aplus-center-scheduling/smart-steps/next.config.ts`

Observed details:
- `basePath: "/smart-steps"`.
- Dev script uses `next dev -p 3001`.
- Production port in nginx sample says `3000`.
- Exact production process name/path/port is `UNKNOWN — verify before changing`.

## Root Next.js Deployment

Root `package.json` has `build`, `postbuild`, and `start`. Root README reportedly mentions PM2 + Nginx. Exact current production mapping is `UNKNOWN — verify before changing`.

## Deployment Rules
- Do not deploy during documentation tasks.
- Do not edit nginx or PM2 configs without explicit approval.
- Do not run migrations as part of a deploy unless the task is explicitly a database deployment and has rollback consideration.
- Always build/check locally before production deployment when code changes are requested.
- After deploy, verify health and relevant page/API.
