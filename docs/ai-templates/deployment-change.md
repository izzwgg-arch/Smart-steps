# Deployment Change Template

Use for deployment scripts, PM2, nginx, env, hosting, production checks.

1. Read `CURSOR_START_HERE.md`, `DEPLOYMENT.md`, `DEBUGGING.md`.
2. Confirm user explicitly asked for deployment/config work.
3. Identify target app and environment.
4. Do not change PM2/nginx/env without explicit approval.
5. Do not run migrations unless separately approved.
6. Prefer dry-run/read-only diagnostics first.
7. Document commands run and verification results.

Risk default: extreme.
