import Link from 'next/link';
import type { PublicProduct } from '@/lib/types';
import { money } from '@/lib/format';
import { StockBadge } from '@/components/hud/Badges';
import { ProductImage } from '@/components/hud/ProductImage';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { keySpecs } from './key-specs';

export function ProductCard({ product, priority = false }: { product: PublicProduct; priority?: boolean }) {
  const price = product.sale_price_cents ?? product.base_price_cents;
  const onSale = product.sale_price_cents != null && product.sale_price_cents < product.base_price_cents;
  const specs = keySpecs(product.category, product.specs, 3);
  return (
    <article className="group flex flex-col overflow-hidden rounded-[14px] border border-hairline bg-white transition hover:border-[#d1d5db] hover:shadow-[0_6px_20px_-6px_rgba(16,24,40,0.12)]">
      <Link href={`/product/${product.slug}`} className="relative block aspect-square bg-white" aria-label={product.name}>
        <ProductImage src={product.primary_image_url} alt={product.name} priority={priority} className="p-6 transition-transform duration-300 group-hover:scale-[1.03]" />
        {onSale ? (
          <span className="badge badge-tungsten badge-solid absolute top-3 left-3">Save {Math.round((1 - price / product.base_price_cents) * 100)}%</span>
        ) : product.is_leftover_clearance ? (
          <span className="badge badge-tungsten absolute top-3 left-3">Clearance</span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 border-t border-hairline p-4">
        <p className="text-xs font-medium text-muted">{product.brand}</p>
        <h3 className="line-clamp-2 min-h-[2.6em] text-[0.95rem] leading-snug font-semibold text-primary">
          <Link href={`/product/${product.slug}`} className="hover:text-volt">
            {product.name}
          </Link>
        </h3>
        {specs.length ? <p className="line-clamp-1 text-[0.8125rem] text-secondary">{specs.map((s) => s.value).join(' · ')}</p> : null}
        <StockBadge available={product.available_quantity} />
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div className="flex flex-col">
            <span className={`tabular text-lg font-bold ${onSale ? 'text-tungsten' : 'text-primary'}`}>{money(price)}</span>
            {onSale ? <span className="tabular text-xs text-muted line-through">{money(product.base_price_cents)}</span> : null}
          </div>
          <AddToCartButton product={product} size="sm" label="Add to cart" />
        </div>
      </div>
    </article>
  );
}
