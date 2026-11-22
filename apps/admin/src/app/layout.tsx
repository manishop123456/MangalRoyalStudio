import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mangal Royal Studio — Jewellery Operations & Pricing Admin',
  description:
    'Custom Administrative Dashboard for Mangal Royal Studio: Jewellery Pricing Engine, Gold & Diamond Rate Matrices, 11-Sheet Excel Bulk Importer, Shopify Admin Sync, Shiprocket & Razorpay Operations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

