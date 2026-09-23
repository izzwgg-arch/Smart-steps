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

Server layout — **verified live on 2026-09-23** (hostname `vmi3008231`):

- App runs from `/var/www/aplus-center` under PM2 process **`aplus-center`**
  (id 0), started as `npm run start -- -H 127.0.0.1`, **fork mode, 1 instance,
  as user `root`**.
- **Port 3000.** `next-server` listens on `127.0.0.1:3000`; nginx proxies to
  `http://127.0.0.1:3000`. The `3001` in `smartsteps-abapc.nginx` is **stale** —
  that file is not the live config.
- **PM2 logs are at `/root/.pm2/logs/aplus-center-out.log` and
  `-error.log`** — NOT `/var/log/aplus-center/`. Those exist but were last
  written 2026-01-09; they are dead files from an older setup.
- nginx: `app.smartstepsabapc.org` on 443 with **certbot TLS**
  (`/etc/letsencrypt/live/app.smartstepsabapc.org/`), port 80 301-redirects to
  HTTPS. `client_max_body_size 25m`. Security headers come from
  `/etc/nginx/snippets/smartsteps-security.conf`.
- PostgreSQL on `localhost:5432`, database `apluscenter`, user `aplususer`.
- Runtime: node `v20.19.6`, npm `10.8.2`, PM2 `6.0.14`.
- Cron lives in **`lib/cron.ts`**, `TIMEZONE = 'America/New_York'`:
  - `INVOICE_GENERATION_SCHEDULE = '0 7 * * 2'` — Tuesdays 07:00 ET.
  - `SCHEDULED_EMAIL_CHECK_SCHEDULE = '* * * * *'` — every minute.
  `README.md`'s "Fridays at 4:00 PM ET" is **wrong**; the code is authoritative.

**`deploy/pm2.config.js` does not describe the live process.** It specifies
cluster mode, 2 instances and `/var/log/aplus-center/*` logs; the live process
is fork mode, 1 instance, logging to `/root/.pm2`. Do not `pm2 start
deploy/pm2.config.js` on a whim — it would change the process topology. To
restart what is actually running, use `pm2 restart aplus-center`.

## The production clone points at the WRONG repo (found 2026-09-23)

**Read this before any git-based deploy.** `/var/www/aplus-center` *is* a git
clone, but:

- its `origin` is **`git@github.com:izzwgg-arch/aplus.git`** — the other repo;
- it is on branch **`feature/ops-center-logging`** at `fcc9e90`, level with
  `origin/feature/ops-center-logging`;
- it has **17 uncommitted changes** (modified payroll routes, dashboard, PDF
  helpers, `middleware.ts`, `next.config.js`, plus added
  `lib/payroll/employeeMonthlyReportBuilder.ts` and an untracked
  `app/api/payroll/reports/employee/[employeeId]/route.ts`);
- there is **no `Smart-steps` remote configured** at all.

Consequences:

- **Never run `git pull origin main` in `/var/www/aplus-center`.** That would
  pull the post-split `aplus` main, which does not contain this app at its root
  — it would overwrite production with a different product's tree.
- The live `.next` build is from **2026-06-01 23:37**, just after the newest
  source file (2026-06-01 23:34), so the running app matches that working tree —
  including the uncommitted changes. Those 17 files are **live code that exists
  in no repo**.
- Production and `Smart-steps` `main` have **diverged**. Comparing 6 files with
  line endings normalized: `middleware.ts`, `next.config.js` and
  `lib/payroll/employeeMonthlyReportBuilder.ts` match, while
  `lib/pdf/playwrightPDF.ts`, `app/dashboard/page.tsx` and
  `app/api/payroll/import/save/route.ts` differ. Which side is newer has not
  been established per file.

Reconciling this (committing the server's work somewhere, then re-pointing the
clone at `izzwgg-arch/Smart-steps`) is a **user decision, not a routine task**.
Back up `/var/www/aplus-center` before attempting it.

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
- `DEPLOYMENT_CHECKLIST.md` — first-time server setup steps, but it describes an
  older topology than what runs today (see Rule 5).

**Config files in this repo that do NOT match production** (verified
2026-09-23 — the live server is the only authority here):

- `deploy/pm2.config.js` — says cluster/2 instances and `/var/log/aplus-center`
  logs; live is fork/1 instance logging to `/root/.pm2`.
- `smartsteps-abapc.nginx` — proxies `3001` and is HTTP-only; the live site is
  certbot TLS on 443 proxying `3000`.
- `deploy/nginx.conf` — still a `your-domain.com` template, unused.

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

### Targeted merge deploy — the procedure that works today (used 2026-09-23)

Until the clone is re-pointed, this is how a change actually reaches production.
It never runs `git pull` and never overwrites the server's unsaved work.

1. **Diff before you copy.** For every file the change touches, fetch the
   server's copy and diff it against the commit your work branched from. Do not
   skip this: on 2026-09-23 the server's `app/api/timesheets/route.ts` and
   `app/api/timesheets/[id]/route.ts` turned out to carry **Ops Center audit
   logging (`createAuditLog` from `@/lib/audit`) that exists in no repo**. A
   straight copy would have silently deleted it.
2. **3-way merge, don't overwrite.** For any file that differs, merge with
   `git merge-file -p --diff3 <mine> <base> <server>` where `<base>` is the
   commit you branched from. Files identical to base are a clean fast-forward.
   Preserve each server file's existing line endings (they are mixed: some CRLF,
   some LF) so you don't add whole-file noise to `git status`.
