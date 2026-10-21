import Link from 'next/link';

export function NotFoundContent() {
  return (
    <div className="container-hud flex min-h-[60vh] flex-col items-center justify-center gap-5 py-24 text-center">
      <p className="text-sm font-semibold text-volt">404</p>
      <h1 className="hud-title text-3xl md:text-4xl">We can&rsquo;t find that page</h1>
      <p className="max-w-md text-secondary">The page may have moved, or the link may be mistyped. Try searching or head back to the shop.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-overclock">
          Go to homepage
        </Link>
        <Link href="/catalog" className="btn-ghost">
          Shop all parts
        </Link>
      </div>
    </div>
  );
}
