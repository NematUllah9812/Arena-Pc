import type { Metadata } from 'next';
import { CartView } from '@/components/cart/CartView';

export const metadata: Metadata = { title: 'Manifest', robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-hud py-10 md:py-14">
      <header className="mb-8 flex flex-col gap-3">
        <span className="hud-eyebrow">CART // BUILD MANIFEST</span>
        <h1 className="hud-title text-4xl md:text-6xl">Manifest</h1>
      </header>
      <CartView />
    </div>
  );
}
