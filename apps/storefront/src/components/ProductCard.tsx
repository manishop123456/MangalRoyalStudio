'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveProductImageUrl, type JewelleryProductSpec } from '@mrs/shared';
import {
  API_ORIGIN,
  buildShopifyImageSrcSet,
  formatInr,
  formatProductPrice,
  PRODUCT_IMAGE_PLACEHOLDER,
  withShopifyImageWidth,
} from '../lib/storefront-data';
import { useStorefront } from './StorefrontShell';

export function ProductCard({
  product,
  customBadge,
  priority = false,
}: {
  product: JewelleryProductSpec;
  customBadge?: string;
  priority?: boolean;
}) {
  const router = useRouter();
  const { addToCart, wishlistHandles, toggleWishlist } = useStorefront();
  const isWished = wishlistHandles.includes(product.handle);

  const rawMainImg = resolveProductImageUrl(product.imageUrl, API_ORIGIN) || PRODUCT_IMAGE_PLACEHOLDER;
  const rawAltImg = resolveProductImageUrl(product.altImageUrl, API_ORIGIN);
  const mainImg = withShopifyImageWidth(rawMainImg, 1200);
  const mainSrcSet = buildShopifyImageSrcSet(rawMainImg);
  const altImg = rawAltImg ? withShopifyImageWidth(rawAltImg, 1200) : '';
  const altSrcSet = rawAltImg ? buildShopifyImageSrcSet(rawAltImg) : undefined;
  const cardSizes = '(min-width: 1200px) 320px, (min-width: 750px) 33vw, 50vw';
  const isPriceOnRequest = Boolean(product.priceOnRequest || product.priceBreakup?.priceOnRequest);
  const displayPrice = formatProductPrice(product);
  const effectiveNumericPrice = Number(
    product.priceBreakup?.finalProposedPriceInr ||
      product.effectivePriceInr ||
      product.currentShopifyPriceInr
  );
  const hasCompare =
    !isPriceOnRequest &&
    product.compareAtPriceInr &&
    Number(product.compareAtPriceInr) > effectiveNumericPrice;

  return (
    <div className="pc-card">
      <Link href={`/products/${product.handle}`} className="pc-card__media">
        <img
          src={mainImg}
          srcSet={mainSrcSet}
          sizes={mainSrcSet ? cardSizes : undefined}
          alt={product.title}
          className={`pc-card__img pc-card__img--main ${altImg ? 'pc-has-alt' : ''}`}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
        />
        {altImg && (
          <img
            src={altImg}
            srcSet={altSrcSet}
            sizes={altSrcSet ? cardSizes : undefined}
            alt=""
            aria-hidden="true"
            className="pc-card__img pc-card__img--alt"
            loading="lazy"
            decoding="async"
          />
        )}
        {(customBadge || product.isFeaturedBestseller) && (
          <div className="pc-card__badges">
            <span className="pc-badge">{customBadge || 'BEST SELLER'}</span>
          </div>
        )}
      </Link>

      <div className="pc-card__info">
        <Link href={`/products/${product.handle}`} className="pc-card__title">
          {product.title}
        </Link>

        <div className="pc-card__meta">
          <div className="pc-card__price">
            <span className="pc-price">{displayPrice}</span>
            {hasCompare && (
              <s className="pc-price pc-price--compare">
                {formatInr(product.compareAtPriceInr)}
              </s>
            )}
          </div>

          <div className="pc-card__actions">
            {!isPriceOnRequest && (
              <button
                type="button"
                className="pc-icon-btn"
                onClick={() => addToCart(product)}
                aria-label="Add to cart"
                title="Add to Bag"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2.6 4.9h2.1l1.4 9.6a1.6 1.6 0 0 0 1.6 1.4h8.9a1.6 1.6 0 0 0 1.6-1.3l1.2-6.5H6.1" />
                  <circle cx="9.3" cy="19.3" r="1.5" />
                  <circle cx="17.3" cy="19.3" r="1.5" />
                  <path d="M9.7 11.2h6.4" />
                </svg>
              </button>
            )}

            <button
              type="button"
              className={`pc-icon-btn pc-wish ${isWished ? 'is-active' : ''}`}
              onClick={() => toggleWishlist(product.handle)}
              aria-pressed={isWished}
              aria-label="Add to wishlist"
              title="Save to Wishlist"
            >
              <svg viewBox="0 0 24 24">
                <path
                  className="pc-heart-line"
                  d="M12 20.6 4.3 13a4.7 4.7 0 0 1 0-6.7 4.7 4.7 0 0 1 6.7 0l1 1 1-1a4.7 4.7 0 0 1 6.7 0 4.7 4.7 0 0 1 0 6.7Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
                <path
                  className="pc-heart-fill"
                  d="M12 20.6 4.3 13a4.7 4.7 0 0 1 0-6.7 4.7 4.7 0 0 1 6.7 0l1 1 1-1a4.7 4.7 0 0 1 6.7 0 4.7 4.7 0 0 1 0 6.7Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>

        <button
          type="button"
          className="pc-buy"
          onClick={() => {
            if (isPriceOnRequest) {
              router.push(`/products/${product.handle}`);
              return;
            }
            addToCart(product, { openDrawer: false });
            router.push('/checkout');
          }}
        >
          {isPriceOnRequest ? 'Price on Request — Inquire' : 'Buy Now'}
        </button>
      </div>
    </div>
  );
}

