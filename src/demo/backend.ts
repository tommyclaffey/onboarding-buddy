// @ts-nocheck — imports the plain-JS server modules and sql.js, which ship without types.
// Static portfolio demo: the real server routes, running in the browser on an in-memory copy of the
// seeded Brightside data. Every visitor gets their own fresh copy, signed in as Hana (new hire).
// Only built when VITE_STATIC_DEMO=1 (vite.demo.config.ts). No network, no cookies, so it works
// inside another site's iframe (the portfolio's Live preview).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Buffer } from 'buffer';
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

type Result = { status: number; data: any };
let booting: Promise<(m: string, u: string, b?: unknown) => Promise<Result>> | null = null;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
// Data from the server points at /photos/..., /logos/...; on GitHub Pages they live under the base path.
function rebase(v: any): any {
  if (typeof v === 'string') return /^\/(photos|logos|videos|media)\//.test(v) ? BASE + v : v;
  if (Array.isArray(v)) return v.map(rebase);
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const [k, x] of Object.entries(v)) o[k] = rebase(x);
    return o;
  }
  return v;
}

async function boot() {
  (globalThis as any).Buffer = Buffer;
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  (await import('./shims/sqlite')).setSQL(SQL);
  const { openDb } = await import('../../server/db.mjs');
  const { seed } = await import('../../server/seed.mjs');
  const { Router, HttpError, Redirect } = await import('../../server/http.mjs');
  const registerAuth = (await import('../../server/routes/auth.mjs')).default;
  const registerHire = (await import('../../server/routes/hire.mjs')).default;
  const registerOwner = (await import('../../server/routes/owner.mjs')).default;
  const db = openDb(':memory:');
  await seed(db);
  const router = new Router();
  registerAuth(router);
  registerHire(router);
  registerOwner(router);
  const hana = () => db.prepare("SELECT * FROM users WHERE email = 'hana@brightside.test'").get();

  return async (method: string, url: string, body?: unknown): Promise<Result> => {
    const u = new URL(url, 'http://demo');
    if (u.pathname === '/api/config') return { status: 200, data: { demo: true, staticDemo: true } };
    // Signing in or out of the demo always lands back on Hana.
    if (u.pathname === '/api/auth/logout') return { status: 200, data: { ok: true } };
    if (u.pathname === '/api/auth/login') return { status: 200, data: rebase({ user: (await import('../../server/auth.mjs')).publicUser(hana()) }) };
    const match = router.match(method, u.pathname);
    if (!match) return { status: 404, data: { error: 'That isn’t part of the demo.' } };
    try {
      const out = await match.handler({
        req: { headers: {}, socket: { remoteAddress: 'demo' } },
        res: null, db, user: hana(), token: 'demo', params: match.params,
        body: body ?? {}, query: u.searchParams, secure: false, setCookie: () => undefined,
      });
      if (out instanceof Redirect) return { status: 200, data: { ok: true } };
      return { status: 200, data: rebase(out ?? { ok: true }) };
    } catch (e: any) {
      if (e instanceof HttpError) return { status: (e as any).status, data: { error: e.message, ...((e as any).data || {}) } };
      console.error(e);
      return { status: 500, data: { error: 'Something went wrong in the demo. Reload to start fresh.' } };
    }
  };
}

export function demoRequest(method: string, url: string, body?: unknown) {
  booting ??= boot();
  return booting.then((handle) => handle(method, url, body));
}
