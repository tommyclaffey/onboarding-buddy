import { LoginLimiter, burnPasswordCheck, createSession, endSession, hashPassword, publicUser, sessionCookie, sha256, verifyPassword } from '../auth.mjs';
import { now } from '../db.mjs';
import { fail } from '../http.mjs';

const limiter = new LoginLimiter();

export default function registerAuth(router) {
  router.post('/api/auth/login', async ({ db, body, req, setCookie, secure }) => {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) fail(400, 'Enter your email and password.');
    const key = email + '|' + (req.socket.remoteAddress || '');
    if (!limiter.check(key)) fail(429, 'Too many tries. Wait 15 minutes, then try again.');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      await burnPasswordCheck(password);
      limiter.record(key);
      fail(401, 'That email and password don’t match. Check both and try again.');
    }
    if (!(await verifyPassword(password, user.password_hash))) {
      limiter.record(key);
      fail(401, 'That email and password don’t match. Check both and try again.');
    }
    limiter.reset(key);
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), user.id);
    const session = createSession(db, user.id);
    setCookie(sessionCookie(session, { secure }));
    // Embedded clients can't keep the cookie, so they get the token to hold for this tab.
    return { user: publicUser(user), ...(req.headers['x-ob-embed'] === '1' ? { sessionToken: session } : {}) };
  });

  router.post('/api/auth/logout', ({ db, token, setCookie, secure }) => {
    endSession(db, token);
    setCookie(sessionCookie('', { secure, clear: true }));
    return { ok: true };
  });

  // Change your own password. Signs out every other session.
  router.post('/api/auth/password', async ({ db, user, token, body }) => {
    if (!user) fail(401, 'Sign in to continue.');
    const current = String(body.current || '');
    const next = String(body.next || '');
    if (!(await verifyPassword(current, user.password_hash))) fail(422, 'Your current password isn’t right.', { field: 'current' });
    if (next.length < 10) fail(422, 'Use at least 10 characters. A short sentence works well.', { field: 'next' });
    if (next === current) fail(422, 'Pick a password you haven’t used here.', { field: 'next' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(user.id, sha256(token));
    return { ok: true };
  });

  // Public config. DEMO=0 hides the one-click demo sign-ins (use for a real company's deployment).
  router.get('/api/config', () => ({ demo: process.env.DEMO !== '0' }));

  router.get('/api/me', ({ user, db }) => {
    if (!user) return { user: null };
    const org = db.prepare('SELECT id, name FROM orgs WHERE id = ?').get(user.org_id);
    return { user: publicUser(user), org };
  });
}
