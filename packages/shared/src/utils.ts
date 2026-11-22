/**
 * Resolve a product image URL against the configured API origin when the stored
 * value is a root-relative API path (e.g. `/api/public/product-images/...`).
 */
export function resolveProductImageUrl(url?: string | null, apiBaseOrOrigin?: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/')) {
    const origin = (apiBaseOrOrigin || '').trim().replace(/\/api(\/v1)?\/?$/, '').replace(/\/$/, '');
    return origin ? `${origin}${trimmed}` : trimmed;
  }
  return trimmed;
}
