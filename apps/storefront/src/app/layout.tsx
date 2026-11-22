import type { Metadata } from 'next';
import './globals.css';
import { StorefrontShell } from '../components/StorefrontShell';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000'),
  title: {
    default: 'Mangal Royal Studio — IGI Certified Lab-Grown Diamond Fine Jewellery',
    template: '%s | Mangal Royal Studio',
  },
  description:
    'A unit of Mangal Royal Jewels Pvt Ltd (Since 1975). Explore IGI-certified lab-grown diamond solitaire rings, earrings, necklaces, bracelets, bangles & pendants in BIS-hallmarked gold.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
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

