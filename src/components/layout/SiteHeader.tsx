import Link from 'next/link';
import { CartButton } from './CartButton';
import { VortexMark } from './Logo';
import { MobileNav, NavLinks } from './NavLinks';
import { SearchButton } from '@/components/search/SearchPalette';

export function SiteHeader() {
  return (
    <header className="site-header hud-glass-panel">
      <div className="container-hud flex h-full items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Vortex Labs home">
          <VortexMark />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold tracking-[0.08em]">VORTEX LABS</span>
            <span className="font-mono text-[0.55rem] tracking-[0.3em] text-muted">CUSTOM RIG FOUNDRY</span>
          </span>
        </Link>
        <NavLinks />
        <div className="flex items-center gap-2">
          <SearchButton />
          <CartButton />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
