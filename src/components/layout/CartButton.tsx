'use client';
import Link from 'next/link';
import { useCart } from '@/components/cart/CartProvider';
import { money } from '@/lib/format';

export function CartButton() {
  const { count, quote, hydrated, lease } = useCart();
  return (
    <Link href="/cart" className="btn-ghost size-sm" aria-label={`Manifest, ${count} items`}>
      <span className="tabular">MANIFEST [{hydrated ? count.toString().padStart(2, '0') : '00'}]</span>
      {hydrated && count > 0 ? <span className="tabular hidden text-volt sm:inline">{money(quote.totalCents)}</span> : null}
      {lease ? <span className="status-dot pulse anim-continuous text-verified" title="Inventory locked" /> : null}
    </Link>
  );
}