3. **Merge `prisma/schema.prisma` the same way** so `AppEventLog` survives
   (see "Schema drift" below), and confirm it afterwards.
4. **Back up first** to `/root/deploy-backups/$(date +%Y%m%d_%H%M%S)/`: a tar of
   the files being replaced, `cp -a .next next-backup`, and
   `sudo -u postgres pg_dump -Fc apluscenter > apluscenter.dump`.
5. **Apply the schema change** as guarded SQL via `psql` (see the migration
   section), and verify the column, index and FK exist.
6. **Upload, then sanity-check before building.** Confirm the server-only code
   survived (`grep -c createAuditLog`, `grep -c 'model AppEventLog'`), that your
   feature is present, and that `git status --porcelain | wc -l` grew by exactly
   the number of files you sent — nothing else.
7. `npx prisma generate && npm run build && pm2 restart aplus-center`.
   No `npm install` unless dependencies actually changed.
8. **Verify properly.** `/` returns **307** — that is the NextAuth redirect and
   is correct. Follow it: `curl -sL` must end at `/login` with **200** and the
   title `Smart Steps - ABA Management Platform`. Then confirm the new code is in
   the running build (`grep -rl '<new symbol>' .next/server`) and that
   `/root/.pm2/logs/aplus-center-error.log` stops growing while idle.

`Failed to find Server Action "x"` errors right after a restart are **expected** —
they come from browser tabs still holding the previous build's action IDs and
clear on refresh. Judge them by whether the log keeps growing, not by presence.

### Routine deploy — BLOCKED until the clone is re-pointed

There is **no working git-based deploy** for this app right now. The production
clone tracks the wrong repo and carries 17 uncommitted live changes (see "The
production clone points at the WRONG repo" above), so `git pull` is not a safe
step. Do not invent one; raise it with the user.

Once the clone has been reconciled and actually tracks
`izzwgg-arch/Smart-steps` on `main`, the deploy is:

```
ssh -i "C:\Users\A Plus Server\.ssh\id_ed25519_smartsteps" -o IdentitiesOnly=yes root@66.94.105.43 "cd /var/www/aplus-center && git status --porcelain && git pull origin main && npm install --legacy-peer-deps && npx prisma generate && npm run build && pm2 restart aplus-center && sleep 5 && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/"
```

Expect an empty `git status` first (stop if it is not empty — that is live work
nobody has saved) and `200` at the end. If it is not 200, check
`pm2 logs aplus-center --lines 50` before touching anything else.

Note `--production` is wrong for this app: `npm run build` needs devDependencies
(`typescript`, `tailwindcss`, `autoprefixer`, `postcss`, `prisma`), so use
`npm install --legacy-peer-deps`. Several older docs get this wrong.

`npm run postbuild` runs automatically after `build` (it runs
`create-prerender.js` and `copy-pdfkit-fonts.js`) — a build that skips it
leaves PDF generation without fonts.

### If the change includes a Prisma migration

**`prisma migrate deploy` is NOT usable on this server (verified 2026-09-23).**
The production database has **no `_prisma_migrations` table** — it has never been
managed by `prisma migrate`. With no baseline, `migrate deploy` would try to
apply the entire `prisma/migrations/` history against an already-populated
database: it will fail, and it can do damage. Baselining the DB
(`prisma migrate resolve --applied ...` for every existing migration) is a
separate task that needs explicit approval.

Until that is done, apply a schema change to production as a **single idempotent
SQL statement via `psql`**, then regenerate and rebuild:

```
ssh ... root@66.94.105.43 "sudo -u postgres psql -d apluscenter -f /tmp/<change>.sql && cd /var/www/aplus-center && npx prisma generate"
```

Guard every statement so re-running is harmless: `ADD COLUMN IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, and a `pg_constraint` existence check before
`ADD CONSTRAINT`. Still **never `prisma db push`** — it drops columns to match
the schema. Confirm any schema change with the user first
(`docs/ai-context/RULES.md` lists migrations as high-risk/no-go without explicit
approval).

### Schema drift: the server has a model this repo does not (verified 2026-09-23)

The server's `prisma/schema.prisma` is byte-identical to this repo's **plus** an
appended `AppEventLog` model — Ops Center event logging, `@@map("appeventlog")`.
The `appeventlog` table **exists in the live database**; the model exists in **no
repo**. It came in with the `feature/ops-center-logging` commits.

**Copying this repo's `schema.prisma` over the server's would delete that model**,
so the next `prisma generate` would drop `prisma.appEventLog` from the client and
break the live Ops Center logging code. When a schema change has to reach
production, either edit the server's schema in place or re-append the
`AppEventLog` block, then diff to confirm it survived.

### First-time setup on the server

See `DEPLOYMENT_CHECKLIST.md`. In short: `/var/www/aplus-center` for the app,
`/var/log/aplus-center` for logs, `.env` with `DATABASE_URL`, `NEXTAUTH_URL`,
`NEXTAUTH_SECRET`, `NODE_ENV=production`, `TZ=America/New_York`, then
`pm2 start deploy/pm2.config.js && pm2 save && pm2 startup`.

Note `deploy/pm2.config.js` parses `.env` itself and merges it into the PM2
env, so PM2 does not need a dotenv preload — but it does mean **`.env` changes
only take effect on `pm2 restart`/`startOrReload`**, not on a rebuild.

**That checklist describes a setup that is not what runs today** (it predates
the live process — see Rule 2). Treat it as first-time-install reference only,
and never run its `pm2 start deploy/pm2.config.js` against the live server
while `aplus-center` is already online.

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
