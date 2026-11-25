import {
  resolveProductImageUrl,
  type DiamondRateMatrixEntry,
  type JewelleryProductSpec,
  type MetalPurity,
  type MetalRateRecord,
  type PriceCalculationBreakdown,
  type PricingFormulaRule,
} from '@mrs/shared';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000/api/v1';

export const API_ORIGIN = API_BASE_URL.replace(/\/api(\/v1)?\/?$/, '');

/**
 * Customer sessions live in an HttpOnly cookie that scripts cannot read. The API also returns a
 * session-bound CSRF token (login / verify-email / "me"), which is kept in memory only and sent
 * on every request so cookie-authenticated mutations are accepted.
 */
let storefrontCsrfToken: string | null = null;

export function setStorefrontCsrfToken(token: string | null): void {
  storefrontCsrfToken = token;
}

export function storefrontFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (storefrontCsrfToken) headers.set('x-csrf-token', storefrontCsrfToken);
  return fetch(input, { ...init, headers, credentials: 'include' });
}

export const CDN_BASE = 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/';

export function isShopifyCdnUrl(url: string): boolean {
  return /^https?:\/\/[^/]+\/cdn\/shop\//i.test(url);
}

export function withShopifyImageWidth(url: string, width: number): string {
  if (!url || !isShopifyCdnUrl(url)) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('width', String(width));
    return parsed.toString();
  } catch {
    return url;
  }
}

export function buildShopifyImageSrcSet(
  url: string,
  widths: readonly number[] = [400, 800, 1200, 1600, 2000]
): string | undefined {
  if (!url || !isShopifyCdnUrl(url)) return undefined;
  return widths.map((w) => `${withShopifyImageWidth(url, w)} ${w}w`).join(', ');
}

/** Neutral "image coming soon" artwork — never another SKU's photograph. */
export const PRODUCT_IMAGE_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="#F7F1EE"/><circle cx="400" cy="350" r="90" fill="none" stroke="#C9A9A6" stroke-width="10"/><path d="M345 300l55-45 55 45-55 95z" fill="none" stroke="#C9A9A6" stroke-width="8" stroke-linejoin="round"/><text x="400" y="520" font-family="Georgia,serif" font-size="34" fill="#7D132A" text-anchor="middle">Image coming soon</text><text x="400" y="565" font-family="Arial,sans-serif" font-size="22" fill="#6B5B5B" text-anchor="middle">Contact the studio for photographs</text></svg>'
  );

export const THEME_IMAGES = {
  headerLogo: `${CDN_BASE}Group_1000004348.png`,
  footerLogo: `${CDN_BASE}6b6217cf80a12befaeed66e6688a7640fc7d7c82.png`,
  heroSlide1: `${CDN_BASE}2cad1ff177013aa3114de81b745559fa80ff958a.jpg`,
  shapeRound: `${CDN_BASE}0d3cd5b42c34340dd612c78835ea1c2d3b0adb38.png`,
  catRings: `${CDN_BASE}a79933e475b1160a9334828e0d30c003bc131737.png`,
  catBracelets: `${CDN_BASE}6158221b28f34134f5119c8a750d12eceab5003b.png`,
  catEarrings: `${CDN_BASE}cfbaaa5e00a2471def9df241953eeac01f492955_1.png`,
  catBangles: `${CDN_BASE}1ae87b39ce7745cdb5ca5d5fb547519fe3fa790c.png`,
  catPendants: `${CDN_BASE}9e0729be479b73cbaecfabb3e8368e2f323323d5.png`,
  catNecklaces: `${CDN_BASE}348b73957dedca68bba67b33bc0a9766b5914cd3.jpg`,
  catAntique: `${CDN_BASE}cfbaaa5e00a2471def9df241953eeac01f492955.png`,
  brandStoryTop: `${CDN_BASE}bcc9181711e9062c42a1984945aa96643c4c1ac8.jpg`,
  brandStoryLeft: `${CDN_BASE}5df927a04b18c2c4c8210a32cb3a14c09e7dc4f3.jpg`,
  brandStoryRight: `${CDN_BASE}ecc2833a188c54ecfc769f015891cdb3ae75bd69.jpg`,
  priceUnder15k: `${CDN_BASE}c28d5704abb507036c26701c54ae84ffc8656ea8_1.jpg`,
  price15kTo25k: `${CDN_BASE}4ad63d14eaf4ccb8ad69310f2c516f5a96f1f8c1_1.jpg`,
  price25kTo50k: `${CDN_BASE}832f60664a5381eb7addb5fef2ce71e8ae897c6f_1.jpg`,
  priceAbove50k: `${CDN_BASE}c04cabaf26db3873ddde6bde243cde7572ddeea8_1.jpg`,
  quoteBanner: `${CDN_BASE}59205e0bf94ef6a4257d713defef8fe89d9fe5b8.png`,
  whyLabGrown: `${CDN_BASE}32830c2dc27609f18b884bc5ab307d57f0f8f900.png`,
};

