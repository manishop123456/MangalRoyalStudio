import * as crypto from 'node:crypto';
import type { JewelleryProductSpec } from '@mrs/shared';

export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

export interface ShopifyConfigStatus {
  storeDomain: string;
  apiVersion: string;
  hasAdminToken: boolean;
  hasWebhookSecret: boolean;
  liveWritesEnabled: boolean;
  mode: 'LIVE_CONNECTED' | 'SAFE_DRY_RUN_DEFAULT';
}

export function getShopifyConfigStatus(liveWritesFlag?: boolean): ShopifyConfigStatus {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || 'mangal-royal-studio.myshopify.com';
  const hasAdminToken = Boolean(
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN &&
      !process.env.SHOPIFY_ADMIN_ACCESS_TOKEN.includes('xxxx')
  );
  const hasWebhookSecret = Boolean(
    process.env.SHOPIFY_WEBHOOK_SECRET &&
      !process.env.SHOPIFY_WEBHOOK_SECRET.includes('replace')
  );
  const envLiveWrites = process.env.SHOPIFY_LIVE_WRITES_ENABLED === 'true';
  const liveWritesEnabled = Boolean((liveWritesFlag ?? envLiveWrites) && hasAdminToken);

  return {
    storeDomain,
    apiVersion: SHOPIFY_API_VERSION,
    hasAdminToken,
    hasWebhookSecret,
    liveWritesEnabled,
    mode: liveWritesEnabled ? 'LIVE_CONNECTED' : 'SAFE_DRY_RUN_DEFAULT',
  };
}

export function getShopifyWebhookSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env.SHOPIFY_WEBHOOK_SECRET?.trim();
  if (!secret || secret.length < 8 || secret.toLowerCase().includes('replace')) return null;
  return secret;
}

/**
 * Verifies the Shopify HMAC over the exact raw request bytes. There is deliberately no
 * built-in fallback secret: an unconfigured secret rejects every webhook.
 */
export function verifyShopifyWebhookHmac(
  rawBody: string | Buffer,
  hmacHeader: string | undefined,
  secret: string | null = getShopifyWebhookSecret()
): boolean {
  if (!hmacHeader || !secret) return false;
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  const a = Buffer.from(computed);
  const b = Buffer.from(hmacHeader.trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface ShopifyPriceSyncItemResult {
  sku: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  previousPriceInr: string;
  publishedPriceInr: string;
  mode: 'LIVE_GRAPHQL_MUTATION' | 'STAGED_LOCAL_SAFE_GUARD';
  syncedAt: string;
}

export async function syncApprovedPricesToShopify(
  items: Array<{
    product: JewelleryProductSpec;
    newPriceInr: string;
  }>,
  liveWritesEnabled = false
): Promise<{
  apiVersion: string;
  liveWriteExecuted: boolean;
  syncedItems: ShopifyPriceSyncItemResult[];
}> {
  const status = getShopifyConfigStatus(liveWritesEnabled);
  const now = new Date().toISOString();

  const syncedItems: ShopifyPriceSyncItemResult[] = items.map(({ product, newPriceInr }) => ({
    sku: product.sku,
    shopifyProductId: product.shopifyProductGid || `gid://shopify/Product/staged-${product.sku}`,
    shopifyVariantId: product.shopifyVariantGid || `gid://shopify/ProductVariant/staged-${product.sku}`,
    previousPriceInr: product.currentShopifyPriceInr,
    publishedPriceInr: newPriceInr,
    mode: status.liveWritesEnabled ? 'LIVE_GRAPHQL_MUTATION' : 'STAGED_LOCAL_SAFE_GUARD',
    syncedAt: now,
  }));

  return {
    apiVersion: SHOPIFY_API_VERSION,
    liveWriteExecuted: status.liveWritesEnabled,
    syncedItems,
  };
}
