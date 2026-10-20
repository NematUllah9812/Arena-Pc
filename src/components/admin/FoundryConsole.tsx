'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { BuildBayStage } from '@/lib/types';
import type { StageFieldMap } from '@/lib/engine/build-bay';
import { HudCard } from '@/components/hud/HudCard';
import { useToast } from '@/components/layout/Toasts';
import { adminFetch } from './adminFetch';

type Field = keyof StageFieldMap;

const LABELS: Partial<Record<Field, [string, string]>> = {
  bench_bay_id: ['Bench bay ID', 'A-07'],
  bios_version_flashed: ['BIOS version flashed', '3001'],
  expo_xmp_profile_verified: ['EXPO / XMP profile verified', 'EXPO I · DDR5-6000 CL30'],
  idle_cpu_temp_c: ['Idle CPU °C', '34'],
  peak_occt_cpu_temp_c: ['Peak OCCT CPU °C', '82'],
  peak_furmark_gpu_temp_c: ['Peak FurMark GPU °C', '71'],
  time_spy_score: ['3DMark Time Spy', '28450'],
  tracking_number: ['Tracking number', '1Z…']
};

export function FoundryConsole({ orderNumber, toStage, stageLabel, requirement, fields, defaultTech, skus }: { orderNumber: string; toStage: BuildBayStage; stageLabel: string; requirement: string; fields: Field[]; defaultTech: string; skus: string[] }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { push } = useToast();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('orderNumber', orderNumber);
    fd.set('toStage', toStage);
    setBusy(true);
    const res = await adminFetch<{ stage: string }>('/admin/api/foundry', { method: 'POST', body: fd });
    setBusy(false);
    if (!res.ok) return push({ title: res.error ?? 'Rejected', body: res.detail, tone: 'error' });
    push({ title: 'Stage committed', body: `${orderNumber} → ${stageLabel}. Customer tracker notified.` });
    router.refresh();
  };

  const numeric = (f: Field) => ['idle_cpu_temp_c', 'peak_occt_cpu_temp_c', 'peak_furmark_gpu_temp_c', 'time_spy_score'].includes(f);

  return (
    <HudCard tone="cryo" innerClassName="p-5">
      <form onSubmit={submit} className="flex flex-col gap-3" encType="multipart/form-data">
        <p className="hud-eyebrow">Advance → {stageLabel}</p>
        <p className="text-xs text-secondary">{requirement}</p>
        <label className="flex flex-col gap-1">
          <span className="hud-label">Technician code</span>
          <input name="technician_code" defaultValue={defaultTech} className="hud-input uppercase" maxLength={24} required />
        </label>
        {fields.includes('serials') ? (
          <label className="flex flex-col gap-1">
            <span className="hud-label">Serial scans (SKU: SERIAL per line)</span>
            <textarea name="serials" rows={Math.min(10, skus.length + 1)} className="hud-textarea font-mono text-xs" defaultValue={skus.map((s) => `${s}: `).join('\n')} required />
          </label>
        ) : null}
        {fields
          .filter((f) => LABELS[f])
          .map((f) => (
            <label key={f} className="flex flex-col gap-1">
              <span className="hud-label">{LABELS[f]![0]}</span>
              <input name={f} className="hud-input" placeholder={LABELS[f]![1]} required type={numeric(f) ? 'number' : 'text'} step={numeric(f) ? '0.1' : undefined} />
            </label>
          ))}
        {fields.includes('carrier') ? (
          <label className="flex flex-col gap-1">
            <span className="hud-label">Carrier</span>
            <select name="carrier" className="hud-select" required>
              <option value="UPS">UPS</option>
              <option value="FEDEX">FedEx</option>
            </select>
          </label>
        ) : null}
        {fields.includes('proof_screenshot') ? (
          <label className="flex flex-col gap-1">
            <span className="hud-label">OCCT + 3DMark proof screenshot (PNG/JPEG/WebP, ≤ 4 MB)</span>
            <input name="proof_screenshot" type="file" accept="image/png,image/jpeg,image/webp" className="hud-input text-xs" required />
          </label>
        ) : null}
        {fields.includes('foam_brace_molded') ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="foam_brace_molded" className="hud-check" required /> Instapak foam brace molded around GPU
          </label>
        ) : null}
        {fields.includes('crate_sealed') ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="crate_sealed" className="hud-check" required /> Double-walled shock crate sealed
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="hud-label">Technician notes (visible to customer)</span>
          <textarea name="notes" rows={2} maxLength={600} className="hud-textarea text-sm" />
        </label>
        <button type="submit" className="btn-overclock" disabled={busy}>
          {busy ? 'Committing…' : 'Commit stage'}
        </button>
      </form>
    </HudCard>
  );
}
