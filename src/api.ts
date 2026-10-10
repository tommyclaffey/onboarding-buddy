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

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-OB': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Something went wrong. Try again.', data);
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
