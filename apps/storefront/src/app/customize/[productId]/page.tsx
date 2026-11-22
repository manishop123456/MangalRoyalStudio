'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  resolveProductImageUrl,
  type CustomizationProfileRecord,
  type CustomizationQuoteResponse,
  type ProductCustomizationAssignmentRecord,
  type ProductModelAssetRecord,
} from '@mrs/shared';
import {
  API_BASE_URL,
  API_ORIGIN,
  formatProductPrice,
  storefrontFetch,
} from '../../../lib/storefront-data';
import { useStorefront } from '../../../components/StorefrontShell';
import ProductCustomizer from '../../../components/ProductCustomizer';
import { CustomerFacingError, friendlyApiError, friendlyThrown } from '../../../lib/customer-messages';

const Product3DViewer = dynamic(
  () => import('../../../components/Product3DViewer'),
  { ssr: false }
);

function CustomizeProductContent() {
  const params = useParams<{ productId: string }>();
  const searchParams = useSearchParams();
  const designIdParam = searchParams.get('designId');
  const rawId = decodeURIComponent(String(params?.productId || '')).toLowerCase();

  const { products, productsLoading, addToCart, customer } = useStorefront();

  const product = useMemo(
    () =>
      products.find(
        (p) =>
          p.id?.toLowerCase() === rawId ||
          p.sku.toLowerCase() === rawId ||
          p.handle.toLowerCase() === rawId
      ) || null,
    [products, rawId]
  );

  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [customConfig, setCustomConfig] = useState<{
    eligible: boolean;
    profile: CustomizationProfileRecord | null;
    assignment: ProductCustomizationAssignmentRecord | null;
    modelAsset: ProductModelAssetRecord | null;
  } | null>(null);
  const [prefillDesign, setPrefillDesign] = useState<{
    id: string;
    name: string;
    selections: Record<string, string>;
  } | null>(null);
  const [activeMetalSwatchHex, setActiveMetalSwatchHex] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!product) {
      setConfigLoading(false);
      return;
    }
    let cancelled = false;
    setConfigLoading(true);
    setConfigError('');
    fetch(`${API_BASE_URL}/public/products/${encodeURIComponent(product.sku)}/customization`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new CustomerFacingError(friendlyApiError(res.status, data, 'Unable to load customization options.'));
        if (!cancelled) {
          setCustomConfig({
            eligible: Boolean(data.eligible),
            profile: data.profile ?? null,
            assignment: data.assignment ?? null,
            modelAsset: data.modelAsset ?? null,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setConfigError(friendlyThrown(err, 'Unable to load customization options.'));
        }
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [product]);

  useEffect(() => {
    if (!designIdParam || !customer) return;
    let cancelled = false;
    storefrontFetch(`${API_BASE_URL}/customer/designs/${encodeURIComponent(designIdParam)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.design) {
          setPrefillDesign({
            id: data.design.id,
            name: data.design.name,
            selections: data.design.selections || {},
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [designIdParam, customer]);

  if (productsLoading && !product) {
    return (
      <div className="mrs-section-pad" style={{ textAlign: 'center', padding: '72px 20px' }}>
        Loading bespoke studio...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mrs-section-pad" style={{ textAlign: 'center', padding: '72px 20px' }}>
        <h1 className="mrs-section-heading-serif" style={{ marginBottom: '12px' }}>
          Creation Not Found
        </h1>
        <p style={{ color: '#6B5B5B', marginBottom: '24px' }}>
          We could not locate a jewellery piece matching &ldquo;{rawId}&rdquo;.
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
    );
  }

  return (
    <div className="mrs-section-pad">
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#6B5B5B' }}>
        <Link href="/">Home</Link> /{' '}
        <Link href={`/products/${product.handle}`}>{product.title}</Link> /{' '}
        <span style={{ color: '#190303' }}>Bespoke Customizer</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: '36px',
          alignItems: 'start',
        }}
      >
        {/* LEFT: 3D VIEWER OR STUDIO IMAGE */}
        <div>
          {customConfig?.modelAsset ? (
            <Product3DViewer
              modelUrl={
                customConfig.modelAsset.assetUrl.startsWith('http')
                  ? customConfig.modelAsset.assetUrl
                  : `${API_BASE_URL.replace(/\/api(\/v1)?$/, '')}${customConfig.modelAsset.assetUrl}`
              }
              format={customConfig.modelAsset.mimeType === 'model/gltf+json' ? 'GLTF' : 'GLB'}
              posterImageUrl={resolveProductImageUrl(customConfig.modelAsset.previewImageUrl || product.imageUrl, API_ORIGIN)}
              productTitle={product.title}
              metalTintHex={activeMetalSwatchHex}
            />
          ) : (
            <div style={{ background: '#F6F3F1', border: '1px solid #E6E0DE', aspectRatio: '1 / 1', overflow: 'hidden' }}>
              <img
                src={resolveProductImageUrl(product.imageUrl, API_ORIGIN)}
                alt={product.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}

          <div style={{ marginTop: '16px', padding: '16px', background: '#FAF6F2', border: '1px solid #E6E0DE' }}>
            <div style={{ fontSize: '12px', color: '#7D132A', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              {product.sku} • {product.category}
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', margin: '6px 0' }}>
              {product.title}
            </h1>
            <p style={{ fontSize: '13.5px', color: '#3E3E3E', margin: 0 }}>
              Base reference price: <strong>{formatProductPrice(product)}</strong> • Your bespoke price is
              confirmed once you choose your options.
            </p>
          </div>
        </div>

        {/* RIGHT: CUSTOMIZER */}
        <div>
          {configLoading ? (
            <div style={{ padding: '40px', background: '#FAF6F2', border: '1px solid #E6E0DE', textAlign: 'center' }}>
              Loading customization options...
            </div>
          ) : configError ? (
            <div style={{ padding: '24px', background: '#FDECEC', border: '1px solid #F5C2C7', color: '#A61B2B' }}>
              {configError}
            </div>
          ) : !customConfig?.eligible || !customConfig.profile ? (
            <div style={{ padding: '32px', background: '#FAF6F2', border: '1px solid #E6E0DE' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', marginBottom: '8px' }}>
                Standard Signature Specification
              </h2>
              <p style={{ fontSize: '14px', color: '#3E3E3E', marginBottom: '18px' }}>
                This piece is crafted strictly to its archival specification and is not configured for online option overrides.
              </p>
              <Link
                href={`/products/${product.handle}`}
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: '#7D132A',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}
              >
                View Product Details
              </Link>
            </div>
          ) : (
            <ProductCustomizer
              sku={product.sku}
              productTitle={product.title}
              productCategory={product.category}
              profile={customConfig.profile}
              assignment={customConfig.assignment}
              initialSelections={prefillDesign?.selections}
              editingDesignId={prefillDesign?.id}
              editingDesignName={prefillDesign?.name}
              isCustomerLoggedIn={Boolean(customer)}
              priceAvailable={!(product.priceOnRequest ?? product.priceBreakup?.priceOnRequest ?? true)}
              onSelectionsChange={(_sel, swatch) => setActiveMetalSwatchHex(swatch)}
              onAddCustomToCart={async ({ selections, quote, customerDesignId }) => {
                addToCart(product, {
                  quantity: 1,
                  unitPriceInr: Number(quote.unitPriceInr),
                  selections,
                  selectionSnapshot: quote.selectionSnapshot,
                  breakdownLines: quote.breakdownLines,
                  customerDesignId,
                  openDrawer: true,
                });
              }}
              onSaveDesign={async ({ name, selections, designId }) => {
                const url = designId
                  ? `${API_BASE_URL}/customer/designs/${encodeURIComponent(designId)}`
                  : `${API_BASE_URL}/customer/designs`;
                const res = await storefrontFetch(url, {
                  method: designId ? 'PUT' : 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name,
                    productSku: product.sku,
                    selections,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new CustomerFacingError(friendlyApiError(res.status, data, 'Unable to save design.'));
                return { id: data.design.id, name: data.design.name };
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomizeProductPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center' }}>Loading customizer...</div>}>
      <CustomizeProductContent />
    </Suspense>
  );
}
