# Smart Steps ABA Management — Project Rules

## What this repo is (read this first — the repos were split 2026-08-12)

- **This repo (`izzwgg-arch/Smart-steps`)** is the **Smart Steps ABA Management
  platform** — a single Next.js 14 App Router app at the repo root (`app/`,
  `components/`, `lib/`, `prisma/`). It covers timesheets, payroll, insurance
  invoicing, analytics, reports, the email queue and community classes.
  Live at `https://app.smartstepsabapc.org` on server `66.94.105.43`.
- **`izzwgg-arch/aplus`** is a DIFFERENT product set — TWO apps:
  - **A+ Center Scheduling** (`client/` + `server/`) — clinic ops.
  - **Smart Steps ABA Tracker** (`smart-steps/`) — session data, goals,
    assessments.
  Both live at `https://app.apluscenterinc.org` on server `91.229.245.143`.
  Never commit their files here, and never commit this platform's files there.
- Pre-split state is preserved in branch `backup/pre-split-main` on each repo.
  The old layout had the A+ apps under `aplus-center-scheduling/`.
- **Naming trap:** `package.json` here still says `"name": "a-plus-center"` and
  many docs say "A Plus Center", but this repo is the ABA **Management**
  platform. `app/layout.tsx` metadata is the accurate one
  (`Smart Steps - ABA Management Platform`). Judge by path, not by product name.

## Rule 0: Task lifecycle (mandatory, every task)

**Start of every task:** read this file and any other relevant `.md` files in
the repo before doing anything else (Rule 1).

**Immediately after finishing every task** (no batching, no exceptions), in
this order:

1. **Commit** — `git add -A && git commit -m "<short description>"`.
2. **Push** — `git push origin main`.
3. **Deploy** — per Rule 5. Docs-only changes still get a `git pull` on the
   server clone (`/var/www/aplus-center`) to keep it in sync. Any change that
   touches `prisma/schema.prisma` is a migration deploy — see Rule 5.
4. **Update MD files** — per Rule 4. Fold doc updates into the task's commit
   whenever possible; if any are made after deploying, commit and push them
   too. The working tree must end clean.

## Rule 1: Read the MD files first

At the start of **every task**, before doing anything else, read this file and any
other relevant `.md` files in the repo. They are the source of truth.

This repo has ~80 root-level `.md` files, most of them historical one-task
records (`DEPLOY_*`, `*_FIX*`, `*_SUMMARY*`, `AGENT_HANDOFF_*`). They are NOT
all current — see "Documentation map" below for which ones to trust.

## Rule 2: Server access (SSH)

- **Server IP:** `66.94.105.43` (hosts Smart Steps ABA Management)
- **SSH user:** `root`
- **Private key (this machine):** `C:\Users\A Plus Server\.ssh\id_ed25519_smartsteps`

```
ssh -i "C:\Users\A Plus Server\.ssh\id_ed25519_smartsteps" -o IdentitiesOnly=yes root@66.94.105.43 "<command>"
```

`-o IdentitiesOnly=yes` matters: this machine also holds
`~/.ssh/id_ed25519` for the A+ server (`91.229.245.143`), and without the flag
ssh offers that key first.

Never generate a new key, never ask for a password, and never print or copy the
**private** key anywhere (not into files, commits, logs, or chat).

Server layout (from repo evidence — `deploy/pm2.config.js`, `README.md`,
`DEPLOY_COMMANDS.md`, `smartsteps-abapc.nginx`):

- App runs from `/var/www/aplus-center` under PM2 process **`aplus-center`**
  (`deploy/pm2.config.js`: `npm start`, cluster mode, 2 instances, `PORT=3000`).
- PM2 logs: `/var/log/aplus-center/error.log` and `/var/log/aplus-center/out.log`.
- PostgreSQL on `localhost:5432`, database `apluscenter`, user `aplususer`.
- nginx: `app.smartstepsabapc.org` → `127.0.0.1` (see port note below).
- `TZ=America/New_York`. A node-cron invoice job runs in-process.

**`UNKNOWN — verify before changing`** (unresolved conflicts in the repo docs;
confirm against the live server before relying on any of these):

- **Production port.** `deploy/pm2.config.js` sets `PORT=3000` and most docs
  `curl http://localhost:3000`, but `smartsteps-abapc.nginx` proxies to
  `127.0.0.1:3001`. Check `pm2 describe aplus-center` and the live nginx site.
