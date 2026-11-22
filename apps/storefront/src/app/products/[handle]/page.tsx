'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  resolveProductImageUrl,
  type CustomizationProfileRecord,
  type MetalPurity,
  type ProductCustomizationAssignmentRecord,
  type ProductModelAssetRecord,
} from '@mrs/shared';
import {
  API_BASE_URL,
  API_ORIGIN,
  computeLiveProductBreakup,
  formatInr,
  PRODUCT_IMAGE_PLACEHOLDER,
  storefrontFetch,
} from '../../../lib/storefront-data';
import {
  CustomerFacingError,
  friendlyApiError,
  PRICE_ON_REQUEST_LABEL,
  PRICE_ON_REQUEST_NOTE,
} from '../../../lib/customer-messages';
import { useStorefront } from '../../../components/StorefrontShell';
import { ProductCard } from '../../../components/ProductCard';
import ProductCustomizer from '../../../components/ProductCustomizer';

const Product3DViewer = dynamic(
  () => import('../../../components/Product3DViewer'),
  { ssr: false }
);

export default function ProductDetailPage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const designIdParam = searchParams.get('designId');
  const handle = String(params?.handle || '').toLowerCase();
  const { products, addToCart, wishlistHandles, toggleWishlist, customer } = useStorefront();

  const matchedProduct = useMemo(
    () =>
      products.find(
        (p) => p.handle.toLowerCase() === handle || p.sku.toLowerCase() === handle
      ) || null,
    [products, handle]
  );
  const product = matchedProduct || products[0];

  const [selectedPurity, setSelectedPurity] = useState<MetalPurity>(product?.metalPurity || '18K');
  const [selectedColor, setSelectedColor] = useState<string>(
    (product?.metalColor || 'YELLOW_GOLD').replace('_', ' ')
  );
  const [selectedRingSize, setSelectedRingSize] = useState<string>(product?.ringSize || '12');

  useEffect(() => {
    if (!matchedProduct) return;
    setSelectedPurity(matchedProduct.metalPurity);
    setSelectedColor(matchedProduct.metalColor.replace('_', ' '));
    setSelectedRingSize(matchedProduct.ringSize || '12');
  }, [matchedProduct]);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [isZoomOpen, setIsZoomOpen] = useState<boolean>(false);
  const [pincode, setPincode] = useState<string>('400050');
  const [pincodeMessage, setPincodeMessage] = useState<string>(
    'Insured BlueDart & Sequel Vault delivery available in 2–4 business days.'
  );
  const [mediaMode, setMediaMode] = useState<'GALLERY' | '3D'>('GALLERY');
  const [customConfig, setCustomConfig] = useState<{
    eligible: boolean;
    profile: CustomizationProfileRecord | null;
    assignment: ProductCustomizationAssignmentRecord | null;
    modelAsset: ProductModelAssetRecord | null;
  } | null>(null);
  const [customMode, setCustomMode] = useState<boolean>(Boolean(designIdParam));
  const [prefillDesign, setPrefillDesign] = useState<{
    id: string;
    name: string;
    selections: Record<string, string>;
  } | null>(null);
  const [activeMetalSwatchHex, setActiveMetalSwatchHex] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!product?.sku) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/public/products/${encodeURIComponent(product.sku)}/customization`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setCustomConfig({
            eligible: Boolean(data.eligible),
            profile: data.profile ?? null,
            assignment: data.assignment ?? null,
            modelAsset: data.modelAsset ?? null,
          });
          if (data.eligible && data.profile) {
            setCustomMode(true);
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [product?.sku]);

  useEffect(() => {
    if (!designIdParam || !customer) return;
    let cancelled = false;
    storefrontFetch(`${API_BASE_URL}/customer/designs/${encodeURIComponent(designIdParam)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.design) {
          setPrefillDesign({
            id: data.design.id,
            name: data.design.name,
            selections: data.design.selections || {},
          });
          setCustomMode(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [designIdParam, customer]);

  const gallery = useMemo(() => {
    if (!product) return [];
    if (product.galleryImages && product.galleryImages.length > 0) {
      return product.galleryImages.map((u) => resolveProductImageUrl(u, API_ORIGIN));
    }
    const fallbackImgs = [
      resolveProductImageUrl(product.imageUrl, API_ORIGIN),
      resolveProductImageUrl(product.altImageUrl, API_ORIGIN),
    ].filter(Boolean);
    return fallbackImgs.length > 0 ? fallbackImgs : [PRODUCT_IMAGE_PLACEHOLDER];
  }, [product]);

  const supportedPurities = useMemo<MetalPurity[]>(() => {
    if (!product) return [];
    if (product.variants && product.variants.length > 0) {
      return Array.from(new Set(product.variants.map((v) => v.metalPurity)));
    }
    return [product.metalPurity];
  }, [product]);

  const supportedColors = useMemo<string[]>(() => {
    if (!product) return [];
    if (product.variants && product.variants.length > 0) {
      return Array.from(new Set(product.variants.map((v) => v.metalColor.replace('_', ' '))));
    }
    return [product.metalColor.replace('_', ' ')];
  }, [product]);

  const breakup = useMemo(
    () => (product ? computeLiveProductBreakup(product, selectedPurity) : null),
    [product, selectedPurity]
  );

  const isPriceOnRequest = Boolean(breakup?.priceOnRequest);
  const effectivePrice =
    !product || !breakup || isPriceOnRequest
      ? 0
      : Number(breakup.finalProposedPriceInr || product.currentShopifyPriceInr);

  const isWished = product ? wishlistHandles.includes(product.handle) : false;
  const relatedProducts = product ? products.filter((p) => p.sku !== product.sku).slice(0, 4) : [];

  return !matchedProduct || !product || !breakup ? (
    <div className="mrs-section-pad" style={{ textAlign: 'center', padding: '72px 20px' }}>
      <h1 className="mrs-section-heading-serif" style={{ marginBottom: '12px' }}>
        Creation Not Found
      </h1>
      <p style={{ color: '#6B5B5B', marginBottom: '24px' }}>
        We could not locate a jewellery piece matching &ldquo;{handle}&rdquo;.
      </p>
      <Link
        href="/collections/all"
        style={{
          display: 'inline-block',
          padding: '12px 28px',
          background: '#7D132A',
          color: '#FFFFFF',
          fontSize: '12px',
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
        }}
      >
        Browse All Jewellery
      </Link>
    </div>
  ) : (
    <div>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px clamp(16px, 4vw, 36px) 64px' }}>
        <div style={{ fontSize: '12px', color: '#777070', marginBottom: '20px' }}>
          <Link href="/">Home</Link> /{' '}
          <Link href={`/collections/${product.category.toLowerCase()}`}>{product.category}</Link> /{' '}
          <span style={{ color: '#2D2021' }}>{product.title}</span>
        </div>

        {/* MAIN 55% / 45% SPLIT - RESPONSIVE (375px, 430px, 768px, 1440px) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
            gap: 'clamp(24px, 4vw, 48px)',
            alignItems: 'start',
          }}
        >
          {/* LEFT: GALLERY + OPTIONAL LAZY 3D VIEWER */}
          <div>
            {customConfig?.modelAsset ? (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => setMediaMode('GALLERY')}
                  style={{
                    padding: '7px 14px',
                    fontSize: '11px',
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    border: mediaMode === 'GALLERY' ? '1.5px solid #8E1230' : '1px solid #E6E0DE',
                    background: mediaMode === 'GALLERY' ? '#8E1230' : '#FFFFFF',
                    color: mediaMode === 'GALLERY' ? '#FFFFFF' : '#2D2021',
                    cursor: 'pointer',
                  }}
                >
                  Photo Gallery
                </button>
                <button
                  type="button"
                  onClick={() => setMediaMode('3D')}
                  style={{
                    padding: '7px 14px',
                    fontSize: '11px',
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    border: mediaMode === '3D' ? '1.5px solid #8E1230' : '1px solid #E6E0DE',
                    background: mediaMode === '3D' ? '#8E1230' : '#FFFFFF',
                    color: mediaMode === '3D' ? '#FFFFFF' : '#2D2021',
                    cursor: 'pointer',
                  }}
                >
                  Interactive 3D View
                </button>
              </div>
            ) : null}

            {mediaMode === '3D' && customConfig?.modelAsset ? (
              <Product3DViewer
                modelUrl={
                  customConfig.modelAsset.assetUrl.startsWith('http')
                    ? customConfig.modelAsset.assetUrl
                    : `${API_BASE_URL.replace(/\/api(\/v1)?$/, '')}${customConfig.modelAsset.assetUrl}`
                }
                format={customConfig.modelAsset.mimeType === 'model/gltf+json' ? 'GLTF' : 'GLB'}
                posterImageUrl={customConfig.modelAsset.previewImageUrl || product.imageUrl}
                productTitle={product.title}
                metalTintHex={activeMetalSwatchHex}
                onFallbackToGallery={() => setMediaMode('GALLERY')}
              />
            ) : (
              <>
                <div
                  onClick={() => setIsZoomOpen(true)}
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1 / 1.1',
                    background: '#F6F6F5',
                    cursor: 'zoom-in',
                    overflow: 'hidden',
                    marginBottom: '14px',
                  }}
                >
                  <img
                    src={gallery[activeImageIdx] || gallery[0]}
                    alt={product.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      background: 'rgba(255,255,255,0.9)',
                      padding: '6px 10px',
                      fontSize: '11px',
                      letterSpacing: '0.8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Click to Zoom ⊕
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {gallery.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      style={{
                        padding: 0,
                        border: activeImageIdx === idx ? '2px solid #8E1230' : '1px solid #E6E0DE',
                        background: '#F6F6F5',
                        aspectRatio: '1 / 1',
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={imgUrl}
                        alt={`${product.title} view ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* RIGHT: PRODUCT DETAILS, VARIANT SELECTORS & PRICE BREAKUP */}
          <div style={{ color: '#2D2021', fontFamily: 'var(--font-pdp-sans)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '11px',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                color: '#8E1230',
                marginBottom: '8px',
              }}
            >
              <span>SKU: {product.sku}</span>
              <span>•</span>
              <span>IGI Certified Lab-Grown Diamond</span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '34px',
                fontWeight: 600,
                lineHeight: 1.12,
                margin: '0 0 16px 0',
              }}
            >
              {product.title}
            </h1>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: '12px',
                paddingBottom: '18px',
                borderBottom: '1px solid #E6E0DE',
                marginBottom: '20px',
              }}
            >
              <span style={{ fontSize: '26px', fontWeight: 600, color: '#8E1230' }}>
                {isPriceOnRequest ? 'Price on request' : formatInr(effectivePrice)}
              </span>
              {!isPriceOnRequest &&
                product.compareAtPriceInr &&
                Number(product.compareAtPriceInr) > effectivePrice && (
                  <s style={{ fontSize: '15px', color: '#777070' }}>
                    {formatInr(product.compareAtPriceInr)}
                  </s>
                )}
              <span style={{ fontSize: '11px', color: '#777070' }}>
                {isPriceOnRequest
                  ? PRICE_ON_REQUEST_NOTE
                  : `(Inclusive of ${Number(breakup.gstRatePercent)}% GST)`}
              </span>
            </div>

            <p style={{ fontSize: '13px', lineHeight: 1.65, color: '#4A433E', marginBottom: '22px' }}>
              {product.description ||
                'Crafted in BIS-hallmarked gold with IGI-certified EF-VVS lab-grown diamonds by Mangal Royal Studio (Since 1975).'}
            </p>

            {customConfig?.eligible && customConfig.profile ? (
              <div style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setCustomMode(true)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '11px',
                      letterSpacing: '0.8px',
                      textTransform: 'uppercase',
                      border: customMode ? '1.5px solid #8E1230' : '1px solid #E6E0DE',
                      background: customMode ? '#8E1230' : '#FFFFFF',
                      color: customMode ? '#FFFFFF' : '#2D2021',
                      cursor: 'pointer',
                    }}
                  >
                    Bespoke Customizer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomMode(false)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '11px',
                      letterSpacing: '0.8px',
                      textTransform: 'uppercase',
                      border: !customMode ? '1.5px solid #8E1230' : '1px solid #E6E0DE',
                      background: !customMode ? '#8E1230' : '#FFFFFF',
                      color: !customMode ? '#FFFFFF' : '#2D2021',
                      cursor: 'pointer',
                    }}
                  >
                    Standard Ready-to-Ship
                  </button>
                </div>
              </div>
            ) : null}

            {customMode && customConfig?.eligible && customConfig.profile ? (
              <div style={{ marginBottom: '22px' }}>
                <ProductCustomizer
                  key={prefillDesign?.id || product.sku}
                  sku={product.sku}
                  productTitle={product.title}
                  productCategory={product.category}
                  profile={customConfig.profile}
                  assignment={customConfig.assignment}
                  initialSelections={prefillDesign?.selections}
                  editingDesignId={prefillDesign?.id ?? null}
                  editingDesignName={prefillDesign?.name ?? null}
                  isCustomerLoggedIn={Boolean(customer)}
                  priceAvailable={!isPriceOnRequest}
                  onSelectionsChange={(_sel, swatchHex) => setActiveMetalSwatchHex(swatchHex)}
                  onAddCustomToCart={async ({ selections, quote, customerDesignId }) => {
                    addToCart(product, {
                      metalPurity: quote.resolvedMetalPurity,
                      metalColor: quote.resolvedMetalColor,
                      ringSize: quote.resolvedRingSize || selectedRingSize,
                      unitPriceInr: Number(quote.unitPriceInr),
                      selections,
                      selectionSnapshot: quote.selectionSnapshot,
                      breakdownLines: quote.breakdownLines,
                      customerDesignId,
                    });
                  }}
                  onSaveDesign={async ({ name, selections, designId }) => {
                    const endpoint = designId
                      ? `${API_BASE_URL}/customer/designs/${encodeURIComponent(designId)}`
                      : `${API_BASE_URL}/customer/designs`;
                    const res = await storefrontFetch(endpoint, {
                      method: designId ? 'PATCH' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(
                        designId
                          ? { name, selections }
                          : { productHandleOrSku: product.sku, name, selections }
                      ),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      throw new CustomerFacingError(friendlyApiError(res.status, data, 'Unable to save design.'));
                    }
                    setPrefillDesign({
                      id: data.design.id,
                      name: data.design.name,
                      selections: data.design.selections,
                    });
                    return { id: data.design.id, name: data.design.name };
                  }}
                />
              </div>
            ) : null}

            {!(customMode && customConfig?.eligible && customConfig.profile) ? (
              <>

            {/* METAL PURITY SELECTOR */}
            <div style={{ marginBottom: '18px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Metal Purity: <span style={{ color: '#8E1230' }}>{selectedPurity}</span>
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {supportedPurities.map((purity) => (
                  <button
                    key={purity}
                    type="button"
                    onClick={() => setSelectedPurity(purity)}
                    style={{
                      padding: '8px 16px',
                      border:
                        selectedPurity === purity ? '1.5px solid #8E1230' : '1px solid #E6E0DE',
                      background: selectedPurity === purity ? '#FBE8DB' : '#FFFFFF',
                      color: '#2D2021',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {purity === '950_PLATINUM' ? 'Pt 950' : `${purity} Gold`}
                  </button>
                ))}
              </div>
            </div>

            {/* METAL COLOR SELECTOR */}
            <div style={{ marginBottom: '18px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Metal Finish: <span style={{ color: '#8E1230' }}>{selectedColor}</span>
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {supportedColors.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setSelectedColor(col)}
                    style={{
                      padding: '8px 16px',
                      border: selectedColor === col ? '1.5px solid #8E1230' : '1px solid #E6E0DE',
                      background: selectedColor === col ? '#FBE8DB' : '#FFFFFF',
                      color: '#2D2021',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>

            {/* RING SIZE SELECTOR */}
            {(product.category === 'Rings' || product.category === 'Solitaires') && (
              <div style={{ marginBottom: '22px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}
                >
                  Indian Ring Size: <span style={{ color: '#8E1230' }}>{selectedRingSize}</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['10', '11', '12', '13', '14', '15', '16', '17', '18'].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedRingSize(sz)}
                      style={{
                        width: '38px',
                        height: '36px',
                        border:
                          selectedRingSize === sz ? '1.5px solid #8E1230' : '1px solid #E6E0DE',
                        background: selectedRingSize === sz ? '#8E1230' : '#FFFFFF',
                        color: selectedRingSize === sz ? '#FFFFFF' : '#2D2021',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ADD TO CART / BUY NOW / WISHLIST */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '12px' }}>
              {isPriceOnRequest ? (
                <Link
                  href="/pages/contact"
                  style={{
                    padding: '15px 24px',
                    background: '#8E1230',
                    color: '#FFFFFF',
                    border: 0,
                    fontSize: '12px',
                    fontWeight: 500,
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}
                >
                  Price on Request — Book Consultation
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    addToCart(product, {
                      metalPurity: selectedPurity,
                      metalColor: selectedColor,
                      ringSize: selectedRingSize,
                      unitPriceInr: effectivePrice,
                    })
                  }
                  style={{
                    padding: '15px 24px',
                    background: '#8E1230',
                    color: '#FFFFFF',
                    border: 0,
                    fontSize: '12px',
                    fontWeight: 500,
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Add To Bag — {formatInr(effectivePrice)}
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleWishlist(product.handle)}
                style={{
                  padding: '0 18px',
                  border: '1px solid #8E1230',
                  background: isWished ? '#FBE8DB' : '#FFFFFF',
                  color: '#8E1230',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
                aria-label="Toggle Wishlist"
              >
                {isWished ? '♥' : '♡'}
              </button>
            </div>
              </>
            ) : null}

            {!isPriceOnRequest && (
              <button
                type="button"
                onClick={() => {
                  addToCart(product, {
                    metalPurity: selectedPurity,
                    metalColor: selectedColor,
                    ringSize: selectedRingSize,
                    unitPriceInr: effectivePrice,
                    openDrawer: false,
                  });
                  router.push('/checkout');
                }}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: '#FFFFFF',
                  color: '#8E1230',
                  border: '1px solid #8E1230',
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  marginBottom: '24px',
                }}
              >
                Buy It Now
              </button>
            )}

            {/* PINCODE SERVICEABILITY CHECKER */}
            <div
              style={{
                background: '#FAF7F4',
                border: '1px solid #E6E0DE',
                padding: '16px',
                marginBottom: '24px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                Check Insured Vault Delivery
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="Enter 6-digit PIN"
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    border: '1px solid #D5CBC8',
                    fontSize: '13px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (/^\d{6}$/.test(pincode)) {
                      setPincodeMessage(
                        `✓ PIN ${pincode} is serviceable via BlueDart Insured Jewellery Air (Estimated 2–4 Days).`
                      );
                    } else {
                      setPincodeMessage('Please enter a valid 6-digit Indian PIN code.');
                    }
                  }}
                  style={{
                    padding: '9px 18px',
                    background: '#2D2021',
                    color: '#FFFFFF',
                    border: 0,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Check
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#4A433E', marginTop: '8px' }}>
                {pincodeMessage}
              </div>
            </div>

            {/* LIVE TRANSPARENT JEWELLERY PRICE BREAKUP TABLE */}
            {isPriceOnRequest ? (
              <div style={{ border: '1px solid #E6E0DE', padding: '18px', background: '#FBF7F5' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  {PRICE_ON_REQUEST_LABEL}
                </h3>
                <p style={{ fontSize: '13px', color: '#5A4B4B', margin: '0 0 14px', lineHeight: 1.6 }}>
                  {PRICE_ON_REQUEST_NOTE} Our team will confirm the price, specifications and availability for you.
                </p>
                <Link href="/pages/contact" style={{ display: 'inline-block', padding: '10px 22px', background: '#7D132A', color: '#FFFFFF', fontSize: '12px', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
                  Contact the Studio
                </Link>
              </div>
            ) : (
            <div style={{ border: '1px solid #E6E0DE', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <h3
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '20px',
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  Transparent Jewellery Price Breakup
                </h3>
                <span style={{ fontSize: '11px', color: '#8E1230', fontWeight: 600 }}>
                  Today's gold & diamond rates
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #F2ECE9' }}>
                    <td style={{ padding: '8px 0', color: '#6B5B5B' }}>
                      Metal ({selectedPurity} • Net {breakup.computedNetMetalWeightGrams}g @ ₹
                      {breakup.metalRatePerGramInr}/g)
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>
                      {formatInr(breakup.payableMetalValueInr)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #F2ECE9' }}>
                    <td style={{ padding: '8px 0', color: '#6B5B5B' }}>
                      IGI Lab-Grown Diamonds ({breakup.totalDiamondCarats} ct tw EF-VVS)
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>
                      {formatInr(breakup.totalDiamondValueInr)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #F2ECE9' }}>
                    <td style={{ padding: '8px 0', color: '#6B5B5B' }}>
                      Artisan Making Charges
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>
                      {formatInr(breakup.makingChargeValueInr)}
                    </td>
                  </tr>
                  {Number(breakup.certificationFeeInr) + Number(breakup.hallmarkFeeInr) > 0 ? (
                  <tr style={{ borderBottom: '1px solid #F2ECE9' }}>
                    <td style={{ padding: '8px 0', color: '#6B5B5B' }}>
                      IGI Certification & BIS Hallmark Fee
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>
                      {formatInr(
                        Number(breakup.certificationFeeInr) + Number(breakup.hallmarkFeeInr)
                      )}
                    </td>
                  </tr>
                  ) : null}
                  <tr style={{ borderBottom: '1px solid #F2ECE9' }}>
                    <td style={{ padding: '8px 0', color: '#6B5B5B' }}>
                      GST ({Number(breakup.gstRatePercent)}%)
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>
                      {formatInr(breakup.gstAmountInr)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 0 0', fontWeight: 600 }}>Final Price (INR)</td>
                    <td
                      style={{
                        padding: '10px 0 0',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: '#8E1230',
                        fontSize: '16px',
                      }}
                    >
                      {formatInr(effectivePrice)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* LIGHTBOX ZOOM MODAL */}
      {isZoomOpen && (
        <div
          onClick={() => setIsZoomOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 95,
            backgroundColor: 'rgba(18, 4, 7, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={gallery[activeImageIdx] || gallery[0]}
            alt={product.title}
            style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* PHYSICAL STORE CTA (sections/mangal-physical-store-cta.liquid) */}
      <section
        style={{
          maxWidth: '1160px',
          margin: '0 auto 48px',
          backgroundColor: '#FBE8DB',
          border: '1px solid #E7D1C4',
          padding: '28px 38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div>
          <p
            style={{
              fontFamily: 'var(--font-script)',
              fontSize: '32px',
              color: '#8E1230',
              margin: '0 0 4px 0',
            }}
          >
            visit our store !
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '26px',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Loved it online? Experience it in person at our Mumbai Studio.
          </h2>
        </div>
        <Link
          href="/pages/contact"
          style={{
            padding: '13px 28px',
            background: '#8E1230',
            color: '#FFFFFF',
            fontSize: '11px',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
          }}
        >
          Get Store Location
        </Link>
      </section>

      {/* FOREVER PIECE CTA (sections/mangal-forever-cta.liquid) */}
      <section
        style={{
          backgroundColor: '#F8E1CF',
          padding: '56px 32px',
          textAlign: 'center',
        }}
      >
        <p className="mrs-section-eyebrow-script" style={{ fontSize: '48px' }}>
          Bespoke consultation
        </p>
        <h2 className="mrs-section-heading-serif" style={{ fontSize: '34px', marginBottom: '12px' }}>
          READY TO FIND YOUR FOREVER PIECE?
        </h2>
        <p style={{ maxWidth: '580px', margin: '0 auto 24px', fontSize: '14px', color: '#3E3E3E' }}>
          Speak with our IGI diamond gemologists for custom solitaire sizing, bespoke engraving, or private video viewing.
        </p>
        <Link
          href="/pages/contact"
          style={{
            display: 'inline-block',
            padding: '13px 32px',
            background: '#7D132A',
            color: '#FFFFFF',
            fontSize: '12px',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
          }}
        >
          Book A Consultation
        </Link>
      </section>

      {/* RELATED PRODUCTS (sections/mangal-related-products.liquid) */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '64px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <p className="mrs-section-eyebrow-script" style={{ fontSize: '46px' }}>
            Complete the suite
          </p>
          <h2 className="mrs-section-heading-serif" style={{ fontSize: '34px' }}>
            YOU MAY ALSO LOVE
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '32px',
          }}
        >
          {relatedProducts.map((rel) => (
            <ProductCard key={rel.sku} product={rel} />
          ))}
        </div>
      </section>
    </div>
  );
}

