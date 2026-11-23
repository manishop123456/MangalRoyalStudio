import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/site-url';

export const dynamic = 'force-dynamic';

interface SitemapProduct {
  slug?: string;
  status?: string;
  updatedAt?: string;
}

async function fetchActiveProductHandles(): Promise<SitemapProduct[]> {
  const apiBase = (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://localhost:4000/api'
  ).replace(/\/+$/, '');

  try {
    const res = await fetch(`${apiBase}/storefront/products?pageSize=250`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: SitemapProduct[]; products?: SitemapProduct[] };
    const list = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.products)
        ? data.products
        : [];
    return list.filter(
      (item) => typeof item.slug === 'string' && item.slug.length > 0 && item.status !== 'DRAFT'
    );
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${siteUrl}/collections/all`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/collections/rings`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/collections/earrings`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/collections/necklaces`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/collections/bracelets`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/collections/pendants`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/about-us`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
  ];

  const activeProducts = await fetchActiveProductHandles();
  const productRoutes: MetadataRoute.Sitemap = activeProducts.map((p) => ({
    url: `${siteUrl}/products/${encodeURIComponent(p.slug!)}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  return [...staticRoutes, ...productRoutes];
}
