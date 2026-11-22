import type { NextConfig } from 'next';

const rawStorefrontApiUrl =
  process.env.NEXT_PUBLIC_STOREFRONT_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000/api/v1';

const normalizedStorefrontApiUrl =
  rawStorefrontApiUrl.endsWith('/api/v1') || rawStorefrontApiUrl.endsWith('/api')
    ? rawStorefrontApiUrl
    : `${rawStorefrontApiUrl.replace(/\/$/, '')}/api/v1`;

// Staging builds use a relative API URL (/api/v1). The storefront server then forwards /api/* to the API
// container on the private Docker network (merged from the staging-only config, 2026-11-19).
const internalApiOrigin = (process.env.INTERNAL_API_ORIGIN || 'http://mrs_api:4000').replace(/\/$/, '');
const useInternalApiRewrite = normalizedStorefrontApiUrl.startsWith('/');

const nextConfig: NextConfig = {
  // Optional separate build directory (e.g. verification builds next to a running `next dev`). Default unchanged.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: normalizedStorefrontApiUrl,
  },
  async rewrites() {
    return useInternalApiRewrite
      ? [{ source: '/api/:path*', destination: `${internalApiOrigin}/api/:path*` }]
      : [];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i1dtfi-iv.myshopify.com',
      },
    ],
  },
};

export default nextConfig;

