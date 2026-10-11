# Onboarding Buddy — Spec

> ✍️ (C) Written by Claude — Oct 10, 2026. Source of truth for the build. Design source: Figma `ZK9Tsyhq6Y4YytTpLWvh6U`.

A-to-Z onboarding for any company: HR meets job training. Every new hire gets a journey of stages.
Each stage opens with a video, holds tasks with one owner each, and can include walkthroughs of the
company's connected apps. A real person is the new hire's buddy.

## 1. Stack
- Server: Node ≥ 24, **zero dependencies**, built-in `node:sqlite`. `server/`
- Front end: Vite + React 19 + TypeScript + React Router, plain CSS tokens. `src/`
- Dev: `npm run seed && npm run dev` → http://localhost:5174 (API on :4600)
- Writes need header `X-OB: 1`. Sessions are httpOnly cookies. Passwords: scrypt.
- 🛑 **Every query is scoped to the signed-in user's `org_id`.** Tests prove isolation.

## 2. Data model
| Table | Purpose |
|---|---|
| `orgs` | id, name, slug |
| `users` | org_id, email, name, title, team, photo, role (`hire` · `admin` · `member`), start_date, manager_id, buddy_id, journey_id, password_hash |
| `sessions` | token_hash, user_id, expires_at |
| `journeys` | org_id, name (e.g. "Product Designer") |
| `stages` | journey_id, position, name, emoji, tint, window (e.g. "Days 1 to 5"), summary, intro_video_id |
| `task_templates` | stage_id, position, type, title, meta, emoji, owner_role, due_day, ref |
| `hire_tasks` | hire_id, template_id, status (`todo`/`done`), done_at, done_by, data (JSON) |
| `videos` | kind (`intro`/`app`/`hello`/`lesson`), title, presenter_id, duration_sec, status (`published`/`needs_update`/`missing`), still, chapters, caption, app_id, position |
| `quiz_questions` | video_id, prompt, options (JSON), correct_index, explanation |
| `connected_apps` | app_key, stage_id, roles, try_items (JSON), house_rules (JSON), owner_id, connected_by, connected_at |
| `signatures` | hire_id, doc_key, typed_name, signed_at |
| `form_answers` | hire_id, form_key, step, answers (JSON), submitted_at |
| `messages` | user_id, from_id, kind, title, body, link, created_at, read_at |
| `feelings` | hire_id, value (1–5), created_at — only admins see these |
| `email_settings` | org_id, provider (`google`/`microsoft`/`smtp`), from_name, from_address, reply_to, smtp_*, secret_enc (encrypted), connected_by, last test |
| `invites` | token_hash, user_id, expires_at (14 days), used_at, sent_via, sent_at — single use |
| `email_log` | to, subject, kind (`invite`/`test`), provider, status (`sent`/`failed`/`not_sent`), error |
| `oauth_states` | one-time state for Google/Microsoft sign-in, 15 minutes |

- **Task types:** `form`, `sign`, `video`, `app`, `todo`, `meeting`, `it`
- **Owner roles:** `hire`, `people_ops`, `it`, `manager`, `buddy`. Resolved per hire: people_ops and it come from org admins/members flagged in `users.team`, manager and buddy from the hire's row.
- **Due dates:** `start_date + due_day` (Day −7 = a week before Day 1).
- **Sensitive data (decided Oct 10: keep it in the app).** Today the W-4 stores only filing choices; no SSNs, no bank numbers, no ID documents yet. **Before any of those are stored:** encrypt the fields (`server/secrets.mjs` already does AES-256-GCM), limit reads to People Ops and the hire, log every view, and set a deletion rule.
- **Names in templates:** `{buddy}` in a task title, meta or stage summary becomes the hire's own buddy's first name.

## 3. App catalogue (code, not DB)
`server/catalog.mjs` — key, name, category, tint token, three feature icons. Logos are the official
files in `public/logos/`, shown at uniform scale on a white tile, never recoloured.

## 4. API (all JSON, all org-scoped)
- `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/me`
- Hire: `GET /api/today` · `GET /api/journey` · `GET /api/tasks/:id` · `POST /api/tasks/:id/complete` · `POST /api/tasks/:id/undo`
  · `POST /api/forms/:key` (step answers) · `POST /api/sign/:doc` · `POST /api/videos/:id/quiz` · `GET /api/apps/:key`
  · `GET /api/people` · `GET /api/inbox` · `POST /api/feeling`
- Owners (manager / IT / buddy / People Ops): `GET /api/my-tasks` · complete/undo as above (only tasks they own)
- Admin: `GET /api/admin/overview` · `GET /api/admin/hires/:id` · `GET /api/admin/journeys/:id` · `POST/PATCH/DELETE /api/admin/task-templates`
  · `GET /api/admin/apps` · `GET /api/admin/apps/:key` · `PATCH /api/admin/apps/:key` · `GET /api/admin/videos`
  · `POST /api/admin/hires` (creates the hire, emails the invite) · `POST /api/admin/hires/:id/invite` (new link)
- Email (admin): `GET/PATCH/DELETE /api/admin/email` · `POST /api/admin/email/smtp` (checks the login before saving) · `POST /api/admin/email/test`
  · `POST /api/admin/email/connect/:provider` → sign-in URL · `GET /api/oauth/:provider/callback` → back to Settings → Email
- Public: `GET /api/invite/:token` · `POST /api/invite/:token` (set password, signed in). Setup: `docs/EMAIL.md`

## 5. Screens (match Figma)
**New hire:** Welcome (first login) · Today · My journey · Task: W-4 form · Sign the handbook · Lesson (video + quick check) · App walkthrough (standard template) · Tools & access · Inbox · Your people · Graduation
**Owners:** My tasks (manager, IT, buddy, People Ops)
**Admin:** Overview · New hire detail (invite status, resend) · Journey builder · Connected apps · App detail (edit Try it now + house rules) · Video library · Email settings
**Public:** Sign in · Invite (pick a password)

## 6. Design rules (from the Figma system)
- Fraunces (Light/Regular) headings, Figtree body, Geist Mono for counts and times. **No text under 12px.**
- Yellow = logo + "what's current" surfaces only, never thin lines or text on light. Progress is blue `#1D4F91`.
- Buttons: deep blue, white text. Focus: 2px blue ring 2px outside the edge.
- One hero card per screen, open sections split by hairlines. Never boxed row lists.
- Contrast: body text ≥ 4.5 : 1, checked.
- Photos for people only. Apps are shown by their official logo on a white tile over the app's tint.
- Overdue, missing and errors always say it in words; colour is a second signal.
- **Numbers as numerals, never words** ("90 days", "5 stages"). Idioms like "one at a time" stay as words. The first day is **"Day 1"** (decided Oct 10), matching Day −7, Day 30, Day 90.

## 7. Decisions log
- **Oct 10 — Day 1, not Day One.** Matches every other day label and the numerals rule.
- **Oct 10 — Sensitive forms stay in the app** (not handed to a payroll provider). Guardrails in §2 come first.
- **Oct 10 — Email: the company's own account.** Google Workspace and Microsoft 365 by sign-in, SMTP for everything else. Nothing connected → admin gets the invite link to share.
- **Next — connectors that act**, not just training pages: Google/Microsoft (accounts, calendar), Slack (channels, welcome DMs). Order depends on the first real customer's tools.
