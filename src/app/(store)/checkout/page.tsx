import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/cart/CheckoutForm';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-hud py-10 md:py-14">
      <header className="mb-8 flex flex-col gap-3">
        <span className="hud-eyebrow">CHECKOUT // SECURE COMMIT</span>
        <h1 className="hud-title text-4xl md:text-6xl">Commit Order</h1>
      </header>
      <CheckoutForm />
    </div>
  );
}
