import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import type { AdminRole, AdminVaultUser } from '@/lib/types';
import { clientIp } from './rate-limit';
import { SESSION_COOKIE, verifySession } from './session';

export const ROLE_CAPABILITIES: Record<AdminRole, { label: string; can: string[] }> = {
  OVERSEER: { label: 'Owner', can: ['inventory', 'pricing', 'deals', 'foundry', 'audit', 'vault', 'override'] },
  INVENTORY_COMMANDER: { label: 'Inventory manager', can: ['inventory', 'audit'] },
  PRICING_OPS: { label: 'Pricing manager', can: ['pricing', 'deals', 'inventory', 'audit'] },
  LEAD_TECHNICIAN: { label: 'Lead technician', can: ['foundry'] }
};

export function can(admin: Pick<AdminVaultUser, 'role'>, capability: string): boolean {
  return ROLE_CAPABILITIES[admin.role]?.can.includes(capability) ?? false;
}

/** Resolve the current Overseer from the session cookie, re-checking the vault row (lock status, role). */
export async function currentAdmin(): Promise<AdminVaultUser | null> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const admin = await getRepo().getAdminById(claims.sub);
  if (!admin || admin.is_locked) return null;
  return admin;
}

/** For server components/pages: redirect to the gate when unauthenticated; 404 when lacking capability. */
export async function requireAdminPage(capability?: string): Promise<AdminVaultUser> {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/gate');
  if (capability && !can(admin, capability)) redirect('/admin?denied=' + encodeURIComponent(capability));
  return admin;
}

/** For route handlers / server actions. */
export async function requireAdminApi(capability?: string): Promise<{ admin: AdminVaultUser; ip: string } | { error: Response }> {
  const admin = await currentAdmin();
  if (!admin) return { error: Response.json({ error: 'OVERSEER_SESSION_REQUIRED' }, { status: 401 }) };
  if (capability && !can(admin, capability)) return { error: Response.json({ error: 'OVERSEER_ROLE_FORBIDDEN' }, { status: 403 }) };
  return { admin, ip: clientIp(await headers()) };
}

export async function requestIp(): Promise<string> {
  return clientIp(await headers());
}

/** WebAuthn relying-party settings, derived from the request host unless pinned by env. */
export async function relyingParty(): Promise<{ rpID: string; origin: string; rpName: string }> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') || h.get('host') || 'localhost:3000').split(',')[0].trim();
  const proto = (h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')).split(',')[0].trim();
  const origin = process.env.WEBAUTHN_ORIGIN || `${proto}://${host}`;
  const rpID = process.env.WEBAUTHN_RP_ID || host.replace(/:\d+$/, '');
  return { rpID, origin, rpName: 'Vortex Labs Overseer Vault' };
}
