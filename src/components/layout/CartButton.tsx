'use client';
import Link from 'next/link';
import { useCart } from '@/components/cart/CartProvider';
import { CartIcon } from '@/components/ui/Icons';

export function CartButton() {
  const { count, hydrated } = useCart();
  const n = hydrated ? count : 0;
  return (
    <Link href="/cart" className="relative grid h-10 w-10 place-items-center rounded-lg text-primary hover:bg-chassis" aria-label={`Cart, ${n} items`}>
      <CartIcon size={22} />
      {n > 0 ? <span className="tabular absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-volt px-1 text-[0.7rem] font-semibold text-white">{n}</span> : null}
    </Link>
  );
}