export const CATEGORY_TILE_SKU_BY_HANDLE: Record<string, string> = {
  'best-sellers': 'SKUDRG00018',
  rings: 'SKUDRG00038',
  earrings: 'SKUDTG00022',
  pendants: 'SKUDTG00149',
  necklaces: 'SKUDNG00003',
  bracelets: 'SKUBRG00271',
  bangles: 'SKUBGG00002',
  antique: 'SKURIGO0909',
};

export function resolveCategoryTileImage(
  handle: string,
  products: readonly JewelleryProductSpec[],
  fallbackUrl: string
): string {
  const targetSku = CATEGORY_TILE_SKU_BY_HANDLE[handle];
  if (!targetSku) return fallbackUrl;
  const match = products.find((p) => p.sku === targetSku);
  if (match?.imageUrl) {
    return resolveProductImageUrl(match.imageUrl, API_ORIGIN) || PRODUCT_IMAGE_PLACEHOLDER;
  }
  return PRODUCT_IMAGE_PLACEHOLDER;
}

export const DEFAULT_METAL_RATES: MetalRateRecord[] = [
  {
    id: 'mr-24k',
    metalType: 'GOLD',
    purity: '24K',
    ratePerGramInr: '7650.00',
    currency: 'INR',
    source: 'MRS Vault Bullion Rate',
    isPlaceholder: false,
    effectiveAt: '2026-11-05T10:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'mr-22k',
    metalType: 'GOLD',
    purity: '22K',
    ratePerGramInr: '7015.00',
    currency: 'INR',
    source: 'MRS Vault Bullion Rate',
    isPlaceholder: false,
    effectiveAt: '2026-11-05T10:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'mr-18k',
    metalType: 'GOLD',
    purity: '18K',
    ratePerGramInr: '5740.00',
    currency: 'INR',
    source: 'MRS Vault Bullion Rate',
    isPlaceholder: false,
    effectiveAt: '2026-11-05T10:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'mr-14k',
    metalType: 'GOLD',
    purity: '14K',
    ratePerGramInr: '4475.00',
    currency: 'INR',
    source: 'MRS Vault Bullion Rate',
    isPlaceholder: false,
    effectiveAt: '2026-11-05T10:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'mr-plat-950',
    metalType: 'PLATINUM',
    purity: '950_PLATINUM',
    ratePerGramInr: '3450.00',
    currency: 'INR',
    source: 'MRS Vault Bullion Rate',
    isPlaceholder: false,
    effectiveAt: '2026-11-05T10:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
];

export const DEFAULT_DIAMOND_RATES: DiamondRateMatrixEntry[] = [
  {
    id: 'dr-melee',
    shape: 'ANY',
    sieveRange: 'Melee (0.001 - 0.08 ct)',
    sizeMinCarat: '0.001',
    sizeMaxCarat: '0.080',
    colorGrade: 'EF',
    clarityGrade: 'VVS',
    cutGrade: 'EXCELLENT',
    pricingType: 'PER_CARAT',
    rateInr: '16500.00',
    currency: 'INR',
    version: 1,
    isPlaceholder: false,
    isActive: true,
    effectiveAt: '2026-11-05T10:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'dr-pointers',
    shape: 'ANY',
    sieveRange: 'Pointers (0.081 - 0.49 ct)',
    sizeMinCarat: '0.081',
    sizeMaxCarat: '0.499',
    colorGrade: 'EF',
    clarityGrade: 'VVS',
    cutGrade: 'EXCELLENT',
    pricingType: 'PER_CARAT',
    rateInr: '19500.00',
    currency: 'INR',
    version: 1,
    isPlaceholder: false,
    isActive: true,
    effectiveAt: '2026-11-05T10:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'dr-solitaire',
    shape: 'ANY',
    sieveRange: 'Solitaire (0.50 - 5.00 ct)',
    sizeMinCarat: '0.500',
    sizeMaxCarat: '5.000',
    colorGrade: 'EF',
    clarityGrade: 'VVS',
    cutGrade: 'EXCELLENT',
    pricingType: 'PER_CARAT',
    rateInr: '24500.00',
    currency: 'INR',
    version: 1,
    isPlaceholder: false,
    isActive: true,
    effectiveAt: '2026-11-05T10:00:00.000Z',
    createdBy: 'owner@mangalroyalstudio.com',
    createdAt: '2026-11-05T10:00:00.000Z',
  },
];

export const DEFAULT_PRICING_RULE: PricingFormulaRule = {
  id: 'rule-v1',
  version: 1,
  name: 'MRS Standard Lab-Grown Jewellery Formula v1',
  description: 'Payable Metal + Lab-Grown Diamond Matrix + Making Charges + Cert/Hallmark + 3.00% GST',
  status: 'APPROVED',
  isPlaceholderFormula: false,
  stoneWeightToGramsFactor: '0.2000',
  gstRatePercent: '3.00',
  gstMode: 'INCLUSIVE',
  roundingMode: 'NEAREST_1',
  maxPriceDeltaPercentThreshold: '15.00',
  defaultCertificationFeeInr: '500.00',
  defaultHallmarkFeeInr: '100.00',
  approvedBy: 'owner@mangalroyalstudio.com',
  approvedAt: '2026-11-05T10:00:00.000Z',
  createdAt: '2026-11-05T10:00:00.000Z',
};

export const STOREFRONT_PRODUCTS: JewelleryProductSpec[] = [
  {
    id: 'prod-mrs-001',
    sku: 'MRS-RNG-1001',
    handle: 'royal-celeste-solitaire-ring',
    title: 'Royal Celeste 1.50 ct IGI Lab-Grown Solitaire Ring',
    description:
      'Handcrafted in 18K BIS-hallmarked gold, the Royal Celeste ring showcases a 1.50 ct IGI-certified EF-VVS lab-grown solitaire embraced by a delicate 16-stone hidden halo.',
    category: 'Rings',
    shopifyProductGid: 'gid://shopify/Product/801001',
    shopifyVariantGid: 'gid://shopify/ProductVariant/901001',
    currentShopifyPriceInr: '68500.00',
    compareAtPriceInr: '74900.00',
    metalType: 'GOLD',
    metalPurity: '18K',
    metalColor: 'ROSE_GOLD',
    ringSize: '12',
    grossWeightGrams: '4.150',
    netMetalWeightGrams: '3.800',
    netWeightMode: 'EXPLICIT_NET_WEIGHT',
    diamondComponents: [
      {
        componentName: 'Center Round Solitaire',
        shape: 'ROUND',
        stoneCount: 1,
        totalCaratWeight: '1.500',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
        cutGrade: 'EXCELLENT',
        certification: 'IGI',
      },
      {
        componentName: 'Hidden Halo Melee',
        shape: 'ROUND',
        stoneCount: 16,
        totalCaratWeight: '0.250',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
      },
    ],
    makingChargeMode: 'PER_GRAM_NET',
    makingChargeValue: '1250.00',
    wastageMode: 'NONE',
    wastageValue: '0',
    certificationFeeInr: '750.00',
    hallmarkFeeInr: '100.00',
    fixedAdjustmentInr: '0',
    manualPriceOverrideInr: null,
    pricingEnabled: true,
    inventoryQuantity: 6,
    isFeaturedBestseller: true,
    imageUrl: THEME_IMAGES.catRings,
    altImageUrl: THEME_IMAGES.shapeRound,
    galleryImages: [
      THEME_IMAGES.catRings,
      THEME_IMAGES.shapeRound,
      THEME_IMAGES.priceAbove50k,
      THEME_IMAGES.brandStoryLeft,
    ],
    updatedAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'prod-mrs-003',
    sku: 'MRS-EAR-2001',
    handle: 'lumiere-solitaire-diamond-studs',
    title: 'Lumière 1.00 ct tw Classic Solitaire Diamond Studs',
    description:
      'Timeless four-prong Martini solitaire diamond studs featuring matched IGI-certified EF-VVS lab-grown round brilliant diamonds totaling 1.00 carat.',
    category: 'Earrings',
    shopifyProductGid: 'gid://shopify/Product/802001',
    shopifyVariantGid: 'gid://shopify/ProductVariant/902001',
    currentShopifyPriceInr: '34500.00',
    compareAtPriceInr: '38900.00',
    metalType: 'GOLD',
    metalPurity: '18K',
    metalColor: 'YELLOW_GOLD',
    grossWeightGrams: '2.300',
    netMetalWeightGrams: '2.100',
    netWeightMode: 'EXPLICIT_NET_WEIGHT',
    diamondComponents: [
      {
        componentName: 'Matched Solitaire Pair',
        shape: 'ROUND',
        stoneCount: 2,
        totalCaratWeight: '1.000',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
        certification: 'IGI',
      },
    ],
    makingChargeMode: 'PER_GRAM_NET',
    makingChargeValue: '1100.00',
    wastageMode: 'NONE',
    wastageValue: '0',
    certificationFeeInr: '500.00',
    hallmarkFeeInr: '100.00',
    fixedAdjustmentInr: '0',
    manualPriceOverrideInr: null,
    pricingEnabled: true,
    inventoryQuantity: 9,
    isFeaturedBestseller: true,
    imageUrl: THEME_IMAGES.catEarrings,
    altImageUrl: THEME_IMAGES.price15kTo25k,
    galleryImages: [
      THEME_IMAGES.catEarrings,
      THEME_IMAGES.price15kTo25k,
      THEME_IMAGES.brandStoryTop,
      THEME_IMAGES.catPendants,
    ],
    updatedAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'prod-mrs-005',
    sku: 'MRS-PND-4001',
    handle: 'aria-pear-drop-diamond-pendant',
    title: 'Aria Pear-Drop Daily Diamond Pendant',
    description:
      'An effortless everyday luxury piece crafted in 14K rose gold with a pear-shaped lab-grown diamond center surrounded by a luminous micro-pavé halo.',
    category: 'Pendants',
    shopifyProductGid: 'gid://shopify/Product/804001',
    shopifyVariantGid: 'gid://shopify/ProductVariant/904001',
    currentShopifyPriceInr: '14800.00',
    compareAtPriceInr: '16500.00',
    metalType: 'GOLD',
    metalPurity: '14K',
    metalColor: 'ROSE_GOLD',
    grossWeightGrams: '1.680',
    netMetalWeightGrams: '1.600',
    netWeightMode: 'EXPLICIT_NET_WEIGHT',
    diamondComponents: [
      {
        componentName: 'Pear Center & Halo',
        shape: 'PEAR',
        stoneCount: 9,
        totalCaratWeight: '0.320',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
      },
    ],
    makingChargeMode: 'FLAT_PER_PIECE',
    makingChargeValue: '1800.00',
    wastageMode: 'NONE',
    wastageValue: '0',
    certificationFeeInr: '350.00',
    hallmarkFeeInr: '100.00',
    fixedAdjustmentInr: '0',
    manualPriceOverrideInr: null,
    pricingEnabled: true,
    inventoryQuantity: 14,
    isFeaturedBestseller: true,
    imageUrl: THEME_IMAGES.catPendants,
    altImageUrl: THEME_IMAGES.priceUnder15k,
    galleryImages: [
      THEME_IMAGES.catPendants,
      THEME_IMAGES.priceUnder15k,
      THEME_IMAGES.catNecklaces,
      THEME_IMAGES.brandStoryRight,
    ],
    updatedAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'prod-mrs-004',
    sku: 'MRS-BRC-3001',
    handle: 'eternity-riviera-tennis-bracelet',
    title: 'Eternity Riviera 4.00 ct Lab-Grown Tennis Bracelet',
    description:
      'Fifty-two hand-selected EF-VVS round brilliant lab-grown diamonds set seamlessly in an articulated 18K rose gold Riviera gallery with double safety clasp.',
    category: 'Bracelets',
    shopifyProductGid: 'gid://shopify/Product/803001',
    shopifyVariantGid: 'gid://shopify/ProductVariant/903001',
    currentShopifyPriceInr: '142000.00',
    compareAtPriceInr: '158000.00',
    metalType: 'GOLD',
    metalPurity: '18K',
    metalColor: 'ROSE_GOLD',
    grossWeightGrams: '11.200',
    netMetalWeightGrams: '10.400',
    netWeightMode: 'EXPLICIT_NET_WEIGHT',
    diamondComponents: [
      {
        componentName: 'Graduated Round Tennis Line',
        shape: 'ROUND',
        stoneCount: 52,
        totalCaratWeight: '4.000',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
        certification: 'IGI',
      },
    ],
    makingChargeMode: 'PER_GRAM_NET',
    makingChargeValue: '1350.00',
    wastageMode: 'NONE',
    wastageValue: '0',
    certificationFeeInr: '1000.00',
    hallmarkFeeInr: '100.00',
    fixedAdjustmentInr: '0',
    manualPriceOverrideInr: null,
    pricingEnabled: true,
    inventoryQuantity: 3,
    isFeaturedBestseller: true,
    imageUrl: THEME_IMAGES.catBracelets,
    altImageUrl: THEME_IMAGES.brandStoryRight,
    galleryImages: [
      THEME_IMAGES.catBracelets,
      THEME_IMAGES.brandStoryRight,
      THEME_IMAGES.catBangles,
      THEME_IMAGES.price25kTo50k,
    ],
    updatedAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'prod-mrs-002',
    sku: 'MRS-RNG-1002',
    handle: 'imperial-emerald-cut-halo-ring',
    title: 'Imperial Emerald-Cut Halo Engagement Ring',
    description:
      'Step-cut sophistication meets radiant brilliance in this 1.20 ct tw emerald-cut halo ring set in 18K white gold.',
    category: 'Rings',
    shopifyProductGid: 'gid://shopify/Product/801002',
    shopifyVariantGid: 'gid://shopify/ProductVariant/901002',
    currentShopifyPriceInr: '56900.00',
    compareAtPriceInr: '62000.00',
    metalType: 'GOLD',
    metalPurity: '18K',
    metalColor: 'WHITE_GOLD',
    ringSize: '14',
    grossWeightGrams: '3.840',
    netMetalWeightGrams: '3.600',
    netWeightMode: 'GROSS_MINUS_STONE_WEIGHT',
    diamondComponents: [
      {
        componentName: 'Center Emerald Cut',
        shape: 'EMERALD',
        stoneCount: 1,
        totalCaratWeight: '1.000',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
        certification: 'IGI',
      },
      {
        componentName: 'Halo & Shank Accents',
        shape: 'ROUND',
        stoneCount: 20,
        totalCaratWeight: '0.200',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
      },
    ],
    makingChargeMode: 'PER_GRAM_NET',
    makingChargeValue: '1200.00',
    wastageMode: 'NONE',
    wastageValue: '0',
    certificationFeeInr: '600.00',
    hallmarkFeeInr: '100.00',
    fixedAdjustmentInr: '0',
    manualPriceOverrideInr: null,
    pricingEnabled: true,
    inventoryQuantity: 4,
    imageUrl: THEME_IMAGES.priceAbove50k,
    altImageUrl: THEME_IMAGES.catRings,
    galleryImages: [THEME_IMAGES.priceAbove50k, THEME_IMAGES.catRings, THEME_IMAGES.shapeRound],
    updatedAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'prod-mrs-006',
    sku: 'MRS-BNG-5001',
    handle: 'maharani-heritage-diamond-kada-bangle',
    title: 'Maharani Heritage Lab-Grown Diamond Kada Bangle',
    description:
      'Inspired by royal Indian kadas since 1975, crafted in 18K yellow gold with 2.10 carats of flush and pavé-set IGI lab-grown diamonds.',
    category: 'Bangles',
    shopifyProductGid: 'gid://shopify/Product/805001',
    shopifyVariantGid: 'gid://shopify/ProductVariant/905001',
    currentShopifyPriceInr: '128500.00',
    compareAtPriceInr: '139000.00',
    metalType: 'GOLD',
    metalPurity: '18K',
    metalColor: 'YELLOW_GOLD',
    grossWeightGrams: '14.500',
    netMetalWeightGrams: '13.900',
    netWeightMode: 'EXPLICIT_NET_WEIGHT',
    diamondComponents: [
      {
        componentName: 'Flush & Pavé Set Diamonds',
        shape: 'ROUND',
        stoneCount: 44,
        totalCaratWeight: '2.100',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
      },
    ],
    makingChargeMode: 'PERCENTAGE_OF_METAL',
    makingChargeValue: '14.00',
    wastageMode: 'NONE',
    wastageValue: '0',
    certificationFeeInr: '800.00',
    hallmarkFeeInr: '100.00',
    fixedAdjustmentInr: '0',
    manualPriceOverrideInr: null,
    pricingEnabled: true,
    inventoryQuantity: 2,
    imageUrl: THEME_IMAGES.catBangles,
    altImageUrl: THEME_IMAGES.brandStoryTop,
    galleryImages: [THEME_IMAGES.catBangles, THEME_IMAGES.brandStoryTop, THEME_IMAGES.catBracelets],
    updatedAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'prod-mrs-007',
    sku: 'MRS-NCK-6001',
    handle: 'regal-cascade-bridal-diamond-necklace',
    title: 'Regal Cascade Bridal Lab-Grown Diamond Necklace',
    description:
      'A breathtaking bridal statement necklace featuring 96 pear and round lab-grown diamonds (5.80 ct tw) set in 18K white gold.',
    category: 'Necklaces',
    shopifyProductGid: 'gid://shopify/Product/806001',
    shopifyVariantGid: 'gid://shopify/ProductVariant/906001',
    currentShopifyPriceInr: '264000.00',
    compareAtPriceInr: '285000.00',
    metalType: 'GOLD',
    metalPurity: '18K',
    metalColor: 'WHITE_GOLD',
    grossWeightGrams: '26.400',
    netMetalWeightGrams: '24.800',
    netWeightMode: 'EXPLICIT_NET_WEIGHT',
    diamondComponents: [
      {
        componentName: 'Graduated Pear & Round Suite',
        shape: 'PEAR',
        stoneCount: 96,
        totalCaratWeight: '5.800',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
      },
    ],
    makingChargeMode: 'PER_GRAM_NET',
    makingChargeValue: '1400.00',
    wastageMode: 'NONE',
    wastageValue: '0',
    certificationFeeInr: '1500.00',
    hallmarkFeeInr: '100.00',
    fixedAdjustmentInr: '0',
    manualPriceOverrideInr: null,
    pricingEnabled: true,
    inventoryQuantity: 1,
    imageUrl: THEME_IMAGES.catNecklaces,
    altImageUrl: THEME_IMAGES.price25kTo50k,
    galleryImages: [THEME_IMAGES.catNecklaces, THEME_IMAGES.price25kTo50k, THEME_IMAGES.brandStoryLeft],
    updatedAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'prod-mrs-008',
    sku: 'MRS-ANT-7001',
    handle: '1975-founder-edition-heirloom-choker',
    title: '1975 Founder Edition Antique Polki & Diamond Choker',
    description:
      'Celebrating five decades of Mangal Royal Jewels Pvt Ltd (Since 1975), handcrafted in 22K gold with cushion and rose-cut IGI diamonds.',
    category: 'Antique',
    shopifyProductGid: 'gid://shopify/Product/807001',
    shopifyVariantGid: 'gid://shopify/ProductVariant/907001',
    currentShopifyPriceInr: '198000.00',
    compareAtPriceInr: '215000.00',
    metalType: 'GOLD',
    metalPurity: '22K',
    metalColor: 'YELLOW_GOLD',
    grossWeightGrams: '21.800',
    netMetalWeightGrams: '20.900',
    netWeightMode: 'EXPLICIT_NET_WEIGHT',
    diamondComponents: [
      {
        componentName: 'Rose-Cut & Cushion Diamonds',
        shape: 'CUSHION',
        stoneCount: 38,
        totalCaratWeight: '2.400',
        colorGrade: 'EF',
        clarityGrade: 'VVS',
      },
    ],
    makingChargeMode: 'PERCENTAGE_OF_METAL',
    makingChargeValue: '16.00',
    wastageMode: 'PERCENT_METAL_VALUE',
    wastageValue: '3.00',
    certificationFeeInr: '1200.00',
    hallmarkFeeInr: '100.00',
    fixedAdjustmentInr: '0',
    manualPriceOverrideInr: null,
    pricingEnabled: true,
    inventoryQuantity: 2,
    imageUrl: THEME_IMAGES.catAntique,
    altImageUrl: THEME_IMAGES.catBangles,
    galleryImages: [THEME_IMAGES.catAntique, THEME_IMAGES.catBangles, THEME_IMAGES.brandStoryTop],
    updatedAt: '2026-11-05T10:00:00.000Z',
  },
];

export function formatInr(value: string | number | undefined): string {
  const num = Number(value || 0);
  return `₹${Math.round(num).toLocaleString('en-IN')}`;
}

export function formatProductPrice(
  product: JewelleryProductSpec,
  breakup?: PriceCalculationBreakdown | null
): string {
  const isPor = Boolean(breakup?.priceOnRequest ?? product.priceOnRequest ?? product.priceBreakup?.priceOnRequest);
  if (isPor) {
    return 'Price on request';
  }
  const priceVal =
    breakup?.finalProposedPriceInr ??
    product.priceBreakup?.finalProposedPriceInr ??
    product.effectivePriceInr ??
    product.currentShopifyPriceInr;
  return formatInr(priceVal);
}

/**
 * Returns the AUTHORITATIVE server-computed breakdown for the selected purity.
 * The storefront never recalculates prices with local/copied rates: if the server did not supply a
 * breakdown for the requested purity, the result is "Price on request" (no fabricated amount).
 */
export function computeLiveProductBreakup(
  product: JewelleryProductSpec,
  overridePurity?: MetalPurity
): PriceCalculationBreakdown {
  const purity = overridePurity || product.metalPurity;
  const serverBreakup =
    product.purityBreakups?.[purity] ??
    (purity === product.metalPurity ? product.priceBreakup : undefined);
  if (serverBreakup) {
    return serverBreakup;
  }
  return priceOnRequestBreakdown(product, purity, 'SERVER_PRICE_UNAVAILABLE');
}

export function priceOnRequestBreakdown(
  product: JewelleryProductSpec,
  purity: MetalPurity,
  reason: string
): PriceCalculationBreakdown {
  return {
    sku: product.sku,
    formulaVersion: 0,
    isPlaceholderConfiguration: false,
    currency: 'INR',
    metalType: purity === '950_PLATINUM' ? 'PLATINUM' : product.metalType,
    metalPurity: purity,
    grossWeightGrams: product.grossWeightGrams,
    totalDiamondCarats: '0.000',
    stoneWeightInGrams: '0.000',
    computedNetMetalWeightGrams: product.netMetalWeightGrams,
    metalRatePerGramInr: '0.00',
    baseMetalValueInr: '0.00',
    wastageMode: 'NONE',
    wastageGrams: '0.000',
    wastageValueInr: '0.00',
    payableMetalValueInr: '0.00',
    diamondComponents: [],
    totalDiamondValueInr: '0.00',
    makingChargeMode: 'PER_GRAM_NET',
    makingChargeRateInput: '0.00',
    makingChargeValueInr: '0.00',
    certificationFeeInr: '0.00',
    hallmarkFeeInr: '0.00',
    fixedAdjustmentInr: '0.00',
    subtotalBeforeTaxInr: '0.00',
    gstRatePercent: '0.00',
    gstMode: 'INCLUSIVE',
    gstAmountInr: '0.00',
    unroundedTotalInr: '0.00',
    roundingMode: 'NEAREST_1',
    roundingAdjustmentInr: '0.00',
    calculatedPriceInr: '0.00',
    manualOverrideApplied: false,
    finalProposedPriceInr: '0.00',
    priceOnRequest: true,
    priceOnRequestReason: reason,
    displayPriceLabel: 'Price on request',
    priceSource: 'PRICE_ON_REQUEST',
    oldPriceInr: '0.00',
    priceDeltaInr: '0.00',
    priceDeltaPercent: '0.00',
    exceedsMaxDeltaThreshold: false,
    warnings: [],
    calculatedAt: new Date(0).toISOString(),
  };
}

