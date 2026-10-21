// Fetch wrapper. Writes send the X-OB header the server requires. Errors carry the server's plain-words message.
export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Inside another site's iframe (the portfolio's phone preview), browsers block this app's
// session cookie. There the session is kept for this tab and sent as a bearer token instead.
const EMBEDDED = (() => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
})();
const TOKEN_KEY = 'ob_embed_session';
let memoryToken: string | null = null;
function embedToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}
function setEmbedToken(t: string | null) {
  memoryToken = t;
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the in-memory copy still works until reload */
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-OB': '1' };
  if (EMBEDDED) {
    headers['X-OB-Embed'] = '1';
    const t = embedToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (EMBEDDED && url === '/api/auth/logout') setEmbedToken(null);
  if (!res.ok) throw new ApiError(res.status, data.error || 'Something went wrong. Try again.', data);
  if (EMBEDDED && typeof data.sessionToken === 'string') setEmbedToken(data.sessionToken);
  if (data && typeof data === 'object') delete data.sessionToken;
  // Any successful write may change counts elsewhere (sidebar, etc.): tell listeners.
  if (method !== 'GET' && typeof window !== 'undefined') window.dispatchEvent(new Event('ob:data'));
  return data as T;
}

export const api = {
  get: <T,>(url: string) => request<T>('GET', url),
  post: <T,>(url: string, body: unknown = {}) => request<T>('POST', url, body),
  patch: <T,>(url: string, body: unknown = {}) => request<T>('PATCH', url, body),
  del: <T,>(url: string) => request<T>('DELETE', url),
};
