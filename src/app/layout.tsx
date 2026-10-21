import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
import { COMPANY } from '@/lib/config/company';
import { CartProvider } from '@/components/cart/CartProvider';
import { ToastProvider } from '@/components/layout/Toasts';
import { SearchPalette } from '@/components/search/SearchPalette';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || COMPANY.domain),
  title: {
    default: 'Vortex Labs — Custom Gaming PCs & PC Parts, Austin TX',
    template: '%s | Vortex Labs'
  },
  description:
    'Custom gaming PCs and PC parts. Built and stress-tested in Austin, TX, with a live compatibility check and order tracking.',
  applicationName: 'Vortex Labs',
  keywords: ['custom gaming pc', 'prebuilt gaming pc', 'pc parts', 'RTX 5090 build', '9800X3D build', 'Austin pc builder'],
  openGraph: {
    type: 'website',
    siteName: COMPANY.fullBrand,
    images: [{ url: '/media/hero-rig.webp', width: 1600, height: 900, alt: 'Vortex Labs gaming PC' }]
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/icon.svg' }
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[300] focus:rounded-md focus:bg-volt focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <ToastProvider>
          <CartProvider>
            {children}
            <SearchPalette />
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
