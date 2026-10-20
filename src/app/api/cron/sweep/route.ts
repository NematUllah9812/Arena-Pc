import { getRepo } from '@/lib/repo';
import { timingSafeEqual } from '@/lib/security/encoding';
import { json } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Vercel Cron: reclaim expired 10-minute leases and refresh the facet materialized view. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || !timingSafeEqual(auth, `Bearer ${secret}`)) return json({ ok: false }, { status: 404 });
  const repo = getRepo();
  const released = await repo.sweepExpiredReservations();
  await repo.refreshFacets();
  return json({ ok: true, released, at: new Date().toISOString() });
}
