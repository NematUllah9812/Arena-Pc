'use client';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import type { BuildBayStage, PublicTelemetryView } from '@/lib/types';
import { STAGES, trackingUrl } from '@/lib/engine/build-bay';
import { CATEGORY_CODE, formatDate, formatDateTime, money } from '@/lib/format';
import { getRealtimeClient } from '@/lib/realtime-client';
import { HudCard } from '@/components/hud/HudCard';
import { TierBadge } from '@/components/hud/Badges';
import { useToast } from '@/components/layout/Toasts';
import { playClick } from '@/components/layout/feedback';
import { ThermalCurve } from './ThermalCurve';

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
          push({ title: 'Build Bay update', body: STAGES[data.telemetry.current_stage].label });
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
        <div className="border border-volt/40 bg-volt/5 px-5 py-4">
          <p className="font-mono text-xs tracking-[0.14em] text-volt uppercase">Order committed</p>
          <p className="mt-1 text-sm text-secondary">
            Welcome to the Syndicate, {view.customer_first_name}. A confirmation and secure payment link were sent to {view.masked_email}. Bookmark this page — it updates live as your rig moves
            through the Build Bay.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Operator', view.customer_first_name],
          ['Mode', isPro ? 'B · Pro-Built' : 'A · DIY Kit'],
          ['Est. Dispatch', formatDate(view.estimated_dispatch_date)],
          ['Technician', view.assigned_technician_code ?? 'Unassigned']
        ].map(([l, v]) => (
          <div key={l} className="hud-panel p-4">
            <p className="hud-label">{l}</p>
            <p className="tabular mt-1 text-lg">{v}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <HudCard innerClassName="p-5 md:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="hud-eyebrow">Build Bay Pipeline</span>
          <span className="flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.12em] text-muted uppercase">
            <span className={`status-dot ${feed === 'realtime' ? 'pulse anim-continuous text-verified' : 'text-tolerance'}`} />
            {feed === 'realtime' ? 'Live broadcast' : '20s sync'}
            {synced ? ` · ${formatDateTime(synced)}` : ''}
          </span>
        </div>
        <div className="relative mb-8 hidden h-1 bg-elevated md:block">
          <div className="absolute inset-y-0 left-0 bg-volt transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <ol className="grid gap-4 md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ '--cols': seq.length } as CSSProperties}>
          {seq.map((s, i) => {
            const state = i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending';
            const log = logFor(s);
            return (
              <li key={s} className={`stage-${state} flex gap-3 md:flex-col`} aria-current={state === "active" ? "step" : undefined}>
                <span className={`tabular flex h-8 w-8 shrink-0 items-center justify-center border font-mono text-xs ${state === 'done' ? 'border-volt bg-volt text-void' : state === 'active' ? 'border-volt text-volt' : 'border-hairline text-muted'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className={`font-display text-sm font-semibold tracking-wide uppercase ${state === 'pending' ? 'text-muted' : ''}`}>{STAGES[s].short}</p>
                  <p className="mt-0.5 text-xs text-secondary">{STAGES[s].customerTelemetry}</p>
                  {log ? <p className="tabular mt-1 font-mono text-[0.6rem] text-muted">{formatDateTime(log.logged_at)}</p> : null}
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
                <span className="hud-eyebrow">OCCT Thermal Burn-In · Proof of Stability</span>
                {burn.proof_screenshot_url ? (
                  <a href={burn.proof_screenshot_url} target="_blank" rel="noopener" className="btn-ghost size-sm">
                    Download thermal proof
                  </a>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-px border border-hairline bg-hairline md:grid-cols-4">
                {[
                  ['Idle CPU', burn.telemetry_metrics.idle_cpu_temp_c, '°C'],
                  ['Peak CPU (OCCT)', burn.telemetry_metrics.peak_occt_cpu_temp_c, '°C'],
                  ['Peak GPU (FurMark)', burn.telemetry_metrics.peak_furmark_gpu_temp_c, '°C'],
                  ['3DMark Time Spy', burn.telemetry_metrics.time_spy_score, '']
                ].map(([l, v, u]) => (
                  <div key={String(l)} className="bg-chassis p-3">
                    <p className="hud-label text-[0.58rem]">{l}</p>
                    <p className="tabular mt-1 text-xl">
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
            <span className="hud-eyebrow">Telemetry Log</span>
            <ol className="mt-4 flex flex-col">
              {[...view.logs].reverse().map((l) => (
                <li key={l.id} className="grid grid-cols-[110px_1fr] gap-4 border-b border-hairline py-3 last:border-0">
                  <span className="tabular font-mono text-[0.65rem] text-muted">{formatDateTime(l.logged_at)}</span>
                  <div className="min-w-0">
                    <p className="text-sm">
                      {STAGES[l.stage].label} <span className="font-mono text-xs text-muted">· {l.technician_code}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {l.telemetry_metrics.bench_bay_id ? <span className="badge badge-muted">Bay {l.telemetry_metrics.bench_bay_id}</span> : null}
                      {l.telemetry_metrics.bios_version_flashed ? <span className="badge badge-cryo">BIOS {l.telemetry_metrics.bios_version_flashed}</span> : null}
                      {l.telemetry_metrics.expo_xmp_profile_verified ? <span className="badge badge-cryo">{l.telemetry_metrics.expo_xmp_profile_verified}</span> : null}
                      {l.telemetry_metrics.serials ? <span className="badge badge-muted">{Object.keys(l.telemetry_metrics.serials).length} serials scanned</span> : null}
                      {l.telemetry_metrics.foam_brace_molded ? <span className="badge badge-verified">Foam brace molded</span> : null}
                      {l.telemetry_metrics.crate_sealed ? <span className="badge badge-verified">Crate sealed</span> : null}
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
              <span className="hud-eyebrow">Freight</span>
              <p className="font-mono text-sm">
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
              <span className="hud-eyebrow">System Blueprint</span>
              <TierBadge tier={view.compatibility_confidence} compact />
            </div>
            <ul className="flex flex-col gap-1.5 text-xs">
              {view.manifest.lines.map((l) => (
                <li key={l.product_id + (l.flash_deal_id ?? '')} className="flex justify-between gap-3">
                  <span className="truncate text-secondary">
                    <span className="font-mono text-muted">{CATEGORY_CODE[l.category]}</span> {l.quantity > 1 ? `${l.quantity}× ` : ''}
                    {l.name}
                  </span>
                </li>
              ))}
            </ul>
            {view.manifest.compatibility ? (
              <p className="tabular font-mono text-[0.65rem] text-muted">
                Peak transient {view.manifest.compatibility.estimated_peak_transient_wattage}W · PSU target {view.manifest.compatibility.recommended_psu_wattage}W
              </p>
            ) : null}
            <p className="tabular border-t border-hairline pt-3 text-sm">
              Total <span className="float-right font-bold">{money(view.total_charged_cents)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/telemetry/${view.order_number}/blueprint`} className="btn-ghost size-sm">
                Printable blueprint
              </Link>
              {bios || isPro ? (
                <a href={`/telemetry/${view.order_number}/bios-profile`} className="btn-ghost size-sm">
                  BIOS profile (.txt)
                </a>
              ) : null}
            </div>
          </HudCard>

          {view.requires_tech_clearance_check ? (
            <p className="border-l-2 border-tolerance bg-tolerance/5 px-4 py-3 text-xs text-secondary">
              Tight-tolerance clearance flagged by the Compatibility Engine — your technician performs a manual fit verification at the bench.
            </p>
          ) : null}
          {view.includes_foam_gpu_brace ? (
            <p className="border-l-2 border-cryo bg-cryo/5 px-4 py-3 text-xs text-secondary">Heavy GPU detected — an Instapak Quick RT foam brace is molded around the card for transit.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
