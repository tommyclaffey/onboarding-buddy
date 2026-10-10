// Entry point: startServer() for tests, `node server/index.mjs` for dev and production.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SESSION_COOKIE, sessionUser } from './auth.mjs';
import { defaultDbPath, openDb } from './db.mjs';
import { HttpError, Router, parseCookies, readJson, sendJson } from './http.mjs';
import registerAdmin from './routes/admin.mjs';
import registerAuth from './routes/auth.mjs';
import registerHire from './routes/hire.mjs';
import registerOwner from './routes/owner.mjs';
import { serveStatic } from './static.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITES = new Set(['POST', 'PATCH', 'DELETE']);
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' };

export function buildRouter() {
  const r = new Router();
  registerAuth(r);
  registerHire(r);
  registerOwner(r);
  registerAdmin(r);
  return r;
}

export function startServer({ port = 0, db = openDb(defaultDbPath()), dist = path.join(ROOT, 'dist') } = {}) {
  const router = buildRouter();
  const secure = process.env.NODE_ENV === 'production';
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') return sendJson(res, 200, { ok: true });
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, dist, url.pathname);
    const cookies = [];
    try {
      const match = router.match(req.method, url.pathname);
      if (!match) throw new HttpError(404, 'Not found.');
      if (WRITES.has(req.method) && req.headers['x-ob'] !== '1') throw new HttpError(403, 'Missing request header.');
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      const user = sessionUser(db, token);
      const body = WRITES.has(req.method) ? await readJson(req) : {};
      const out = await match.handler({ req, res, db, user, token, params: match.params, body, query: url.searchParams, secure, setCookie: (c) => cookies.push(c) });
      sendJson(res, 200, out ?? { ok: true }, { ...SECURITY, ...(cookies.length ? { 'Set-Cookie': cookies } : {}) });
    } catch (e) {
      if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message, ...(e.data || {}) }, SECURITY);
      console.error(e);
      sendJson(res, 500, { error: 'Something went wrong on our side. Try again in a moment.' }, SECURITY);
    }
  });
  const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  return new Promise((resolve) => server.listen(port, host, () => resolve({ server, db, port: server.address().port })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 4600);
  startServer({ port }).then(({ port: p }) => console.log(`Onboarding Buddy API on http://127.0.0.1:${p}`));
}
