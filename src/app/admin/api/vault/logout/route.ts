import { endSession } from '@/lib/security/vault';
import { json } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST() {
  await endSession();
  return json({ ok: true });
}
