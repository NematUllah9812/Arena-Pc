'use client';
import { useRouter } from 'next/navigation';
import type { PublicProduct } from '@/lib/types';
import { lineFromProduct, useCart } from '@/components/cart/CartProvider';
import { useToast } from '@/components/layout/Toasts';

export function PackageActions({ slug, name, components, inStock }: { slug: string; name: string; components: PublicProduct[]; inStock: boolean }) {
  const { replaceWith, lines } = useCart();
  const { push } = useToast();
  const router = useRouter();
  const load = (dest: '/cart' | '/forge') => {
    if (lines.length && !confirm('Replace the items in your cart with this PC?')) return;
    replaceWith(
      components.map((c) => lineFromProduct(c)),
      { packageSlug: dest === '/cart' ? slug : null, mode: 'PRO_BUILT_FOUNDRY_RIG' }
    );
    push({ title: `${name} loaded`, body: dest === '/cart' ? 'Free assembly applied.' : 'Swap any part you like. Changing parts turns it into a custom build.' });
    router.push(dest);
  };
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button type="button" className="btn-overclock flex-1" disabled={!inStock} onClick={() => load('/cart')}>
        {inStock ? 'Add to cart' : 'Temporarily unavailable'}
      </button>
      <button type="button" className="btn-ghost flex-1" onClick={() => load('/forge')}>
        Customize parts
      </button>
    </div>
  );
}
