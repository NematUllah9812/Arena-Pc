import Link from 'next/link';
import { CartButton } from './CartButton';
import { Wordmark } from './Logo';
import { MobileNav, NavLinks } from './NavLinks';
import { SearchButton } from '@/components/search/SearchPalette';
import { PackageIcon } from '@/components/ui/Icons';

export function SiteHeader() {
  return (
    <header className="site-header hud-glass-panel">
      <div className="container-hud flex h-full items-center gap-6">
        <Link href="/" aria-label="Vortex Labs home" className="shrink-0">
          <Wordmark />
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-1.5">
          <SearchButton />
          <Link href="/telemetry" className="hidden h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-secondary hover:bg-chassis hover:text-primary md:flex">
            <PackageIcon size={18} />
            Track order
          </Link>
          <CartButton />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
