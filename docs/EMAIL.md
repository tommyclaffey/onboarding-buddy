# Email — setup

> ✍️ (C) Written by Claude — Oct 10, 2026.

Companies connect their own email on **Settings → Email** (`/admin/settings/email`). Invites then come
from their address, and replies land in their inbox.

| Option | What the company does | What you (running Onboarding Buddy) do once |
|---|---|---|
| **Other email (SMTP)** | Enter server, port, username, password | Nothing. Works today. |
| **Google Workspace** | Click Connect, sign in | Register a Google OAuth app (below) |
| **Microsoft 365** | Click Connect, sign in | Register a Microsoft Entra app (below) |
| *Nothing connected* | — | Optional: `RESEND_API_KEY` + `MAIL_FROM` sends invites from Onboarding Buddy's own address. Without it, the admin gets a link to share by hand. |

Until Google or Microsoft is set up, its button says "Not switched on yet" and points to Other email.

## Always set
- `PUBLIC_URL` — the site's address, e.g. `https://web-production-082a6.up.railway.app`. Used in invite links and sign-in redirects. **Never taken from the request**, so links can't be spoofed.
- `OB_SECRET_KEY` — optional. Encrypts stored passwords and tokens. If unset, a random key is created once in `DATA_DIR/secret.key` (on the Railway volume). If that file is lost, companies must reconnect their email.

## Google Workspace
1. Google Cloud Console → new project "Onboarding Buddy" → **APIs & Services → Library** → enable **Gmail API**.
2. **OAuth consent screen**: External, app name, support email. Scopes: `openid`, `email`, `https://www.googleapis.com/auth/gmail.send`.
3. **Credentials → Create OAuth client ID → Web application.** Authorised redirect URI: `{PUBLIC_URL}/api/oauth/google/callback`
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Railway.
5. ⚠️ `gmail.send` is a **sensitive** scope (checked Oct 10, 2026 on Google's Gmail scopes page). Until Google verifies the app, sign-in shows an "unverified app" warning and is limited to test users you add on the consent screen. Submit for verification before real customers use it.

## Microsoft 365
1. Microsoft Entra admin center → **App registrations → New registration**. Supported accounts: *any organisational directory* (multitenant). Redirect URI (Web): `{PUBLIC_URL}/api/oauth/microsoft/callback`
2. **API permissions** → Microsoft Graph → Delegated: `Mail.Send`, `User.Read`, `offline_access`.
3. **Certificates & secrets → New client secret.** Note when it expires.
4. Set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` in Railway.
5. Some companies require an admin to approve third-party apps; their IT admin grants consent once.
6. Why not SMTP for Microsoft: Exchange Online is turning off password (basic) sign-in for SMTP by default at the end of December 2026 (Microsoft message MC786329, as reported Jan 2026). OAuth is the lasting route.

## How it works (code)
- `server/mail/smtp.mjs` — zero-dependency SMTP client (TLS on 465, STARTTLS otherwise; refuses unencrypted servers).
- `server/mail/oauth.mjs` — Google (Gmail API) and Microsoft (Graph `sendMail`) sign-in, refresh and send.
- `server/mail/index.mjs` — `sendMail()` picks the org's connection, logs every attempt to `email_log`, never throws.
- `server/secrets.mjs` — AES-256-GCM for `email_settings.secret_enc`.
- `server/invites.mjs` — 14-day, single-use invite links (stored hashed) and the invite email.
- Onboarding Buddy can only **send**: the scopes don't allow reading anyone's mail.
