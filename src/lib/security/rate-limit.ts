/**
 * Fixed-window rate limiter. Uses Upstash Redis (REST) when configured so limits
 * hold across serverless instances; otherwise an in-process window (dev / preview).
 */
type Result = { ok: boolean; remaining: number; resetSeconds: number };

const g = globalThis as unknown as { __vortexRl?: Map<string, { count: number; reset: number }> };
const local = (g.__vortexRl ??= new Map());

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<Result> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const bucket = `vx:rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;

  if (url && token) {
    try {
      const res = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['INCR', bucket],
          ['EXPIRE', bucket, String(windowSeconds)]
        ]),
        cache: 'no-store'
      });
      if (res.ok) {
        const data = (await res.json()) as { result: number }[];
        const count = Number(data[0]?.result ?? 0);
        return { ok: count <= limit, remaining: Math.max(0, limit - count), resetSeconds: windowSeconds };
      }
    } catch {
      /* fall through to local limiter */
    }
  }

  const now = Date.now();
  const entry = local.get(bucket);
  if (!entry || entry.reset < now) {
    local.set(bucket, { count: 1, reset: now + windowSeconds * 1000 });
    if (local.size > 5000) for (const [k, v] of local) if (v.reset < now) local.delete(k);
    return { ok: true, remaining: limit - 1, resetSeconds: windowSeconds };
  }
  entry.count++;
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count), resetSeconds: Math.ceil((entry.reset - now) / 1000) };
}

export function clientIp(headers: Headers): string {
  const raw = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || '0.0.0.0';
  // Strip IPv6-mapped prefix / port so INET casts succeed.
  const ip = raw.replace(/^::ffff:/, '');
  return /^[0-9a-fA-F:.]+$/.test(ip) ? ip : '0.0.0.0';
}
