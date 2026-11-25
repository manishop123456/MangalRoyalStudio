import type { Metadata } from 'next';
import './globals.css';
import { StorefrontShell } from '../components/StorefrontShell';
import { getSiteUrl } from '../lib/site-url';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'Mangal Royal Studio — IGI Certified Lab-Grown Diamond Fine Jewellery',
    template: '%s | Mangal Royal Studio',
  },
  description:
    'A unit of Mangal Royal Jewels Pvt Ltd (Since 1975). Explore IGI-certified lab-grown diamond solitaire rings, earrings, necklaces, bracelets, bangles & pendants in BIS-hallmarked gold.',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    url: getSiteUrl(),
    siteName: 'Mangal Royal Studio',
    title: 'Mangal Royal Studio — IGI Certified Lab-Grown Diamond Fine Jewellery',
    description:
      'A unit of Mangal Royal Jewels Pvt Ltd (Since 1975). IGI-certified lab-grown diamond fine jewellery in BIS-hallmarked gold.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StorefrontShell>{children}</StorefrontShell>
      </body>
    </html>
  );
}

