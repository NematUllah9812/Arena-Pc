import { redirect } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import { currentAdmin } from '@/lib/security/admin';
import { GateClient } from '@/components/admin/GateClient';
import { VortexMark } from '@/components/layout/Logo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function GatePage({ searchParams }: { searchParams: Promise<{ invite?: string; codename?: string }> }) {
  if (await currentAdmin()) redirect('/admin');
  const [sp, count] = await Promise.all([searchParams, getRepo().countAdmins()]);
  return (
    <div className="grid min-h-svh place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <VortexMark size={30} />
          <div>
            <p className="font-semibold">Vortex Labs Admin</p>
            <p className="text-sm text-muted">Sign in with your authenticator code and passkey</p>
          </div>
        </div>
        <GateClient bootstrapAvailable={count === 0} invite={sp.invite} inviteCodename={sp.codename} />
      </div>
    </div>
  );
}
