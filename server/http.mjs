// Tiny HTTP toolkit: router, JSON helpers, cookies, size-limited body reading. Zero dependencies.

export const JSON_LIMIT = 512 * 1024;

export class HttpError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** Throw `{ error }` with a status. Messages are written for people: say what to do next. */
export function fail(status, message, data = null) {
  throw new HttpError(status, message, data);
}

export function sendJson(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(data);
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* ignore malformed cookies */
    }
  }
  return out;
}

export function readJson(req, limit = JSON_LIMIT) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'That request is too large.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' ? v : {});
      } catch {
        reject(new HttpError(400, 'That request could not be read. Refresh and try again.'));
      }
    });
    req.on('error', reject);
  });
}

/** Minimal router: `router.get('/api/tasks/:id', handler)`. Handlers get (ctx) and return a body. */
export class Router {
  constructor() {
    this.routes = [];
  }
  add(method, pattern, handler) {
    const keys = [];
    const re = new RegExp(
      '^' + pattern.replace(/\/:([a-zA-Z_]+)/g, (_, k) => (keys.push(k), '/([^/]+)')) + '/?$',
    );
    this.routes.push({ method, re, keys, handler });
  }
  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  patch(p, h) { this.add('PATCH', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }
  match(method, path) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(path);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        return { handler: r.handler, params };
      }
    }
    return null;
  }
}

export const int = (v, label = 'id') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) fail(400, `That ${label} isn't valid.`);
  return n;
};
