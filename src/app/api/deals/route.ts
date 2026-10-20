import { getRepo } from '@/lib/repo';
import { json, limit } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = await limit(req, 'deals', 60, 60);
  if (limited) return limited;
  const upcoming = new URL(req.url).searchParams.get('upcoming') === '1';
  return json({ ok: true, deals: await getRepo().listFlashDeals({ includeUpcoming: upcoming }) });
}
