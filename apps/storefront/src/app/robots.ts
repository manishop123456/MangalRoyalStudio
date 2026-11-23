import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/account',
          '/cart',
          '/checkout',
          '/order-tracking',
          '/pages/order-tracking',
          '/wishlist',
          '/customize',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
