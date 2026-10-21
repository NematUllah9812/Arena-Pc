import type { Metadata } from 'next';
import { CartView } from '@/components/cart/CartView';

export const metadata: Metadata = { title: 'Cart', robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-hud py-10">
      <h1 className="hud-title mb-6 text-3xl md:text-4xl">Your cart</h1>
      <CartView />
    </div>
  );
}
