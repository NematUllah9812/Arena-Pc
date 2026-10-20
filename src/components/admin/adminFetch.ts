'use client';
export async function adminFetch<T = Record<string, unknown>>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<{ ok: boolean; error?: string; detail?: string } & T> {
  const { json, ...rest } = init;
  try {
    const res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { 'content-type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body
    });
    if (res.status === 401) {
      window.location.href = '/admin/gate';
      return { ok: false, error: 'SESSION_EXPIRED' } as never;
    }
    return (await res.json()) as never;
  } catch {
    return { ok: false, error: 'NETWORK_FAULT' } as never;
  }
}