- **Whether `/var/www/aplus-center` is a git clone.**
  `DEPLOY_GIT_INSTRUCTIONS.md` recorded it as *not* a git repo; the git-based
  deploy in Rule 5 assumes it is. Run
  `git -C /var/www/aplus-center rev-parse --git-dir` before the first git deploy.
- **The invoice cron schedule.** `README.md` says Fridays 4:00 PM ET;
  `DEPLOYMENT_QUICK_START.md` and `PRODUCTION_SERVER_DEPLOYMENT.md` say
  Tuesdays 7:00 AM ET (`0 7 * * 2`). Read the code, not the docs.
- **Which nginx site file is live**, and whether TLS is via certbot.
  `deploy/nginx.conf` is still a `your-domain.com` template.

## Rule 3: Git — commit and push after EVERY task

- **Repository:** `https://github.com/izzwgg-arch/Smart-steps.git`, branch `main`.

Immediately after **every completed task** (no batching):

1. `git add -A`
2. `git commit -m "<short description of the task>"`
3. `git push origin main`

**The working tree must always stay empty.** `git status` must be clean at the
end of every task. If you find uncommitted changes at the start of a task, commit
and push them first before starting new work — but check WHICH app they belong
to first (see "What this repo is"): A+ Scheduling and ABA Tracker files go to the
`aplus` repo, not here.

## Rule 4: Update the MD files after EVERY task

After finishing each task, update the appropriate `.md` file so the docs always
match reality (this file for build/run/deploy/server changes; `README.md` for
features). The MD update is part of the task's commit. If no doc change is
needed, say so explicitly in the task summary.

**Do not add another `DEPLOY_<THING>.md` or `<THING>_FIX_SUMMARY.md`.** That
habit is what produced the ~80-file sprawl. Update this file, `README.md`, or
the matching doc under `docs/ai-context/` instead.

## Documentation map (which docs to trust)

**Current / authoritative:**

- `CLAUDE.md` (this file) — rules, server access, deploy. Highest authority.
- `README.md` — features, stack, local setup, structure.
- `DEPLOYMENT_CHECKLIST.md` — first-time server setup steps.
- `deploy/pm2.config.js`, `deploy/nginx.conf`, `smartsteps-abapc.nginx` — the
  actual config files, and better evidence than any prose doc.

**Useful but partly stale:**

- `docs/ai-context/*` — a good working-rules set (`RULES.md`,
  `AI_WORKFLOW_RULES.md`, `REPO_HYGIENE.md`) whose **paths are pre-split**:
  they still reference `aplus-center-scheduling/...`, which no longer exists in
  this repo. Treat the *rules* as live and the *paths* as historical.
- `docs/ai-context/KNOWN_ISSUES.md`, `PERMISSIONS.md`, `DATA_MODEL.md` — mostly
  describe the **aplus** repo's apps, not this one.

**Historical — read for forensics only, never as instructions:**

- `AGENT_HANDOFF_*.md`, `NEXT_AGENT_*`, `HANDOFF_PROMPT.txt` — finished handoffs.
- `DEPLOY_*.md` / `DEPLOY_*.sh` / `DEPLOY_*.ps1`, `RUN_THIS_ON_SERVER.sh`,
  `EMERGENCY_FIX.txt`, `QUICK_FIX_SERVER.md`, `fix-*.sh`, `complete-*.sh`,
  `final-*.sh`, `ultimate-build-fix.sh` — one-off scripts for problems already
  solved. Do not run them blind; several assume a pre-split layout.
- `*_FIX*.md`, `*_SUMMARY*.md`, `*_COMPLETE*.md`, `*_STATUS*.md`,
  `commit_*.txt` — point-in-time records.

## Repo hygiene (known debt — do not "fix" unasked)

Tracked in git and shipped on every clone:

- Build/deploy archives: `aplus-center-deploy.zip`, `aplus-center-payroll.zip`,
  `aplus-rollback.tar`, `aplus-rollback-monday.tar`, `deploy-aplus-v3.tgz`,
  `deploy-smartsteps-analytics.tgz`, `ss_deploy2.tar.gz`,
  `payroll-report-deploy.tgz`, `deploy-invoice-renumber.zip` (~15 MB total).
- A built bundle `index-bundle.js`, and stray app files at the root that belong
  to the **other** repo: `AppointmentsPage.jsx`, `hebrewDate.js`,
  `holidayService.js`, `server-app.js`, `temp_working_version.ts`.
