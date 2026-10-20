'use client';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import type { BuildBayStage, PublicTelemetryView } from '@/lib/types';
import { STAGES, trackingUrl } from '@/lib/engine/build-bay';
import { formatDate, formatDateTime, money } from '@/lib/format';
import { getRealtimeClient } from '@/lib/realtime-client';
import { HudCard } from '@/components/hud/HudCard';
import { TierBadge } from '@/components/hud/Badges';
import { useToast } from '@/components/layout/Toasts';
import { playClick } from '@/components/layout/feedback';
import { ThermalCurve } from './ThermalCurve';
import { CheckIcon } from '@/components/ui/Icons';

export function TelemetryTracker({ initial, welcome }: { initial: PublicTelemetryView; welcome?: boolean }) {
  const [view, setView] = useState(initial);
  const [feed, setFeed] = useState<'realtime' | 'polling'>('polling');
  const [synced, setSynced] = useState<string | null>(null);
  const { push } = useToast();

  useEffect(() => {
    let cancelled = false;
    let lastStage = initial.current_stage;
    const refresh = async () => {
      try {
        const res = await fetch(`/api/telemetry/${initial.order_number}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { telemetry: PublicTelemetryView };
        if (cancelled) return;
        if (data.telemetry.current_stage !== lastStage) {
          lastStage = data.telemetry.current_stage;
          playClick('confirm');
          push({ title: 'Order update', body: STAGES[data.telemetry.current_stage].label });
        }
        setView(data.telemetry);
        setSynced(new Date().toISOString());
      } catch {
        /* transient */
      }
    };
    setSynced(new Date().toISOString());
    const poll = setInterval(refresh, 20000);
    let cleanup: (() => void) | null = null;
    void getRealtimeClient().then((sb) => {
      if (!sb || cancelled) return;
      const ch = sb
        .channel(`telemetry:${initial.order_number}`)
        .on('broadcast', { event: 'stage' }, () => void refresh())
        .subscribe((s) => s === 'SUBSCRIBED' && setFeed('realtime'));
      cleanup = () => void sb.removeChannel(ch);
    });
    return () => {
      cancelled = true;
      clearInterval(poll);
      cleanup?.();
    };
  }, [initial.order_number, initial.current_stage, push]);

  const seq = view.stage_sequence;
  const currentIdx = seq.indexOf(view.current_stage);
  const logFor = (s: BuildBayStage) => view.logs.filter((l) => l.stage === s).at(-1);
  const burn = logFor('OCCT_THERMAL_BURN_IN_4HR');
  const bios = logFor('BIOS_FLASH_AND_EXPO_TUNING');
  const track = trackingUrl(view.carrier, view.carrier_tracking_number);
  const isPro = view.fulfillment_type === 'PRO_BUILT_FOUNDRY_RIG';
  const pct = seq.length > 1 ? (currentIdx / (seq.length - 1)) * 100 : 0;
  const dispatched = currentIdx >= seq.indexOf('DISPATCHED_CARRIER');

  return (
    <div className="flex flex-col gap-8">
      {welcome ? (
        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-5 py-4">
          <p className="font-semibold text-verified">Thanks for your order!</p>
          <p className="mt-1 text-sm text-secondary">
            Thanks, {view.customer_first_name}. We sent a confirmation and a secure payment link to {view.masked_email}. Bookmark this page — it updates automatically as your order progresses.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Customer', view.customer_first_name],
          ['Order type', isPro ? 'Built by us' : 'Parts only'],
          ['Estimated ship date', formatDate(view.estimated_dispatch_date)],
          ['Technician', view.assigned_technician_code ?? 'Not yet assigned']
        ].map(([l, v]) => (
          <div key={l} className="hud-panel p-4">
            <p className="hud-label">{l}</p>
            <p className="tabular mt-1 text-lg font-semibold">{v}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <HudCard innerClassName="p-5 md:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-lg font-semibold">Order progress</span>
          <span className="flex items-center gap-2 text-xs text-muted">
            <span className={`status-dot ${feed === 'realtime' ? 'pulse anim-continuous text-verified' : 'text-tolerance'}`} />
            {feed === 'realtime' ? 'Live updates' : 'Updates every 20 seconds'}
            {synced ? ` · ${formatDateTime(synced)}` : ''}
          </span>
        </div>
        <div className="relative mb-8 hidden h-1.5 overflow-hidden rounded-full bg-elevated md:block">
          <div className="absolute inset-y-0 left-0 rounded-full bg-volt transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <ol className="grid gap-4 md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ '--cols': seq.length } as CSSProperties}>
          {seq.map((s, i) => {
            const state = i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending';
            const log = logFor(s);
            return (
              <li key={s} className={`stage-${state} flex gap-3 md:flex-col`} aria-current={state === "active" ? "step" : undefined}>
                <span className={`tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${state === 'done' ? 'border-volt bg-volt text-white' : state === 'active' ? 'border-volt bg-[#eff6ff] text-volt' : 'border-hairline text-muted'}`}>
                  {state === 'done' ? <CheckIcon size={16} strokeWidth={2.4} /> : i + 1}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${state === 'pending' ? 'text-muted' : ''}`}>{STAGES[s].label}</p>
                  <p className="mt-0.5 text-xs text-secondary">{STAGES[s].customerTelemetry}</p>
                  {log ? <p className="tabular mt-1 text-xs text-muted">{formatDateTime(log.logged_at)}</p> : null}
                  {state === 'active' && s !== 'DELIVERED' ? <span className="badge badge-cryo mt-2">In progress</span> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </HudCard>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          {burn ? (
            <HudCard tone="tungsten" innerClassName="flex flex-col gap-5 p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-lg font-semibold">Stress test results</span>
                {burn.proof_screenshot_url ? (
                  <a href={burn.proof_screenshot_url} target="_blank" rel="noopener" className="btn-ghost size-sm">
                    View test screenshot
                  </a>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['Idle CPU', burn.telemetry_metrics.idle_cpu_temp_c, '°C'],
                  ['Max CPU temp', burn.telemetry_metrics.peak_occt_cpu_temp_c, '°C'],
                  ['Max GPU temp', burn.telemetry_metrics.peak_furmark_gpu_temp_c, '°C'],
                  ['3DMark score', burn.telemetry_metrics.time_spy_score, '']
                ].map(([l, v, u]) => (
                  <div key={String(l)} className="rounded-lg bg-chassis p-3">
                    <p className="text-xs text-muted">{l}</p>
                    <p className="tabular mt-1 text-xl font-semibold">
                      {v != null ? Number(v).toLocaleString() : '—'}
                      <span className="text-xs text-muted">{u}</span>
                    </p>
                  </div>
                ))}
              </div>
              {burn.telemetry_metrics.thermal_curve?.length ? <ThermalCurve points={burn.telemetry_metrics.thermal_curve} /> : null}
              {burn.technician_notes ? <p className="border-l-2 border-hairline pl-3 text-sm text-secondary">“{burn.technician_notes}” — {burn.technician_code}</p> : null}
            </HudCard>
          ) : null}

          <HudCard innerClassName="p-5">
            <span className="text-lg font-semibold">Activity</span>
            <ol className="mt-4 flex flex-col">
              {[...view.logs].reverse().map((l) => (
                <li key={l.id} className="grid grid-cols-[110px_1fr] gap-4 border-b border-hairline py-3 last:border-0">
                  <span className="tabular text-xs text-muted">{formatDateTime(l.logged_at)}</span>
                  <div className="min-w-0">
                    <p className="text-sm">
                      {STAGES[l.stage].label} <span className="text-xs text-muted">· {l.technician_code}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {l.telemetry_metrics.bench_bay_id ? <span className="badge badge-muted">Bay {l.telemetry_metrics.bench_bay_id}</span> : null}
                      {l.telemetry_metrics.bios_version_flashed ? <span className="badge badge-cryo">BIOS {l.telemetry_metrics.bios_version_flashed}</span> : null}
                      {l.telemetry_metrics.expo_xmp_profile_verified ? <span className="badge badge-cryo">{l.telemetry_metrics.expo_xmp_profile_verified}</span> : null}
                      {l.telemetry_metrics.serials ? <span className="badge badge-muted">{Object.keys(l.telemetry_metrics.serials).length} serial numbers recorded</span> : null}
                      {l.telemetry_metrics.foam_brace_molded ? <span className="badge badge-verified">GPU support foam added</span> : null}
                      {l.telemetry_metrics.crate_sealed ? <span className="badge badge-verified">Packed</span> : null}
                    </div>
                    {l.technician_notes && l.stage !== 'OCCT_THERMAL_BURN_IN_4HR' ? <p className="mt-1 text-xs text-secondary">{l.technician_notes}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </HudCard>
        </div>

        <div className="flex flex-col gap-6">
          {dispatched || track ? (
            <HudCard tone="cryo" innerClassName="flex flex-col gap-3 p-5">
              <span className="text-lg font-semibold">Shipping</span>
              <p className="text-sm">
                {view.carrier ?? '—'} · <span className="tabular">{view.carrier_tracking_number ?? 'pending'}</span>
              </p>
              {track ? (
                <a href={track} target="_blank" rel="noopener noreferrer" className="btn-overclock size-sm self-start">
                  Track with {view.carrier}
                </a>
              ) : null}
            </HudCard>
          ) : null}

          <HudCard innerClassName="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Items in this order</span>
              <TierBadge tier={view.compatibility_confidence} compact />
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {view.manifest.lines.map((l) => (
                <li key={l.product_id + (l.flash_deal_id ?? '')} className="flex justify-between gap-3">
                  <span className="truncate text-secondary">
                    {l.quantity > 1 ? `${l.quantity}× ` : ''}
                    {l.name}
                  </span>
                </li>
              ))}
            </ul>
            {view.manifest.compatibility ? (
              <p className="tabular text-xs text-muted">
                Peak power {view.manifest.compatibility.estimated_peak_transient_wattage}W · Recommended PSU {view.manifest.compatibility.recommended_psu_wattage}W
              </p>
            ) : null}
            <p className="tabular border-t border-hairline pt-3 text-sm">
              Total <span className="float-right font-bold">{money(view.total_charged_cents)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/telemetry/${view.order_number}/blueprint`} className="btn-ghost size-sm">
                Printable summary
              </Link>
              {bios || isPro ? (
                <a href={`/telemetry/${view.order_number}/bios-profile`} className="btn-ghost size-sm">
                  BIOS profile (.txt)
                </a>
              ) : null}
            </div>
          </HudCard>

          {view.requires_tech_clearance_check ? (
            <p className="rounded-xl bg-[#fffbeb] px-4 py-3 text-sm text-secondary">
              Some parts are a tight fit, so a technician will check the fit by hand during assembly.
            </p>
          ) : null}
          {view.includes_foam_gpu_brace ? (
            <p className="rounded-xl bg-[#f0f9ff] px-4 py-3 text-sm text-secondary">Your graphics card is heavy, so we add protective foam around it for shipping.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
