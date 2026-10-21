import type { OrderQuote } from '@/lib/engine/pricing';
import { SERVICE_CODES } from '@/lib/config/company';
import { money } from '@/lib/format';

export function QuoteLines({ quote, showReasons = false }: { quote: OrderQuote; showReasons?: boolean }) {
  return (
    <dl className="flex flex-col gap-2 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-secondary">Subtotal</dt>
        <dd className="tabular">{money(quote.partsSubtotalCents)}</dd>
      </div>
      {quote.services.map((s) => {
        const waived = s.price_cents === 0 && s.code === SERVICE_CODES.PRO_ASSEMBLY;
        return (
          <div key={s.code} className="flex justify-between gap-4">
            <dt className="text-secondary">
              {s.name}
              {showReasons ? <span className="block text-xs text-muted">{s.reason}</span> : null}
            </dt>
            <dd className={`tabular shrink-0 ${s.price_cents === 0 ? 'text-verified' : ''}`}>
              {waived ? (
                <>
                  <span className="mr-1.5 text-muted line-through">$149</span>Free
                </>
              ) : s.price_cents === 0 ? (
                'Included'
              ) : (
                money(s.price_cents)
              )}
            </dd>
          </div>
        );
      })}
      <div className="flex justify-between gap-4">
        <dt className="text-secondary">Shipping</dt>
        <dd className="tabular text-verified">Free</dd>
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-3">
        <dt className="text-base font-semibold">Total</dt>
        <dd className="tabular text-2xl font-bold text-primary">{money(quote.totalCents)}</dd>
      </div>
    </dl>
  );
}
