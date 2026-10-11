// Settings → Email (admin), Google/Microsoft sign-in callbacks, and the public invite page API.
import { randomBytes } from 'node:crypto';
import { createSession, hashPassword, publicUser, sessionCookie, sha256 } from '../auth.mjs';
import { now, tx } from '../db.mjs';
import { Redirect, fail } from '../http.mjs';
import { liveInvite } from '../invites.mjs';
import { appSenderReady, deliver, emailSettings, sendMail } from '../mail/index.mjs';
import { PROVIDERS, publicUrl } from '../mail/oauth.mjs';
import { smtpMessage, smtpSend } from '../mail/smtp.mjs';
import { seal, open } from '../secrets.mjs';

const needAdmin = (user) => {
  if (!user) fail(401, 'Sign in to continue.');
  if (user.role !== 'admin') fail(403, 'Only People Ops can change email settings.');
  return user;
};
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function shape(db, orgId) {
  const s = emailSettings(db, orgId);
  const by = s?.connected_by ? db.prepare('SELECT name FROM users WHERE id = ? AND org_id = ?').get(s.connected_by, orgId) : null;
  const recent = db.prepare('SELECT to_addr AS "to", subject, kind, provider, status, error, created_at AS at FROM email_log WHERE org_id = ? ORDER BY id DESC LIMIT 8').all(orgId);
  return {
    connection: s && {
      provider: s.provider, fromName: s.from_name, fromAddress: s.from_address, replyTo: s.reply_to,
      smtp: s.provider === 'smtp' ? { host: s.smtp_host, port: s.smtp_port, secure: !!s.smtp_secure, user: s.smtp_user, hasPassword: !!open(s.secret_enc)?.password } : null,
      connectedBy: by?.name || null, connectedAt: s.connected_at,
      lastTest: s.last_test_at ? { at: s.last_test_at, ok: !!s.last_test_ok, error: s.last_error } : null,
    },
    available: { google: PROVIDERS.google.configured(), microsoft: PROVIDERS.microsoft.configured(), app: appSenderReady() },
    redirectUris: { google: `${publicUrl()}/api/oauth/google/callback`, microsoft: `${publicUrl()}/api/oauth/microsoft/callback` },
    recent,
  };
}

