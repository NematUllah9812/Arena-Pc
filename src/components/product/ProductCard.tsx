import Link from 'next/link';
import type { PublicProduct } from '@/lib/types';
import { CATEGORY_CODE, money } from '@/lib/format';
import { HudCard, Meter } from '@/components/hud/HudCard';
import { StockBadge } from '@/components/hud/Badges';
import { ProductImage } from '@/components/hud/ProductImage';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { keySpecs } from './key-specs';

export function ProductCard({ product, priority = false }: { product: PublicProduct; priority?: boolean }) {
  const price = product.sale_price_cents ?? product.base_price_cents;
  const onSale = product.sale_price_cents != null && product.sale_price_cents < product.base_price_cents;
  const specs = keySpecs(product.category, product.specs, 4);
  const perf = Math.min(10, Math.round(product.performance_score / 1000));
  return (
    <HudCard as="article" interactive tone={product.is_leftover_clearance ? 'tungsten' : 'default'} innerClassName="flex flex-col">
      <Link href={`/product/${product.slug}`} className="group relative z-[1] block">
        <div className="relative aspect-[4/3] overflow-hidden border-b border-hairline bg-void">
          <ProductImage src={product.primary_image_url} alt={product.name} priority={priority} className="opacity-90 transition-transform duration-300 group-hover:scale-[1.03]" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <span className="badge badge-muted bg-void/80">{CATEGORY_CODE[product.category]}</span>
            {product.tdp_watts > 0 ? <span className="badge badge-cryo bg-void/80">{product.tdp_watts}W TDP</span> : null}
          </div>
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
            {onSale ? <span className="badge badge-tungsten badge-solid">−{Math.round((1 - price / product.base_price_cents) * 100)}%</span> : null}
            {product.is_leftover_clearance ? <span className="badge badge-tungsten bg-void/80">Clearance</span> : null}
          </div>
        </div>
      </Link>
      <div className="relative z-[1] flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="hud-label">
            {product.brand} · {product.sku}
          </p>
          <h3 className="mt-1 line-clamp-2 min-h-[2.6em] font-display text-[1.02rem] leading-tight font-semibold">
            <Link href={`/product/${product.slug}`} className="hover:text-volt">
              {product.name}
            </Link>
          </h3>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-y border-hairline py-2.5">
          {specs.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="hud-label truncate text-[0.58rem]">{s.label}</dt>
              <dd className="tabular truncate text-xs text-secondary">{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center justify-between gap-2">
          <span className="hud-label">Perf Index</span>
          <div className="w-24">
            <Meter value={perf} />
          </div>
        </div>
        <StockBadge available={product.available_quantity} bin={product.warehouse_bin} />
        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div className="flex flex-col">
            {onSale ? <span className="tabular text-xs text-muted line-through">{money(product.base_price_cents)}</span> : null}
            <span className={`tabular text-xl font-bold ${onSale ? 'text-tungsten' : 'text-primary'}`}>{money(price)}</span>
          </div>
          <AddToCartButton product={product} size="sm" label="Add" />
        </div>
      </div>
    </HudCard>
  );
}
