// Google Workspace and Microsoft 365: sign in once, then send from the company's own mailbox.
// Each needs an OAuth app registered by whoever runs Onboarding Buddy (docs/EMAIL.md):
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET.
// Redirect URI to register: {PUBLIC_URL}/api/oauth/{google|microsoft}/callback
import { buildMime, address } from './mime.mjs';

export const publicUrl = () => (process.env.PUBLIC_URL || 'http://localhost:5174').replace(/\/$/, '');
export const redirectUri = (provider) => `${publicUrl()}/api/oauth/${provider}/callback`;

const form = (o) => new URLSearchParams(o).toString();

async function postForm(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error_description || data.error?.message || data.error || `Sign-in failed (${r.status}).`);
  return data;
}

export const PROVIDERS = {
  google: {
    name: 'Google Workspace',
    configured: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    authUrl: (state) => 'https://accounts.google.com/o/oauth2/v2/auth?' + form({
      client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri('google'), response_type: 'code',
      scope: 'openid email https://www.googleapis.com/auth/gmail.send', access_type: 'offline', prompt: 'consent', state,
    }),
    exchange: (code) => postForm('https://oauth2.googleapis.com/token', {
      code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri('google'), grant_type: 'authorization_code',
    }),
    refresh: (refreshToken) => postForm('https://oauth2.googleapis.com/token', {
      refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token',
    }),
    async whoami(accessToken) {
      const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${accessToken}` } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.email) throw new Error('Google didn’t share the account’s email address.');
      return { email: d.email, name: d.name || '' };
    },
    async send(accessToken, msg) {
      const raw = Buffer.from(buildMime(msg), 'utf8').toString('base64url');
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ raw }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error?.message || `Gmail refused the message (${r.status}).`); }
    },
  },
  microsoft: {
    name: 'Microsoft 365',
    configured: () => !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
    authUrl: (state) => 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + form({
      client_id: process.env.MICROSOFT_CLIENT_ID, redirect_uri: redirectUri('microsoft'), response_type: 'code',
      scope: 'offline_access User.Read Mail.Send', prompt: 'select_account', state,
    }),
    exchange: (code) => postForm('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      code, client_id: process.env.MICROSOFT_CLIENT_ID, client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      redirect_uri: redirectUri('microsoft'), grant_type: 'authorization_code', scope: 'offline_access User.Read Mail.Send',
    }),
    refresh: (refreshToken) => postForm('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      refresh_token: refreshToken, client_id: process.env.MICROSOFT_CLIENT_ID, client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      grant_type: 'refresh_token', scope: 'offline_access User.Read Mail.Send',
    }),
    async whoami(accessToken) {
      const r = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { authorization: `Bearer ${accessToken}` } });
      const d = await r.json().catch(() => ({}));
      const email = d.mail || d.userPrincipalName;
      if (!r.ok || !email) throw new Error('Microsoft didn’t share the account’s email address.');
      return { email, name: d.displayName || '' };
    },
    async send(accessToken, msg) {
      const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: msg.subject,
            body: { contentType: 'HTML', content: msg.html || msg.text },
            toRecipients: [{ emailAddress: { address: msg.to } }],
            ...(msg.replyTo ? { replyTo: [{ emailAddress: { address: typeof msg.replyTo === 'string' ? msg.replyTo : msg.replyTo.address } }] } : {}),
          },
          saveToSentItems: true,
        }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error?.message || `Microsoft refused the message (${r.status}).`); }
    },
  },
};

export { address };
