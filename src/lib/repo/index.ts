import 'server-only';
import { MemoryRepository } from './memory';
import { SupabaseRepository } from './supabase';
import type { Repository } from './types';

export type { Repository } from './types';

const g = globalThis as unknown as { __vortexRepo?: Repository };

/**
 * Dual-mode data layer. With Supabase credentials the storefront runs against
 * Postgres (atomic RPCs, RLS, Realtime, Storage). Without them — local preview,
 * CI — it falls back to a faithful in-memory port of the same RPC semantics.
 */
export function getRepo(): Repository {
  if (g.__vortexRepo) return g.__vortexRepo;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  g.__vortexRepo = url && key ? new SupabaseRepository(url, key) : new MemoryRepository();
  return g.__vortexRepo;
}

export function isRealtimeConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