- `smart-steps-android-backup/` duplicating `smart-steps-android/`.

Per `docs/ai-context/REPO_HYGIENE.md`: inventory and confirm rollback need
first, remove only after explicit approval. Never treat an archive, backup dir,
or `*-backup` tree as source of truth outside a rollback.

## Secrets (security debt — flagged 2026-09-23)

The production PostgreSQL password for `aplususer` is committed in plaintext in
several tracked docs (`DATABASE_CONNECTION_GUIDE.md`,
`PRODUCTION_SERVER_DEPLOYMENT.md`, and others). Anyone with repo read access
has it, and it is in git history.

- **Never copy a real secret into a new doc, commit, log, or chat message.**
- Rotating it is a user decision: it means updating the DB role,
  `/var/www/aplus-center/.env`, and restarting PM2. Do not do it unprompted.
- `.env` and `.env*.local` are gitignored — keep it that way.

## Git line endings on this machine (2026-09-23)

Unlike the `aplus` repo, this clone has **no** `core.autocrlf` override in
`.git/config`, so the system setting (`autocrlf=true`) applies: git converts
CRLF to LF on commit, and the index is already almost entirely LF
(`git ls-files --eol` → 802 `i/lf`, 28 `i/-text`, 10 `i/none`). Normal editing
does not produce whole-file diffs here.

Still check `git diff --stat` before committing: a file showing every line
changed means an encoding or EOL flip, not a real edit. There is no
`.gitattributes` — do not add one without discussing it, since it would
renormalize the whole tree in one commit.

## Rule 5: Deploy (step 3 of the Rule 0 end-of-task sequence)

Production runs from `/var/www/aplus-center` under PM2 process `aplus-center`.
**Always confirm with the user before deploying**, and never deploy a change
that has not been built locally first (`npm run build`).

### Routine deploy (git-based, after pushing to `main`)

```
ssh -i "C:\Users\A Plus Server\.ssh\id_ed25519_smartsteps" -o IdentitiesOnly=yes root@66.94.105.43 "cd /var/www/aplus-center && git pull origin main && npm install --production --legacy-peer-deps && npx prisma generate && npm run build && pm2 restart aplus-center && sleep 5 && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/"
```

Expect `200` at the end. If it is not 200, check
`pm2 logs aplus-center --lines 50` before touching anything else.

`npm run postbuild` runs automatically after `build` (it runs
`create-prerender.js` and `copy-pdfkit-fonts.js`) — a build that skips it
leaves PDF generation without fonts.

### If the change includes a Prisma migration

Run the migration BEFORE the build/restart, from `/var/www/aplus-center`:

```
cd /var/www/aplus-center && npx prisma migrate deploy && npx prisma generate
```

`prisma/migrations/` is the migration history — use `migrate deploy` in
production. Several older docs say `npx prisma db push`; **do not use it on
production**, it can drop columns to match the schema. Confirm any schema
change with the user first (`docs/ai-context/RULES.md` lists migrations as
high-risk/no-go without explicit approval).

### First-time setup on the server

See `DEPLOYMENT_CHECKLIST.md`. In short: `/var/www/aplus-center` for the app,
`/var/log/aplus-center` for logs, `.env` with `DATABASE_URL`, `NEXTAUTH_URL`,
`NEXTAUTH_SECRET`, `NODE_ENV=production`, `TZ=America/New_York`, then
`pm2 start deploy/pm2.config.js && pm2 save && pm2 startup`.

Note `deploy/pm2.config.js` parses `.env` itself and merges it into the PM2
env, so PM2 does not need a dotenv preload — but it does mean **`.env` changes
only take effect on `pm2 restart`/`startOrReload`**, not on a rebuild.

### Verify and roll back

Verify: `pm2 status` (process `online`, restart count not climbing),
`pm2 logs aplus-center --lines 30`, and `https://app.smartstepsabapc.org`
returns 200 with real content. A stale asset can still answer 200 off the SPA
fallback — check the BODY, not just the status code.

Rollback: the Next.js build output is `.next/`. Back it up before deploying
(`mv .next .next.backup.$(date +%Y%m%d_%H%M%S)`), and restore that directory
plus `pm2 restart aplus-center` to revert. A code rollback is
`git -C /var/www/aplus-center checkout <previous sha>` followed by the routine
deploy steps.
