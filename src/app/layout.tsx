import type { Metadata, Viewport } from 'next';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/chakra-petch/700-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import './globals.css';
import { COMPANY } from '@/lib/config/company';
import { CartProvider } from '@/components/cart/CartProvider';
import { ToastProvider } from '@/components/layout/Toasts';
import { governorBootScript } from '@/components/layout/SystemToggles';
import { SearchPalette } from '@/components/search/SearchPalette';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || COMPANY.domain),
  title: {
    default: 'VORTEX LABS // Custom Rig Foundry — Pro-Built Gaming PCs, Austin TX',
    template: '%s // VORTEX LABS'
  },
  description:
    'Hand-assembled, burn-in verified custom gaming PCs and precision PC components. 3-tier compatibility engine, 4-hour OCCT thermal proofs, live Build Bay telemetry. Austin, TX foundry.',
  applicationName: 'Vortex Labs',
  keywords: ['custom gaming pc', 'prebuilt gaming pc', 'pc parts', 'RTX 5090 build', '9800X3D build', 'Austin pc builder'],
  openGraph: {
    type: 'website',
    siteName: COMPANY.fullBrand,
    images: [{ url: '/media/hero-rig.webp', width: 1600, height: 900, alt: 'Vortex Labs Foundry rig' }]
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/icon.svg' }
};

export const viewport: Viewport = {
  themeColor: '#050608',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: governorBootScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[300] focus:bg-volt focus:px-4 focus:py-2 focus:text-void">
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
