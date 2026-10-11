// sendMail(): sends from the company's connected email (Google, Microsoft or SMTP).
// Not connected? Falls back to Onboarding Buddy's own sender if RESEND_API_KEY + MAIL_FROM are set,
// otherwise the email is logged as not sent and the admin gets a link to share by hand.
import { now } from '../db.mjs';
import { open, seal } from '../secrets.mjs';
import { buildMime } from './mime.mjs';
import { PROVIDERS } from './oauth.mjs';
import { smtpMessage, smtpSend } from './smtp.mjs';

export const emailSettings = (db, orgId) => db.prepare('SELECT * FROM email_settings WHERE org_id = ?').get(orgId) || null;
export const appSenderReady = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

/** A fresh access token for Google/Microsoft, refreshing (and re-saving) it when it's about to expire. */
async function accessToken(db, s) {
  const secret = open(s.secret_enc);
  if (!secret?.refresh_token && !secret?.access_token) throw new Error('The email connection needs to be set up again. Reconnect it on Settings → Email.');
  if (secret.access_token && secret.expires_at > Date.now() + 60_000) return secret.access_token;
  if (!secret.refresh_token) throw new Error('The email sign-in expired. Reconnect it on Settings → Email.');
  const t = await PROVIDERS[s.provider].refresh(secret.refresh_token);
  const next = { ...secret, access_token: t.access_token, expires_at: Date.now() + (t.expires_in || 3600) * 1000, refresh_token: t.refresh_token || secret.refresh_token };
  db.prepare('UPDATE email_settings SET secret_enc = ? WHERE org_id = ?').run(seal(next), s.org_id);
  return next.access_token;
}

/** Send through one provider. Throws a readable Error on failure. */
export async function deliver(db, s, msg) {
  if (s.provider === 'smtp') {
    const secret = open(s.secret_enc) || {};
    try {
      await smtpSend({ host: s.smtp_host, port: s.smtp_port, secure: !!s.smtp_secure, user: s.smtp_user, pass: secret.password || '', from: msg.from.address, to: msg.to, data: buildMime(msg), ...(deliver.smtpTestOptions || {}) });
    } catch (e) {
      throw new Error(smtpMessage(e));
    }
    return;
  }
  const p = PROVIDERS[s.provider];
  if (!p?.configured()) throw new Error(`${p?.name || 'That email'} sign-in isn’t switched on for this Onboarding Buddy yet.`);
  await p.send(await accessToken(db, s), msg);
}

async function viaApp(msg) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: `${msg.from.name} via Onboarding Buddy <${process.env.MAIL_FROM}>`, to: [msg.to],
      reply_to: msg.replyTo ? (typeof msg.replyTo === 'string' ? msg.replyTo : msg.replyTo.address) : undefined,
      subject: msg.subject, text: msg.text, html: msg.html,
    }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || `The sender refused the message (${r.status}).`); }
}

/**
 * Send an email for an org. Never throws: returns { ok, via, error }.
 * via: 'google' | 'microsoft' | 'smtp' | 'app' | null (nothing to send with).
 */
export async function sendMail(db, orgId, { to, subject, text, html, kind = 'other', replyTo }) {
  const s = emailSettings(db, orgId);
  const org = db.prepare('SELECT name FROM orgs WHERE id = ?').get(orgId);
  const log = (status, via, error = null) =>
    db.prepare('INSERT INTO email_log(org_id,to_addr,subject,kind,provider,status,error,created_at) VALUES (?,?,?,?,?,?,?,?)').run(orgId, to, subject, kind, via, status, error, now());
  try {
    if (s) {
      await deliver(db, s, { from: { name: s.from_name || org.name, address: s.from_address }, to, replyTo: s.reply_to || replyTo, subject, text, html });
      log('sent', s.provider);
      return { ok: true, via: s.provider };
    }
    if (appSenderReady()) {
      await viaApp({ from: { name: org.name }, to, replyTo, subject, text, html });
      log('sent', 'app');
      return { ok: true, via: 'app' };
    }
    log('not_sent', null, 'No email connected');
    return { ok: false, via: null, error: 'No email is connected yet, so nothing was sent.' };
  } catch (e) {
    const error = e.message || 'Sending failed.';
    log('failed', s?.provider || 'app', error);
    return { ok: false, via: s?.provider || 'app', error };
  }
}
