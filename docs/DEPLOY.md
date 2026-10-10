# Deploying Onboarding Buddy

> ✍️ (C) Written by Claude — Oct 10, 2026. Not deployed yet — this is the plan, same shape as the Clinical Onboarding App on Railway.

## What it needs
- **Node 24+** (uses built-in `node:sqlite`). No other runtime services.
- **A persistent disk** for the SQLite file. Point `DATA_DIR` at it.

## Railway (recommended, matches your other apps)
1. Create a project + service from the GitHub repo (push it first; it isn't on GitHub yet).
2. Add a **volume** mounted at `/data`.
3. Variables:
   - `DATA_DIR=/data`
   - `NODE_ENV=production` (secure cookies)
   - `SEED_PASSWORD=<something private>` (only used on the first boot to create the demo company)
4. Build command: `npm ci && npm run build` · Start command: `npm start`
   (`npm start` seeds only if the database is empty, so restarts never wipe data.)

## Before real customers
- **Real invites by email** (today the admin sees a one-time temporary password): needs an email provider (Postmark or Resend).
- **Sensitive forms** (W-4 numbers, I-9 documents, bank details): decide whether to store them or hand off to a payroll provider (Gusto, Rippling). Today only progress and non-sensitive choices are stored.
- **Backups**: nightly copy of `/data/onboarding-buddy.db` to object storage (the clinical app's backup job can be reused).
- **Remove the demo company** or create the first real org with its own admin.
