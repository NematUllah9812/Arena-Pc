import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/cart/CheckoutForm';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-hud py-10">
      <h1 className="hud-title mb-6 text-3xl md:text-4xl">Checkout</h1>
      <CheckoutForm />
    </div>
  );
}
