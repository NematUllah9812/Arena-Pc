'use client';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: Promise<SupabaseClient | null> | null = null;

/** Lazily constructed anon client used ONLY for Realtime subscriptions (RLS-scoped public data). */
export function getRealtimeClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return Promise.resolve(null);
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 5 } } })
  );
  return client;
}
