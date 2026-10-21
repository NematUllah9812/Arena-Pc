'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { HardwareFacet, PartCategory } from '@/lib/types';

const SORTS = [
  ['featured', 'Featured'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['performance', 'Best performance'],
  ['newest', 'Newest']
] as const;

export function CatalogFilters({ facets, category, total }: { facets: HardwareFacet[]; category?: PartCategory; total: number }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const scoped = category ? facets.filter((f) => f.category === category) : facets;
  const uniq = (vals: (string | null)[]) => [...new Set(vals.filter((v): v is string => Boolean(v)))].sort();
  const brands = uniq(scoped.map((f) => f.brand));
  const sockets = uniq(scoped.map((f) => f.cpu_socket));
  const memory = uniq(scoped.map((f) => f.memory_type));
  const forms = uniq(scoped.map((f) => f.form_factor));
  const selectedBrands = (params.get('brand') ?? '').split(',').filter(Boolean);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    next.delete('page');
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
  };
  const toggleBrand = (b: string) => {
    const nextBrands = selectedBrands.includes(b) ? selectedBrands.filter((x) => x !== b) : [...selectedBrands, b];
    set('brand', nextBrands.join(',') || null);
  };

  const chip = (active: boolean, label: string, onClick: () => void) => (
    <label key={label} className="flex cursor-pointer items-center gap-2.5 py-0.5 text-sm text-secondary hover:text-primary">
      <input type="checkbox" className="hud-check" checked={active} onChange={onClick} />
      {label}
    </label>
  );

  return (
    <aside className={`flex flex-col gap-5 rounded-[14px] border border-hairline bg-white p-5 transition-opacity ${pending ? 'opacity-60' : ''}`} aria-label="Catalog filters">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-primary">Filters</span>
        {params.toString() ? (
          <button type="button" className="text-sm font-medium text-volt hover:underline" onClick={() => start(() => router.replace(path, { scroll: false }))}>
            Clear all
          </button>
        ) : null}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-primary">Search</span>
        <input
          className="hud-input"
          defaultValue={params.get('q') ?? ''}
          placeholder="e.g. DDR5, 360mm, 4K"
          onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value.trim() || null)}
          onBlur={(e) => e.target.value.trim() !== (params.get('q') ?? '') && set('q', e.target.value.trim() || null)}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-primary">Sort by</span>
        <select className="hud-select" value={params.get('sort') ?? 'featured'} onChange={(e) => set('sort', e.target.value === 'featured' ? null : e.target.value)}>
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-primary">Availability</span>
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" className="hud-check" checked={params.get('stock') === '1'} onChange={(e) => set('stock', e.target.checked ? '1' : null)} />
          In stock only
        </label>
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" className="hud-check" checked={params.get('clearance') === '1'} onChange={(e) => set('clearance', e.target.checked ? '1' : null)} />
          On sale
        </label>
      </div>

      {brands.length > 1 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-primary">Brand</span>
          <div className="flex flex-col">{brands.map((b) => chip(selectedBrands.includes(b), b, () => toggleBrand(b)))}</div>
        </div>
      ) : null}
      {sockets.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-primary">CPU socket</span>
          <div className="flex flex-col">{sockets.map((s) => chip(params.get('socket') === s, s, () => set('socket', params.get('socket') === s ? null : s)))}</div>
        </div>
      ) : null}
      {memory.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-primary">Memory type</span>
          <div className="flex flex-col">{memory.map((s) => chip(params.get('mem') === s, s, () => set('mem', params.get('mem') === s ? null : s)))}</div>
        </div>
      ) : null}
      {forms.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-primary">Size (form factor)</span>
          <div className="flex flex-col">{forms.map((s) => chip(params.get('ff') === s, s, () => set('ff', params.get('ff') === s ? null : s)))}</div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-primary">Max price ($)</span>
        <input
          className="hud-input"
          inputMode="numeric"
          defaultValue={params.get('max') ?? ''}
          placeholder="No limit"
          onKeyDown={(e) => e.key === 'Enter' && set('max', (e.target as HTMLInputElement).value.replace(/\D/g, '') || null)}
          onBlur={(e) => set('max', e.target.value.replace(/\D/g, '') || null)}
        />
      </div>
    </aside>
  );
}
