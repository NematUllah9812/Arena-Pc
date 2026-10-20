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
    if (lines.length && !confirm('Replace the current manifest with this Syndicate Package?')) return;
    replaceWith(
      components.map((c) => lineFromProduct(c)),
      { packageSlug: dest === '/cart' ? slug : null, mode: 'PRO_BUILT_FOUNDRY_RIG' }
    );
    push({ title: `${name} loaded`, body: dest === '/cart' ? '$149 Foundry assembly fee waived.' : 'Customize in the Rig Forge. Modifying parts converts it to a custom build.' });
    router.push(dest);
  };
  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" className="btn-overclock" disabled={!inStock} onClick={() => load('/cart')}>
        {inStock ? 'Deploy This Rig' : 'Component Backorder'}
      </button>
      <button type="button" className="btn-ghost" onClick={() => load('/forge')}>
        Customize in Rig Forge
      </button>
    </div>
  );
}
