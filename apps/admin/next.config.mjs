/** @type {import('next').NextConfig} */
const rawAdminApiUrl =
  process.env.NEXT_PUBLIC_ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

const nextConfig = {
  // Optional separate build directory (e.g. verification builds next to a running `next dev`). Default unchanged.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@mrs/shared'],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: rawAdminApiUrl.replace(/\/api(\/v1)?\/?$/, ''),
  },
};

export default nextConfig;

