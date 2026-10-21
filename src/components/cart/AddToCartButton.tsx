'use client';
import type { PublicProduct } from '@/lib/types';
import { useCart } from './CartProvider';

export function AddToCartButton({
  product,
  flashDealId,
  dealPriceCents,
  label = 'Add to cart',
  size = 'md',
  tone,
  disabled,
  block
}: {
  product: PublicProduct;
  flashDealId?: string | null;
  dealPriceCents?: number;
  label?: string;
  size?: 'sm' | 'md';
  tone?: 'tungsten';
  disabled?: boolean;
  block?: boolean;
}) {
  const { add } = useCart();
  const out = product.available_quantity <= 0;
  return (
    <button
      type="button"
      className={`btn-overclock ${size === 'sm' ? 'size-sm' : ''} ${tone ? `tone-${tone}` : ''} ${block ? 'w-full' : ''}`}
      disabled={out || disabled}
      onClick={() => add(product, { flashDealId: flashDealId ?? null, dealPriceCents })}
    >
      {out ? 'Out of stock' : label}
    </button>
  );
}
