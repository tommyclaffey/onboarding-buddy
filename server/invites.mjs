// Invite links: a new hire sets their own password from an emailed link. Tokens are stored hashed.
import { randomBytes } from 'node:crypto';
import { sha256 } from './auth.mjs';
import { now } from './db.mjs';
import { sendMail } from './mail/index.mjs';
import { publicUrl } from './mail/oauth.mjs';

export const INVITE_DAYS = 14;

export function createInvite(db, orgId, userId, byId) {
  db.prepare('DELETE FROM invites WHERE org_id = ? AND user_id = ? AND used_at IS NULL').run(orgId, userId);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO invites(token_hash,org_id,user_id,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?)').run(sha256(token), orgId, userId, byId, now(), expiresAt);
  return { token, link: `${publicUrl()}/invite/${token}`, expiresAt };
}

/** The invite row for a token, if it's unused and not expired. */
export function liveInvite(db, token) {
  if (!token || token.length < 20) return null;
  return db.prepare('SELECT * FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').get(sha256(token), now()) || null;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const longDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

export function inviteEmail({ org, hire, admin, buddy, link }) {
  const first = hire.name.split(' ')[0];
  const subject = `Welcome to ${org.name}, ${first}. Your onboarding starts here`;
  const role = hire.title ? ` as ${hire.title}` : '';
  const day = hire.start_date ? longDay(hire.start_date) : null;
  const lines = [
    `Hi ${first},`,
    '',
    `We’re so glad you’re joining ${org.name}${role}.${day ? ` Your first day is ${day}.` : ''}`,
    '',
    `Onboarding Buddy walks you through everything before Day 1: your paperwork, your laptop${buddy ? `, and meeting your buddy, ${buddy.name}` : ''}. It takes a few minutes at a time.`,
    '',
    `Set up your account: ${link}`,
    '',
    `This link works for ${INVITE_DAYS} days. If it runs out, reply to this email and we’ll send a new one.`,
    '',
    `${admin.name}${admin.title ? `, ${admin.title}` : ''}`,
    org.name,
  ];
  const html = `<!doctype html><html><body style="margin:0;background:#F7F4EE;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1F1B16">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EE;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;padding:36px">
<tr><td style="font-size:15px;line-height:1.6">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5B544B">${esc(org.name)} · Onboarding</p>
<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.2">Welcome aboard, ${esc(first)}.</h1>
<p style="margin:0 0 14px">We’re so glad you’re joining ${esc(org.name)}${esc(role)}.${day ? ` Your first day is <b>${esc(day)}</b>.` : ''}</p>
<p style="margin:0 0 24px">Onboarding Buddy walks you through everything before Day 1: your paperwork, your laptop${buddy ? `, and meeting your buddy, ${esc(buddy.name)}` : ''}. It takes a few minutes at a time.</p>
<p style="margin:0 0 24px"><a href="${esc(link)}" style="display:inline-block;background:#1D4F91;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 22px;border-radius:999px">Set up your account →</a></p>
<p style="margin:0 0 24px;font-size:13px;color:#5B544B">This link works for ${INVITE_DAYS} days. If it runs out, reply to this email and we’ll send a new one.</p>
<p style="margin:0">${esc(admin.name)}${admin.title ? `, ${esc(admin.title)}` : ''}<br>${esc(org.name)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text: lines.join('\n'), html };
}

/** Make a fresh invite and email it. Returns { sent, via, error, link? } — link only when it wasn't sent. */
export async function sendInvite(db, admin, hire) {
  const org = db.prepare('SELECT * FROM orgs WHERE id = ?').get(admin.org_id);
  const buddy = hire.buddy_id ? db.prepare('SELECT name FROM users WHERE id = ? AND org_id = ?').get(hire.buddy_id, admin.org_id) : null;
  const inv = createInvite(db, admin.org_id, hire.id, admin.id);
  const r = await sendMail(db, admin.org_id, { to: hire.email, kind: 'invite', replyTo: { name: admin.name, address: admin.email }, ...inviteEmail({ org, hire, admin, buddy, link: inv.link }) });
  if (r.ok) db.prepare('UPDATE invites SET sent_via = ?, sent_at = ? WHERE token_hash = ?').run(r.via, now(), sha256(inv.token));
  return { sent: r.ok, via: r.via, error: r.ok ? null : r.error, ...(r.ok ? {} : { link: inv.link }), expiresAt: inv.expiresAt };
}

/** Where a hire's invite stands, for the admin. */
export function inviteStatus(db, orgId, hire) {
  if (hire.password_hash) return { state: 'accepted' };
  const i = db.prepare('SELECT * FROM invites WHERE org_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1').get(orgId, hire.id);
  if (!i) return { state: 'not_sent' };
  if (i.expires_at <= now()) return { state: 'expired', sentAt: i.sent_at };
  return i.sent_at ? { state: 'sent', sentAt: i.sent_at, via: i.sent_via } : { state: 'not_sent' };
}