export default function registerEmail(router) {
  router.get('/api/admin/email', ({ db, user }) => shape(db, needAdmin(user).org_id));

  // Other email (SMTP). Checks the login before saving, so a bad password never gets stored.
  router.post('/api/admin/email/smtp', async ({ db, user, body }) => {
    const admin = needAdmin(user);
    const host = String(body.host || '').trim().toLowerCase();
    const port = Number(body.port);
    const secure = port === 465 ? true : !!body.secure && port !== 587;
    const login = String(body.user || '').trim();
    const fromAddress = String(body.fromAddress || '').trim().toLowerCase() || login.toLowerCase();
    const fromName = String(body.fromName || '').trim().slice(0, 80);
    const existing = emailSettings(db, admin.org_id);
    const password = String(body.password || '') || (existing?.provider === 'smtp' && existing.smtp_host === host && existing.smtp_user === login ? open(existing.secret_enc)?.password || '' : '');
    const errors = {};
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) errors.host = 'Enter the server name, like smtp.yourcompany.com.';
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = 'Enter a port. 587 works for most providers.';
    if (!login) errors.user = 'Enter the username. It’s usually the full email address.';
    if (!password) errors.password = 'Enter the password or app password.';
    if (!EMAIL.test(fromAddress)) errors.fromAddress = 'Enter the address emails come from, like people@yourcompany.com.';
    const first = Object.keys(errors)[0];
    if (first) fail(422, errors[first], { field: first, errors });
    try {
      await smtpSend({ host, port, secure, user: login, pass: password, verifyOnly: true, ...(deliver.smtpTestOptions || {}) });
    } catch (e) {
      fail(422, smtpMessage(e), { field: e.code === 535 || e.code === 534 ? 'password' : 'host' });
    }
    db.prepare(`INSERT INTO email_settings(org_id,provider,from_name,from_address,reply_to,smtp_host,smtp_port,smtp_secure,smtp_user,secret_enc,connected_by,connected_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(org_id) DO UPDATE SET provider=excluded.provider, from_name=excluded.from_name, from_address=excluded.from_address,
      reply_to=excluded.reply_to, smtp_host=excluded.smtp_host, smtp_port=excluded.smtp_port, smtp_secure=excluded.smtp_secure, smtp_user=excluded.smtp_user,
      secret_enc=excluded.secret_enc, connected_by=excluded.connected_by, connected_at=excluded.connected_at, last_test_at=NULL, last_test_ok=NULL, last_error=NULL`)
      .run(admin.org_id, 'smtp', fromName || null, fromAddress, null, host, port, secure ? 1 : 0, login, seal({ password }), admin.id, now());
    return shape(db, admin.org_id);
  });

  // Display name and reply-to. The from address is fixed by the connected account.
  router.patch('/api/admin/email', ({ db, user, body }) => {
    const admin = needAdmin(user);
    if (!emailSettings(db, admin.org_id)) fail(404, 'Connect an email first.');
    const replyTo = String(body.replyTo || '').trim().toLowerCase();
    if (replyTo && !EMAIL.test(replyTo)) fail(422, 'Enter a reply-to address like people@yourcompany.com, or leave it blank.', { field: 'replyTo' });
    db.prepare('UPDATE email_settings SET from_name = ?, reply_to = ? WHERE org_id = ?').run(String(body.fromName || '').trim().slice(0, 80) || null, replyTo || null, admin.org_id);
    return shape(db, admin.org_id);
  });

  router.delete('/api/admin/email', ({ db, user }) => {
    const admin = needAdmin(user);
    db.prepare('DELETE FROM email_settings WHERE org_id = ?').run(admin.org_id);
    return shape(db, admin.org_id);
  });

  router.post('/api/admin/email/test', async ({ db, user }) => {
    const admin = needAdmin(user);
    const org = db.prepare('SELECT name FROM orgs WHERE id = ?').get(admin.org_id);
    const r = await sendMail(db, admin.org_id, {
      to: admin.email, kind: 'test', subject: `Test email from ${org.name}’s Onboarding Buddy`,
      text: `It works. New-hire invites and reminders will come from this address.\n\nOnboarding Buddy`,
      html: `<p style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px">It works. New-hire invites and reminders will come from this address.</p><p style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px">Onboarding Buddy</p>`,
    });
    if (emailSettings(db, admin.org_id)) db.prepare('UPDATE email_settings SET last_test_at = ?, last_test_ok = ?, last_error = ? WHERE org_id = ?').run(now(), r.ok ? 1 : 0, r.error ?? null, admin.org_id);
    return { ...r, to: admin.email, settings: shape(db, admin.org_id) };
  });

  // Google / Microsoft: step 1 sends the admin to the provider's sign-in page.
  router.post('/api/admin/email/connect/:provider', ({ db, user, params }) => {
    const admin = needAdmin(user);
    const p = PROVIDERS[params.provider];
    if (!p) fail(404, 'That email provider isn’t supported.');
    if (!p.configured()) fail(409, `${p.name} sign-in isn’t switched on for this Onboarding Buddy yet. Use “Other email” for now.`);
    const state = randomBytes(24).toString('base64url');
    db.prepare('DELETE FROM oauth_states WHERE created_at < ?').run(new Date(Date.now() - 15 * 60_000).toISOString());
    db.prepare('INSERT INTO oauth_states(state_hash,org_id,user_id,provider,created_at) VALUES (?,?,?,?,?)').run(sha256(state), admin.org_id, admin.id, params.provider, now());
    return { url: p.authUrl(state) };
  });

  // Step 2: the provider sends the admin back here with a code. Always redirects to Settings → Email.
  router.get('/api/oauth/:provider/callback', async ({ db, user, params, query }) => {
    const back = (q) => new Redirect(`/admin/settings/email?${new URLSearchParams(q)}`);
    const p = PROVIDERS[params.provider];
    if (!p) return back({ error: 'That email provider isn’t supported.' });
    if (query.get('error')) return back({ error: query.get('error') === 'access_denied' ? 'Sign-in was cancelled, so nothing changed.' : `${p.name} said: ${query.get('error_description') || query.get('error')}` });
    const st = db.prepare('SELECT * FROM oauth_states WHERE state_hash = ?').get(sha256(query.get('state') || ''));
    if (st) db.prepare('DELETE FROM oauth_states WHERE state_hash = ?').run(st.state_hash);
    if (!st || st.provider !== params.provider || st.created_at < new Date(Date.now() - 15 * 60_000).toISOString()) return back({ error: 'That sign-in link expired. Try connecting again.' });
    if (!user || user.id !== st.user_id || user.role !== 'admin') return back({ error: 'Sign in as the same People Ops admin, then connect again.' });
    try {
      const t = await p.exchange(query.get('code') || '');
      const me = await p.whoami(t.access_token);
      const prev = emailSettings(db, user.org_id);
      db.prepare(`INSERT INTO email_settings(org_id,provider,from_name,from_address,secret_enc,connected_by,connected_at) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(org_id) DO UPDATE SET provider=excluded.provider, from_name=excluded.from_name, from_address=excluded.from_address, secret_enc=excluded.secret_enc,
        smtp_host=NULL, smtp_port=NULL, smtp_secure=NULL, smtp_user=NULL, connected_by=excluded.connected_by, connected_at=excluded.connected_at,
        last_test_at=NULL, last_test_ok=NULL, last_error=NULL`)
        .run(user.org_id, params.provider, prev?.from_name || null, me.email.toLowerCase(),
          seal({ access_token: t.access_token, refresh_token: t.refresh_token || null, expires_at: Date.now() + (t.expires_in || 3600) * 1000 }), user.id, now());
      return back({ connected: params.provider });
    } catch (e) {
      return back({ error: e.message || 'Sign-in didn’t finish. Try again.' });
    }
  });

  // Public: the invite page. Shows who it's for, then lets them pick a password and signs them in.
  router.get('/api/invite/:token', ({ db, params }) => {
    const inv = liveInvite(db, params.token);
    if (!inv) fail(404, 'This invite link has expired or was already used. Ask People Ops to send a new one.');
    const u = db.prepare('SELECT name, email FROM users WHERE id = ? AND org_id = ?').get(inv.user_id, inv.org_id);
    const org = db.prepare('SELECT name FROM orgs WHERE id = ?').get(inv.org_id);
    return { first: u.name.split(' ')[0], name: u.name, email: u.email, org: org.name };
  });

  router.post('/api/invite/:token', async ({ db, params, body, setCookie, secure }) => {
    const inv = liveInvite(db, params.token);
    if (!inv) fail(404, 'This invite link has expired or was already used. Ask People Ops to send a new one.');
    const pw = String(body.password || '');
    if (pw.length < 10) fail(422, 'Use at least 10 characters. A short sentence works well.', { field: 'password' });
    const hash = await hashPassword(pw);
    tx(db, () => {
      db.prepare('UPDATE users SET password_hash = ?, last_seen_at = ? WHERE id = ? AND org_id = ?').run(hash, now(), inv.user_id, inv.org_id);
      db.prepare('UPDATE invites SET used_at = ? WHERE token_hash = ?').run(now(), inv.token_hash);
      db.prepare('DELETE FROM invites WHERE user_id = ? AND used_at IS NULL').run(inv.user_id);
    });
    setCookie(sessionCookie(createSession(db, inv.user_id), { secure }));
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(inv.user_id)) };
  });
}
