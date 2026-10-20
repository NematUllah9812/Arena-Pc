'use client';
import { useEffect, useState } from 'react';
import type { FlashDeal, FlashDealWithProduct } from '@/lib/types';
import { getRealtimeClient } from '@/lib/realtime-client';

/** Live claim counters: Supabase Realtime postgres_changes when configured, 15s polling otherwise. */
export function useLiveDeals(initial: FlashDealWithProduct[]) {
  const [deals, setDeals] = useState(initial);
  const [live, setLive] = useState<'realtime' | 'polling' | 'connecting'>('connecting');

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let cleanup: (() => void) | null = null;

    const startPolling = () => {
      setLive('polling');
      poll = setInterval(async () => {
        try {
          const res = await fetch('/api/deals?upcoming=1', { cache: 'no-store' });
          if (!res.ok) return;
          const data = (await res.json()) as { deals: FlashDealWithProduct[] };
          if (!cancelled) setDeals(data.deals);
        } catch {
          /* transient */
        }
      }, 15000);
    };

    void getRealtimeClient().then((sb) => {
      if (cancelled) return;
      if (!sb) return startPolling();
      const channel = sb
        .channel('vortex-flash-deals')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'flash_deals' }, (payload) => {
          const row = payload.new as FlashDeal;
          setDeals((prev) => prev.map((d) => (d.id === row.id ? { ...d, claimed_count: row.claimed_count, reserved_claims: row.reserved_claims, is_active: row.is_active } : d)));
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setLive('realtime');
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            void sb.removeChannel(channel);
            if (!poll) startPolling();
          }
        });
      cleanup = () => void sb.removeChannel(channel);
    });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      cleanup?.();
    };
  }, []);

  return { deals, live };
}
