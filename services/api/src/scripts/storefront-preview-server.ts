import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid, Tag, type Context, type Emitter, type TagToken, type Template, type TopLevelToken } from 'liquidjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THEME_ROOT = path.resolve(__dirname, '../../../../apps/shopify-theme');
const ASSETS_DIR = path.join(THEME_ROOT, 'assets');
const SECTIONS_DIR = path.join(THEME_ROOT, 'sections');
const SNIPPETS_DIR = path.join(THEME_ROOT, 'snippets');
const TEMPLATES_DIR = path.join(THEME_ROOT, 'templates');
const CONFIG_DIR = path.join(THEME_ROOT, 'config');
const LOCALES_DIR = path.join(THEME_ROOT, 'locales');

const SHOPIFY_CDN_FILES_BASE = 'https://i1dtfi-iv.myshopify.com/cdn/shop/files/';
const PORT = Number(process.env.STOREFRONT_PORT || 9292);

function stripJsonComments(raw: string): string {
  return raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '').trim();
}

function loadJsonFile<T = Record<string, unknown>>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(stripJsonComments(raw)) as T;
}

class ShopifyColorDrop {
  public readonly hex: string;
  public readonly red: number;
  public readonly green: number;
  public readonly blue: number;
  public readonly rgb: string;

  constructor(hex: string) {
    this.hex = hex;
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      const c0 = clean.charAt(0);
      const c1 = clean.charAt(1);
      const c2 = clean.charAt(2);
      this.red = parseInt(c0 + c0, 16) || 0;
      this.green = parseInt(c1 + c1, 16) || 0;
      this.blue = parseInt(c2 + c2, 16) || 0;
    } else if (clean.length >= 6) {
      this.red = parseInt(clean.slice(0, 2), 16) || 0;
      this.green = parseInt(clean.slice(2, 4), 16) || 0;
      this.blue = parseInt(clean.slice(4, 6), 16) || 0;
    } else {
      this.red = 18;
      this.green = 18;
      this.blue = 18;
    }
    this.rgb = `${this.red} ${this.green} ${this.blue}`;
  }

  toString(): string {
    return this.hex;
  }

  valueOf(): string {
    return this.hex;
  }

  toLiquid(): Record<string, unknown> {
    return {
      red: this.red,
      green: this.green,
      blue: this.blue,
      rgb: this.rgb,
      toString: () => this.hex,
    };
  }
}

export interface ShopifyImageDrop {
  src: string;
  url: string;
  width: number;
  height: number;
  aspect_ratio: number;
  alt: string;
  presentation: { focal_point: string };
  toString(): string;
}

function createImageDrop(srcOrShopifyUri: string, alt = 'Mangal Royal Studio Jewellery', width = 1200, height = 1200): ShopifyImageDrop {
  let resolvedUrl = srcOrShopifyUri;
  if (srcOrShopifyUri.startsWith('shopify://shop_images/')) {
    const fileName = srcOrShopifyUri.replace('shopify://shop_images/', '');
    resolvedUrl = `${SHOPIFY_CDN_FILES_BASE}${encodeURIComponent(fileName).replace(/%20/g, '%20')}`;
  } else if (srcOrShopifyUri.startsWith('//')) {
    resolvedUrl = `https:${srcOrShopifyUri}`;
  }
  const obj: ShopifyImageDrop = {
    src: resolvedUrl,
    url: resolvedUrl,
    width,
    height,
    aspect_ratio: Number((width / height).toFixed(4)),
    alt,
    presentation: { focal_point: '50.0% 50.0%' },
    toString() {
      return resolvedUrl;
    },
  };
  return obj;
}

function resolveImageUrl(input: unknown, width?: number): string {
  if (!input) return '';
  let baseUrl = '';
  if (typeof input === 'string') {
    if (input.startsWith('shopify://shop_images/')) {
      baseUrl = `${SHOPIFY_CDN_FILES_BASE}${input.replace('shopify://shop_images/', '')}`;
    } else {
      baseUrl = input;
    }
  } else if (typeof input === 'object' && input !== null) {
    const candidate = input as Record<string, unknown>;
    if (typeof candidate.src === 'string') {
      baseUrl = candidate.src;
    } else if (typeof candidate.url === 'string') {
      baseUrl = candidate.url;
    } else if (typeof (candidate as { toString?: () => string }).toString === 'function') {
      const str = String(candidate);
      if (str && str !== '[object Object]') baseUrl = str;
    }
  }
  if (!baseUrl) return '';
  if (width && baseUrl.startsWith('http')) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}width=${width}`;
  }
  return baseUrl;
}

// Sample storefront catalog products using real Mangal Royal Studio CDN images
const SAMPLE_PRODUCTS = [
  {
    id: 8901001,
    title: 'Royal Celeste Solitaire Diamond Ring',
    handle: 'royal-celeste-solitaire-ring',
    url: '/products/royal-celeste-solitaire-ring',
    vendor: 'Mangal Royal Studio',
    type: 'Ring',
    price: 6850000, // in paise (₹68,500)
    price_min: 6850000,
    price_max: 6850000,
    compare_at_price: 7600000,
    compare_at_price_min: 7600000,
    compare_at_price_max: 7600000,
    price_varies: false,
    compare_at_price_varies: false,
    available: true,
    description:
      '<p>Handcrafted in BIS Hallmarked 18KT Gold and set with IGI-certified EF-VVS lab-grown solitaire and accent diamonds. Designed at Mangal Royal Studio for timeless everyday and bridal elegance.</p>',
    featured_image: 'shopify://shop_images/a79933e475b1160a9334828e0d30c003bc131737.png',
    imageFile2: 'shopify://shop_images/c28d5704abb507036c26701c54ae84ffc8656ea8_1.jpg',
    sku: 'MRS-RNG-001',
    metal: '18K Yellow Gold',
    weight: '3.85 g',
    diamond: '1.05 ct EF-VVS IGI Certified',
  },
  {
    id: 8901002,
    title: 'Maharani Heritage Diamond Drop Earrings',
    handle: 'maharani-heritage-diamond-earrings',
    url: '/products/maharani-heritage-diamond-earrings',
    vendor: 'Mangal Royal Studio',
    type: 'Earrings',
    price: 8420000,
    price_min: 8420000,
    price_max: 8420000,
    compare_at_price: 9200000,
    compare_at_price_min: 9200000,
    compare_at_price_max: 9200000,
    price_varies: false,
    compare_at_price_varies: false,
    available: true,
    description:
      '<p>Sculptural drop earrings crafted in 18KT Rose Gold featuring pear and marquise cut lab-grown diamonds with brilliant luster.</p>',
    featured_image: 'shopify://shop_images/cfbaaa5e00a2471def9df241953eeac01f492955_1.png',
    imageFile2: 'shopify://shop_images/4ad63d14eaf4ccb8ad69310f2c516f5a96f1f8c1_1.jpg',
    sku: 'MRS-EAR-002',
    metal: '18K Rose Gold',
    weight: '5.40 g',
    diamond: '1.48 ct EF-VVS IGI Certified',
  },
  {
    id: 8901003,
    title: 'Aurelia Solitaire Diamond Pendant Necklace',
    handle: 'aurelia-solitaire-pendant-necklace',
    url: '/products/aurelia-solitaire-pendant-necklace',
    vendor: 'Mangal Royal Studio',
    type: 'Necklace',
    price: 5290000,
    price_min: 5290000,
    price_max: 5290000,
    compare_at_price: 5900000,
    compare_at_price_min: 5900000,
    compare_at_price_max: 5900000,
    price_varies: false,
    compare_at_price_varies: false,
    available: true,
    description:
      '<p>Delicate solitaire pendant suspended on an 18KT hallmarked gold chain, illuminating the neckline with fire and brilliance.</p>',
    featured_image: 'shopify://shop_images/9e0729be479b73cbaecfabb3e8368e2f323323d5.png',
    imageFile2: 'shopify://shop_images/348b73957dedca68bba67b33bc0a9766b5914cd3.jpg',
    sku: 'MRS-NCK-003',
    metal: '18K Yellow Gold',
    weight: '3.10 g',
    diamond: '0.75 ct EF-VVS',
  },
  {
    id: 8901004,
    title: 'Imperial Tennis Diamond Bracelet',
    handle: 'imperial-tennis-diamond-bracelet',
    url: '/products/imperial-tennis-diamond-bracelet',
    vendor: 'Mangal Royal Studio',
    type: 'Bracelets',
    price: 14500000,
    price_min: 14500000,
    price_max: 14500000,
    compare_at_price: 16200000,
    compare_at_price_min: 16200000,
    compare_at_price_max: 16200000,
    price_varies: false,
    compare_at_price_varies: false,
    available: true,
    description:
      '<p>Continuous line of precision-matched round brilliant lab-grown diamonds set in 18KT White Gold with a double-safety box clasp.</p>',
    featured_image: 'shopify://shop_images/6158221b28f34134f5119c8a750d12eceab5003b.png',
    imageFile2: 'shopify://shop_images/1ae87b39ce7745cdb5ca5d5fb547519fe3fa790c.png',
    sku: 'MRS-BRC-004',
    metal: '18K White Gold',
    weight: '9.60 g',
    diamond: '3.20 ct EF-VVS',
  },
  {
    id: 8901005,
    title: 'Noor Eternal Halo Engagement Ring',
    handle: 'noor-eternal-halo-ring',
    url: '/products/noor-eternal-halo-ring',
    vendor: 'Mangal Royal Studio',
    type: 'Ring',
    price: 7490000,
    price_min: 7490000,
    price_max: 7490000,
    compare_at_price: 8300000,
    compare_at_price_min: 8300000,
    compare_at_price_max: 8300000,
    price_varies: false,
    compare_at_price_varies: false,
    available: true,
    description:
      '<p>Center cushion-cut lab-grown diamond encircled by a micro-pavé halo in 18KT Yellow Gold.</p>',
    featured_image: 'shopify://shop_images/832f60664a5381eb7addb5fef2ce71e8ae897c6f_1.jpg',
    imageFile2: 'shopify://shop_images/a79933e475b1160a9334828e0d30c003bc131737.png',
    sku: 'MRS-RNG-005',
    metal: '18K Yellow Gold',
    weight: '4.15 g',
    diamond: '1.25 ct EF-VVS',
  },
  {
    id: 8901006,
    title: 'Rajwada Heritage Diamond Bangle',
    handle: 'rajwada-heritage-diamond-bangle',
    url: '/products/rajwada-heritage-diamond-bangle',
    vendor: 'Mangal Royal Studio',
    type: 'Bracelets',
    price: 18900000,
    price_min: 18900000,
    price_max: 18900000,
    compare_at_price: 21000000,
    compare_at_price_min: 21000000,
    compare_at_price_max: 21000000,
    price_varies: false,
    compare_at_price_varies: false,
    available: true,
    description:
      '<p>Statement heirloom bangle crafted in 18KT Gold with marquise and round brilliant diamond clusters.</p>',
    featured_image: 'shopify://shop_images/1ae87b39ce7745cdb5ca5d5fb547519fe3fa790c.png',
    imageFile2: 'shopify://shop_images/6158221b28f34134f5119c8a750d12eceab5003b.png',
    sku: 'MRS-BNG-006',
    metal: '18K Yellow Gold',
    weight: '14.20 g',
    diamond: '4.10 ct EF-VVS',
  },
  {
    id: 8901007,
    title: 'Lumiere Marquise Cluster Studs',
    handle: 'lumiere-marquise-cluster-studs',
    url: '/products/lumiere-marquise-cluster-studs',
    vendor: 'Mangal Royal Studio',
    type: 'Earrings',
    price: 3850000,
    price_min: 3850000,
    price_max: 3850000,
    compare_at_price: 4400000,
    compare_at_price_min: 4400000,
    compare_at_price_max: 4400000,
    price_varies: false,
    compare_at_price_varies: false,
    available: true,
    description:
      '<p>Everyday luxury diamond ear studs crafted in 18KT Gold with marquise-cut petals.</p>',
    featured_image: 'shopify://shop_images/c04cabaf26db3873ddde6bde243cde7572ddeea8_1.jpg',
    imageFile2: 'shopify://shop_images/cfbaaa5e00a2471def9df241953eeac01f492955_1.png',
    sku: 'MRS-EAR-007',
    metal: '18K Yellow Gold',
    weight: '2.65 g',
    diamond: '0.62 ct EF-VVS',
  },
  {
    id: 8901008,
    title: 'Celestia Layered Diamond Choker',
    handle: 'celestia-layered-diamond-choker',
    url: '/products/celestia-layered-diamond-choker',
    vendor: 'Mangal Royal Studio',
    type: 'Necklace',
    price: 22400000,
    price_min: 22400000,
    price_max: 22400000,
    compare_at_price: 24800000,
    compare_at_price_min: 24800000,
    compare_at_price_max: 24800000,
    price_varies: false,
    compare_at_price_varies: false,
    available: true,
    description:
      '<p>Bridal masterpiece featuring graduated pear and round brilliant diamonds in 18KT Gold.</p>',
    featured_image: 'shopify://shop_images/348b73957dedca68bba67b33bc0a9766b5914cd3.jpg',
    imageFile2: 'shopify://shop_images/9e0729be479b73cbaecfabb3e8368e2f323323d5.png',
    sku: 'MRS-NCK-008',
    metal: '18K Rose Gold',
    weight: '18.90 g',
    diamond: '5.45 ct EF-VVS',
  },
].map((item) => {
  const img1 = createImageDrop(item.featured_image, item.title, 1000, 1000);
  const img2 = createImageDrop(item.imageFile2, `${item.title} Alternate View`, 1000, 1000);
  const media1 = {
    id: item.id * 10 + 1,
    media_type: 'image',
    position: 1,
    alt: item.title,
    aspect_ratio: 1.0,
    width: 1000,
    height: 1000,
    src: img1.src,
    preview_image: img1,
  };
  const media2 = {
    id: item.id * 10 + 2,
    media_type: 'image',
    position: 2,
    alt: `${item.title} - Side View`,
    aspect_ratio: 1.0,
    width: 1000,
    height: 1000,
    src: img2.src,
    preview_image: img2,
  };
  const variant = {
    id: item.id * 100 + 1,
    title: `${item.metal} / 12`,
    price: item.price,
    compare_at_price: item.compare_at_price,
    available: true,
    sku: item.sku,
    option1: item.metal,
    option2: '12',
    options: [item.metal, '12'],
    featured_media: media1,
    featured_image: img1,
    inventory_management: 'shopify',
    inventory_quantity: 5,
    inventory_policy: 'deny',
    requires_shipping: true,
  };
  return {
    ...item,
    featured_media: media1,
    featured_image: img1,
    images: [img1, img2],
    media: [media1, media2],
    variants: [variant],
    selected_or_first_available_variant: variant,
    first_available_variant: variant,
    has_only_default_variant: false,
    options: ['Metal Purity & Color', 'Size'],
    options_with_values: [
      {
        name: 'Metal Purity & Color',
        position: 1,
        selected_value: item.metal,
        values: ['18K Yellow Gold', '18K Rose Gold', '18K White Gold', '14K Yellow Gold'],
      },
      {
        name: 'Size',
        position: 2,
        selected_value: '12',
        values: ['10', '12', '14', '16'],
      },
    ],
    metafields: {
      custom: {
        metal_purity: item.metal,
        net_weight: item.weight,
        diamond_quality: item.diamond,
      },
    },
  };
});

const SAMPLE_COLLECTIONS: Record<string, Record<string, unknown>> = {
  all: {
    id: 4001,
    title: 'All Fine Jewellery',
    handle: 'all',
    url: '/collections/all',
    description:
      'Explore Mangal Royal Studio’s handcrafted collection of IGI-certified lab-grown diamond rings, earrings, necklaces, and bracelets in hallmarked 18KT & 14KT gold.',
    all_products_count: SAMPLE_PRODUCTS.length,
    products_count: SAMPLE_PRODUCTS.length,
    products: SAMPLE_PRODUCTS,
    featured_image: createImageDrop('shopify://shop_images/a79933e475b1160a9334828e0d30c003bc131737.png', 'All Fine Jewellery'),
    image: createImageDrop('shopify://shop_images/a79933e475b1160a9334828e0d30c003bc131737.png', 'All Fine Jewellery'),
    sort_by: 'best-selling',
    default_sort_by: 'best-selling',
    sort_options: [
      { value: 'featured', name: 'Featured' },
      { value: 'best-selling', name: 'Best selling' },
      { value: 'price-ascending', name: 'Price, low to high' },
      { value: 'price-descending', name: 'Price, high to low' },
      { value: 'created-descending', name: 'Date, new to old' },
    ],
    filters: [],
  },
  'best-sellers': {
    id: 4000,
    title: 'Our Bestsellers',
    handle: 'best-sellers',
    url: '/collections/best-sellers',
    description: 'Our most loved handcrafted lab-grown diamond fine jewellery pieces.',
    all_products_count: SAMPLE_PRODUCTS.length,
    products_count: SAMPLE_PRODUCTS.length,
    products: SAMPLE_PRODUCTS,
    featured_image: createImageDrop('shopify://shop_images/a79933e475b1160a9334828e0d30c003bc131737.png', 'Our Bestsellers'),
    image: createImageDrop('shopify://shop_images/a79933e475b1160a9334828e0d30c003bc131737.png', 'Our Bestsellers'),
    sort_by: 'best-selling',
    default_sort_by: 'best-selling',
    sort_options: [
      { value: 'featured', name: 'Featured' },
      { value: 'best-selling', name: 'Best selling' },
      { value: 'price-ascending', name: 'Price, low to high' },
      { value: 'price-descending', name: 'Price, high to low' },
    ],
    filters: [],
  },
  frontpage: {
    id: 4006,
    title: 'Featured Jewellery',
    handle: 'frontpage',
    url: '/collections/frontpage',
    description: 'Signature designs from Mangal Royal Studio.',
    all_products_count: SAMPLE_PRODUCTS.length,
    products_count: SAMPLE_PRODUCTS.length,
    products: SAMPLE_PRODUCTS,
    featured_image: createImageDrop('shopify://shop_images/4ad63d14eaf4ccb8ad69310f2c516f5a96f1f8c1_1.jpg', 'Featured Jewellery'),
    image: createImageDrop('shopify://shop_images/4ad63d14eaf4ccb8ad69310f2c516f5a96f1f8c1_1.jpg', 'Featured Jewellery'),
    sort_by: 'best-selling',
    default_sort_by: 'best-selling',
    sort_options: [],
    filters: [],
  },
  ring: {
    id: 4002,
    title: 'Rings',
    handle: 'ring',
    url: '/collections/ring',
    description: 'Solitaire, halo, and eternity diamond rings crafted for life’s defining moments.',
    all_products_count: SAMPLE_PRODUCTS.length,
    products_count: SAMPLE_PRODUCTS.length,
    products: SAMPLE_PRODUCTS,
    featured_image: createImageDrop('shopify://shop_images/a79933e475b1160a9334828e0d30c003bc131737.png', 'Rings'),
    image: createImageDrop('shopify://shop_images/a79933e475b1160a9334828e0d30c003bc131737.png', 'Rings'),
    sort_by: 'best-selling',
    default_sort_by: 'best-selling',
    sort_options: [
      { value: 'featured', name: 'Featured' },
      { value: 'best-selling', name: 'Best selling' },
      { value: 'price-ascending', name: 'Price, low to high' },
      { value: 'price-descending', name: 'Price, high to low' },
    ],
    filters: [],
  },
  earrings: {
    id: 4003,
    title: 'Earrings',
    handle: 'earrings',
    url: '/collections/earrings',
    description: 'Diamond studs, drops, and heritage chandelier earrings.',
    all_products_count: SAMPLE_PRODUCTS.length,
    products_count: SAMPLE_PRODUCTS.length,
    products: SAMPLE_PRODUCTS,
    featured_image: createImageDrop('shopify://shop_images/cfbaaa5e00a2471def9df241953eeac01f492955_1.png', 'Earrings'),
    image: createImageDrop('shopify://shop_images/cfbaaa5e00a2471def9df241953eeac01f492955_1.png', 'Earrings'),
    sort_by: 'best-selling',
    default_sort_by: 'best-selling',
    sort_options: [],
    filters: [],
  },
  necklace: {
    id: 4004,
    title: 'Necklaces & Pendants',
    handle: 'necklace',
    url: '/collections/necklace',
    description: 'Solitaire pendants, tennis necklaces, and bridal diamond chokers.',
    all_products_count: SAMPLE_PRODUCTS.length,
    products_count: SAMPLE_PRODUCTS.length,
    products: SAMPLE_PRODUCTS,
    featured_image: createImageDrop('shopify://shop_images/348b73957dedca68bba67b33bc0a9766b5914cd3.jpg', 'Necklaces'),
    image: createImageDrop('shopify://shop_images/348b73957dedca68bba67b33bc0a9766b5914cd3.jpg', 'Necklaces'),
    sort_by: 'best-selling',
    default_sort_by: 'best-selling',
    sort_options: [],
    filters: [],
  },
  bracelets: {
    id: 4005,
    title: 'Bracelets & Bangles',
    handle: 'bracelets',
    url: '/collections/bracelets',
    description: 'Diamond tennis bracelets and handcrafted gold bangles.',
    all_products_count: SAMPLE_PRODUCTS.length,
    products_count: SAMPLE_PRODUCTS.length,
    products: SAMPLE_PRODUCTS,
    featured_image: createImageDrop('shopify://shop_images/6158221b28f34134f5119c8a750d12eceab5003b.png', 'Bracelets'),
    image: createImageDrop('shopify://shop_images/6158221b28f34134f5119c8a750d12eceab5003b.png', 'Bracelets'),
    sort_by: 'best-selling',
    default_sort_by: 'best-selling',
    sort_options: [],
    filters: [],
  },
};

const LINKLISTS: Record<string, { title: string; handle: string; links: Array<Record<string, unknown>> }> = {
  'main-menu': {
    title: 'Main menu',
    handle: 'main-menu',
    links: [
      { title: 'Home', url: '/', active: false, current: false, child_active: false, child_current: false, levels: 0, links: [] },
      {
        title: 'Shop By Category',
        url: '/collections/all',
        active: false,
        current: false,
        child_active: false,
        child_current: false,
        levels: 1,
        links: [
          { title: 'Rings', url: '/collections/ring', active: false, current: false, links: [] },
          { title: 'Earrings', url: '/collections/earrings', active: false, current: false, links: [] },
          { title: 'Necklaces', url: '/collections/necklace', active: false, current: false, links: [] },
          { title: 'Bracelets & Bangles', url: '/collections/bracelets', active: false, current: false, links: [] },
        ],
      },
      { title: 'New Arrivals', url: '/collections/all', active: false, current: false, child_active: false, child_current: false, levels: 0, links: [] },
      { title: 'About Us', url: '/pages/about-us', active: false, current: false, child_active: false, child_current: false, levels: 0, links: [] },
      { title: 'Track Order', url: '/pages/order-tracking', active: false, current: false, child_active: false, child_current: false, levels: 0, links: [] },
      { title: 'Contact', url: '/pages/contact', active: false, current: false, child_active: false, child_current: false, levels: 0, links: [] },
    ],
  },
  footer: {
    title: 'Quick Links',
    handle: 'footer',
    links: [
      { title: 'Home', url: '/' },
      { title: 'Shop All Jewellery', url: '/collections/all' },
      { title: 'About Mangal Royal Studio', url: '/pages/about-us' },
      { title: 'Wishlist', url: '/pages/wishlist' },
      { title: 'Contact Us', url: '/pages/contact' },
    ],
  },
  services: {
    title: 'Services',
    handle: 'services',
    links: [
      { title: 'Order Tracking', url: '/pages/order-tracking' },
      { title: 'Book Store Visit', url: '/pages/contact' },
      { title: 'Lifetime Exchange & Buyback', url: '/pages/shipping-returns' },
      { title: 'Jewellery Care Guide', url: '/pages/jewellery-care' },
    ],
  },
  servies: {
    title: 'Policies',
    handle: 'servies',
    links: [
      { title: 'Privacy Policy', url: '/pages/privacy-policy' },
      { title: 'Shipping & Return Policy', url: '/pages/shipping-returns' },
      { title: 'Terms & Conditions', url: '/pages/terms-conditions' },
      { title: 'Authenticity & IGI Certification', url: '/pages/authenticity' },
    ],
  },
  about: {
    title: 'About',
    handle: 'about',
    links: [
      { title: 'Our Heritage', url: '/pages/about-us' },
      { title: 'Mangal Group Legacy', url: '/pages/about-us' },
      { title: 'Mumbai Flagship Studio', url: '/pages/contact' },
    ],
  },
};

function formatInrMoney(paise: unknown): string {
  const num = Number(paise);
  if (!Number.isFinite(num)) return 'Rs. 0.00';
  const rupees = num / 100;
  return `Rs. ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function lookupTranslation(locales: Record<string, unknown>, keyPath: string, params?: Record<string, unknown>): string {
  const parts = keyPath.split('.');
  let cur: unknown = locales;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      cur = undefined;
      break;
    }
  }
  if (typeof cur !== 'string') {
    const fallbacks: Record<string, string> = {
      'general.accessibility.link_messages.new_window': 'Opens in a new window.',
      'products.product.add_to_wishlist': 'Add to wishlist',
    };
    return fallbacks[keyPath] || keyPath;
  }
  let result = cur;
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(v ?? ''));
    }
  }
  return result;
}

function hydrateSettingValue(val: unknown, settingSchema?: Record<string, unknown>): unknown {
  const type = settingSchema?.type as string | undefined;
  if (typeof val === 'string') {
    if (val.startsWith('shopify://shop_images/')) {
      return createImageDrop(val);
    }
    if (type === 'color' || /^#[0-9a-fA-F]{3,8}$/.test(val.trim())) {
      return new ShopifyColorDrop(val.trim());
    }
    if (type === 'collection') {
      return SAMPLE_COLLECTIONS[val] || SAMPLE_COLLECTIONS.all;
    }
    if (type === 'link_list') {
      return LINKLISTS[val] || { title: val, handle: val, links: [] };
    }
  }
  if (val === '' || val === null || val === undefined) {
    if (type === 'collection') {
      return SAMPLE_COLLECTIONS.all;
    }
  }
  return val;
}

function extractSectionSchema(liquidSource: string): {
  cleanedLiquid: string;
  schema: Record<string, unknown>;
} {
  let schema: Record<string, unknown> = {};
  const cleanedLiquid = liquidSource.replace(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/g, (_match, jsonStr: string) => {
    try {
      schema = JSON.parse(jsonStr.trim()) as Record<string, unknown>;
    } catch {
      schema = {};
    }
    return '';
  });
  return { cleanedLiquid, schema };
}

function preprocessShopifyLiquid(source: string): string {
  return source
    .replace(/\{%-?\s*style\s*-?%\}/g, '<style>')
    .replace(/\{%-?\s*endstyle\s*-?%\}/g, '</style>')
    .replace(/\{%-?\s*javascript\s*-?%\}/g, '<script>')
    .replace(/\{%-?\s*endjavascript\s*-?%\}/g, '</script>');
}

function createLiquidEngine(locales: Record<string, unknown>): Liquid {
  const engine = new Liquid({
    root: [SECTIONS_DIR, SNIPPETS_DIR, path.join(THEME_ROOT, 'layout')],
    partials: [SNIPPETS_DIR, SECTIONS_DIR],
    extname: '.liquid',
    strictFilters: false,
    strictVariables: false,
    jsTruthy: true,
  });

  // Custom Shopify Tags: style, javascript, form, paginate
  engine.registerTag(
    'style',
    class StyleTag extends Tag {
      private templates: Template[] = [];
      constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
        super(token, remainTokens, liquid);
        const stream = this.liquid.parser
          .parseStream(remainTokens)
          .on('tag:endstyle', () => stream.stop())
          .on('template', (tpl: Template) => this.templates.push(tpl))
          .on('end', () => {
            throw new Error('tag {% style %} not closed');
          });
        stream.start();
      }
      *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
        emitter.write('<style>');
        yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
        emitter.write('</style>');
      }
    }
  );

  engine.registerTag(
    'javascript',
    class JavascriptTag extends Tag {
      private templates: Template[] = [];
      constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
        super(token, remainTokens, liquid);
        const stream = this.liquid.parser
          .parseStream(remainTokens)
          .on('tag:endjavascript', () => stream.stop())
          .on('template', (tpl: Template) => this.templates.push(tpl))
          .on('end', () => {
            throw new Error('tag {% javascript %} not closed');
          });
        stream.start();
      }
      *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
        emitter.write('<script>');
        yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
        emitter.write('</script>');
      }
    }
  );

  engine.registerTag(
    'form',
    class FormTag extends Tag {
      private templates: Template[] = [];
      private formType = '';
      constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
        super(token, remainTokens, liquid);
        this.formType = token.args.split(',')[0]?.trim().replace(/['"]/g, '') || 'form';
        const stream = this.liquid.parser
          .parseStream(remainTokens)
          .on('tag:endform', () => stream.stop())
          .on('template', (tpl: Template) => this.templates.push(tpl))
          .on('end', () => {
            throw new Error('tag {% form %} not closed');
          });
        stream.start();
      }
      *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
        emitter.write(`<form method="post" action="/contact#${this.formType}" class="shopify-preview-form" data-form-type="${this.formType}">`);
        ctx.push({
          form: {
            id: `form-${this.formType}`,
            posted_successfully: false,
            errors: null,
            email: '',
            body: '',
            name: '',
          },
        });
        yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
        ctx.pop();
        emitter.write('</form>');
      }
    }
  );

  engine.registerTag(
    'paginate',
    class PaginateTag extends Tag {
      private templates: Template[] = [];
      constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
        super(token, remainTokens, liquid);
        const stream = this.liquid.parser
          .parseStream(remainTokens)
          .on('tag:endpaginate', () => stream.stop())
          .on('template', (tpl: Template) => this.templates.push(tpl))
          .on('end', () => {
            throw new Error('tag {% paginate %} not closed');
          });
        stream.start();
      }
      *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
        ctx.push({
          paginate: {
            current_page: 1,
            current_offset: 0,
            items: SAMPLE_PRODUCTS.length,
            page_size: 16,
            pages: 1,
            parts: [],
            previous: null,
            next: null,
          },
        });
        yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
        ctx.pop();
      }
    }
  );

  // Filters
  engine.registerFilter('asset_url', (file: unknown) => `/assets/${String(file ?? '').trim()}`);
  engine.registerFilter('stylesheet_tag', (url: unknown) => `<link rel="stylesheet" href="${String(url ?? '')}" media="all">`);
  engine.registerFilter('script_tag', (url: unknown) => `<script src="${String(url ?? '')}"></script>`);
  engine.registerFilter('inline_asset_content', (file: unknown) => {
    const fileName = String(file ?? '').trim();
    const assetPath = path.join(ASSETS_DIR, fileName);
    if (fs.existsSync(assetPath)) {
      return fs.readFileSync(assetPath, 'utf8');
    }
    return '';
  });
  engine.registerFilter('image_url', (input: unknown, ...args: unknown[]) => {
    let width: number | undefined;
    for (const arg of args) {
      if (Array.isArray(arg) && arg[0] === 'width') {
        width = Number(arg[1]);
      } else if (typeof arg === 'object' && arg !== null && 'width' in (arg as Record<string, unknown>)) {
        width = Number((arg as Record<string, unknown>).width);
      }
    }
    return resolveImageUrl(input, width);
  });
  engine.registerFilter('image_tag', (url: unknown, ...args: unknown[]) => {
    const src = resolveImageUrl(url);
    if (!src) return '';
    let cls = '';
    let alt = 'Mangal Royal Studio';
    let loading = 'lazy';
    let style = '';
    for (const arg of args) {
      if (Array.isArray(arg)) {
        const [k, v] = arg;
        if (k === 'class') cls = String(v ?? '');
        if (k === 'alt' && v) alt = String(v);
        if (k === 'loading' && v) loading = String(v);
        if (k === 'style' && v) style = String(v);
      }
    }
    return `<img src="${src}" alt="${alt.replace(/"/g, '&quot;')}" class="${cls}" loading="${loading}"${style ? ` style="${style}"` : ''} width="1000" height="1000">`;
  });
  engine.registerFilter('placeholder_svg_tag', (name: unknown, cls: unknown) => {
    const classAttr = typeof cls === 'string' ? ` class="${cls}"` : '';
    return `<svg${classAttr} viewBox="0 0 525 525" xmlns="http://www.w3.org/2000/svg" style="background:#f4efe9;width:100%;height:100%;"><rect width="525" height="525" fill="#f4efe9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#8c7a6b" font-family="serif" font-size="18">${String(name || 'Mangal Royal Studio')}</text></svg>`;
  });
  engine.registerFilter('money', (paise: unknown) => formatInrMoney(paise));
  engine.registerFilter('money_with_currency', (paise: unknown) => `${formatInrMoney(paise)} INR`);
  engine.registerFilter('money_without_trailing_zeros', (paise: unknown) => formatInrMoney(paise).replace(/\.00$/, ''));
  engine.registerFilter('t', (key: unknown, ...args: unknown[]) => {
    const params: Record<string, unknown> = {};
    for (const arg of args) {
      if (Array.isArray(arg) && arg.length === 2) {
        params[String(arg[0])] = arg[1];
      }
    }
    return lookupTranslation(locales, String(key ?? ''), params);
  });
  engine.registerFilter('font_modify', (fontObj: unknown) => fontObj);
  engine.registerFilter('font_face', () => '');
  engine.registerFilter('font_url', () => '');
  engine.registerFilter('color_brightness', (color: unknown) => {
    if (color instanceof ShopifyColorDrop) {
      return (color.red * 299 + color.green * 587 + color.blue * 114) / 1000;
    }
    return 240;
  });
  engine.registerFilter('color_lighten', (color: unknown) => color);
  engine.registerFilter('color_darken', (color: unknown) => color);
  engine.registerFilter('color_to_rgb', (color: unknown) => {
    if (color instanceof ShopifyColorDrop) {
      return `rgb(${color.red}, ${color.green}, ${color.blue})`;
    }
    return String(color ?? '');
  });
  engine.registerFilter('default_errors', (errors: unknown) => String(errors ?? ''));
  engine.registerFilter(' camelcase', (str: unknown) => String(str ?? ''));
  engine.registerFilter('camelcase', (str: unknown) => String(str ?? ''));
  engine.registerFilter('handle', (str: unknown) =>
    String(str ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
  engine.registerFilter('handleize', (str: unknown) =>
    String(str ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
  engine.registerFilter('pluralize', (count: unknown, singular: unknown, plural: unknown) =>
    Number(count) === 1 ? String(singular ?? '') : String(plural ?? '')
  );

  return engine;
}

function buildThemeSettingsContext() {
  const settingsData = loadJsonFile<{
    current: Record<string, unknown>;
  }>(path.join(CONFIG_DIR, 'settings_data.json'));
  const current = settingsData.current || {};

  const colorSchemesRaw = (current.color_schemes as Record<string, { settings: Record<string, string> }>) || {};
  const colorSchemesList = Object.entries(colorSchemesRaw).map(([id, schemeObj]) => {
    const rawSettings = schemeObj.settings || {};
    const hydrated: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawSettings)) {
      if (typeof v === 'string' && v.startsWith('#')) {
        hydrated[k] = new ShopifyColorDrop(v);
      } else {
        hydrated[k] = v;
      }
    }
    return {
      id,
      settings: hydrated,
    };
  });

  const hydratedSettings: Record<string, unknown> = {
    page_width: 1200,
    spacing_sections: 0,
    spacing_grid_horizontal: 8,
    spacing_grid_vertical: 8,
    animations_reveal_on_scroll: true,
    animations_hover_elements: 'none',
    buttons_border_thickness: 1,
    buttons_border_opacity: 100,
    buttons_radius: 0,
    buttons_shadow_opacity: 0,
    buttons_shadow_horizontal_offset: 0,
    buttons_shadow_vertical_offset: 4,
    buttons_shadow_blur: 5,
    variant_pills_border_thickness: 1,
    variant_pills_border_opacity: 55,
    variant_pills_radius: 40,
    variant_pills_shadow_opacity: 0,
    variant_pills_shadow_horizontal_offset: 0,
    variant_pills_shadow_vertical_offset: 4,
    variant_pills_shadow_blur: 5,
    inputs_border_thickness: 1,
    inputs_border_opacity: 55,
    inputs_radius: 0,
    inputs_shadow_opacity: 0,
    inputs_shadow_horizontal_offset: 0,
    inputs_shadow_vertical_offset: 4,
    inputs_shadow_blur: 5,
    card_style: 'standard',
    card_image_padding: 0,
    card_text_alignment: 'left',
    card_color_scheme: 'scheme-2',
    card_border_thickness: 0,
    card_border_opacity: 10,
    card_corner_radius: 0,
    card_shadow_opacity: 0,
    card_shadow_horizontal_offset: 0,
    card_shadow_vertical_offset: 4,
    card_shadow_blur: 5,
    collection_card_style: 'standard',
    collection_card_image_padding: 0,
    collection_card_text_alignment: 'left',
    collection_card_color_scheme: 'scheme-2',
    collection_card_border_thickness: 0,
    collection_card_border_opacity: 10,
    collection_card_corner_radius: 0,
    collection_card_shadow_opacity: 0,
    collection_card_shadow_horizontal_offset: 0,
    collection_card_shadow_vertical_offset: 4,
    collection_card_shadow_blur: 5,
    blog_card_style: 'standard',
    blog_card_image_padding: 0,
    blog_card_text_alignment: 'left',
    blog_card_color_scheme: 'scheme-2',
    blog_card_border_thickness: 0,
    blog_card_border_opacity: 10,
    blog_card_corner_radius: 0,
    blog_card_shadow_opacity: 0,
    blog_card_shadow_horizontal_offset: 0,
    blog_card_shadow_vertical_offset: 4,
    blog_card_shadow_blur: 5,
    text_boxes_border_thickness: 0,
    text_boxes_border_opacity: 10,
    text_boxes_radius: 0,
    text_boxes_shadow_opacity: 0,
    text_boxes_shadow_horizontal_offset: 0,
    text_boxes_shadow_vertical_offset: 4,
    text_boxes_shadow_blur: 5,
    media_border_thickness: 1,
    media_border_opacity: 5,
    media_radius: 0,
    media_shadow_opacity: 0,
    media_shadow_horizontal_offset: 0,
    media_shadow_vertical_offset: 4,
    media_shadow_blur: 5,
    media_padding: 0,
    popup_border_thickness: 1,
    popup_border_opacity: 10,
    popup_corner_radius: 0,
    popup_shadow_opacity: 5,
    popup_shadow_horizontal_offset: 0,
    popup_shadow_vertical_offset: 4,
    popup_shadow_blur: 5,
    drawer_border_thickness: 1,
    drawer_border_opacity: 10,
    drawer_shadow_opacity: 0,
    drawer_shadow_horizontal_offset: 0,
    drawer_shadow_vertical_offset: 4,
    drawer_shadow_blur: 5,
    badge_position: 'bottom left',
    badge_corner_radius: 40,
    sale_badge_color_scheme: 'scheme-4',
    sold_out_badge_color_scheme: 'scheme-3',
    cart_type: 'notification',
    predictive_search_enabled: true,
    heading_scale: 100,
    body_scale: 100,
    ...current,
    color_schemes: colorSchemesList,
    type_header_font: {
      family: 'Begum',
      fallback_families: 'serif',
      style: 'normal',
      weight: '400',
      'system?': true,
    },
    type_body_font: {
      family: 'Gotham',
      fallback_families: 'sans-serif',
      style: 'normal',
      weight: '400',
      'system?': true,
    },
  };

  if (typeof current.logo === 'string') {
    hydratedSettings.logo = createImageDrop(current.logo, 'Mangal Royal Studio Logo', 360, 120);
  }

  return hydratedSettings;
}

interface SectionInstanceConfig {
  type: string;
  disabled?: boolean;
  settings?: Record<string, unknown>;
  blocks?: Record<
    string,
    {
      type: string;
      disabled?: boolean;
      settings?: Record<string, unknown>;
    }
  >;
  block_order?: string[];
}

async function renderSectionInstance(
  engine: Liquid,
  sectionId: string,
  sectionConfig: SectionInstanceConfig,
  globalContext: Record<string, unknown>
): Promise<string> {
  if (sectionConfig.disabled) return '';

  const sectionFile = path.join(SECTIONS_DIR, `${sectionConfig.type}.liquid`);
  if (!fs.existsSync(sectionFile)) {
    return `<!-- Missing section file: ${sectionConfig.type}.liquid -->`;
  }

  const rawSource = fs.readFileSync(sectionFile, 'utf8');
  const { cleanedLiquid, schema } = extractSectionSchema(rawSource);
  const processedLiquid = preprocessShopifyLiquid(cleanedLiquid);

  // Merge schema default settings with instance settings
  const schemaSettings = (schema.settings as Array<Record<string, unknown>>) || [];
  const mergedSettings: Record<string, unknown> = {};
  const settingSchemaById: Record<string, Record<string, unknown>> = {};

  for (const sDef of schemaSettings) {
    const id = sDef.id as string | undefined;
    if (id) {
      settingSchemaById[id] = sDef;
      if ('default' in sDef) {
        mergedSettings[id] = hydrateSettingValue(sDef.default, sDef);
      } else {
        mergedSettings[id] = '';
      }
    }
  }

  for (const [k, v] of Object.entries(sectionConfig.settings || {})) {
    mergedSettings[k] = hydrateSettingValue(v, settingSchemaById[k]);
  }

  // Build blocks array
  const schemaBlocks = (schema.blocks as Array<Record<string, unknown>>) || [];
  const blockSchemaByType: Record<string, Record<string, Record<string, unknown>>> = {};
  const blockDefaultsByType: Record<string, Record<string, unknown>> = {};

  for (const bDef of schemaBlocks) {
    const bType = bDef.type as string | undefined;
    if (!bType) continue;
    blockSchemaByType[bType] = {};
    blockDefaultsByType[bType] = {};
    for (const sDef of (bDef.settings as Array<Record<string, unknown>>) || []) {
      const sId = sDef.id as string | undefined;
      if (sId) {
        blockSchemaByType[bType][sId] = sDef;
        if ('default' in sDef) {
          blockDefaultsByType[bType][sId] = hydrateSettingValue(sDef.default, sDef);
        }
      }
    }
  }

  const blocksObj = sectionConfig.blocks || {};
  const blockOrder = sectionConfig.block_order || Object.keys(blocksObj);
  const hydratedBlocks: Array<Record<string, unknown>> = [];

  for (const blockId of blockOrder) {
    const blk = blocksObj[blockId];
    if (!blk || blk.disabled) continue;
    const bSettings: Record<string, unknown> = {
      ...(blockDefaultsByType[blk.type] || {}),
    };
    const bSchemaMap = blockSchemaByType[blk.type] || {};
    for (const [k, v] of Object.entries(blk.settings || {})) {
      bSettings[k] = hydrateSettingValue(v, bSchemaMap[k]);
    }
    hydratedBlocks.push({
      id: blockId,
      type: blk.type,
      settings: bSettings,
      shopify_attributes: `data-shopify-editor-block="${blockId}"`,
    });
  }

  const sectionTag = (schema.tag as string) || 'div';
  const sectionClass = (schema.class as string) || 'section';

  const sectionContext = {
    ...globalContext,
    section: {
      id: sectionId,
      type: sectionConfig.type,
      settings: mergedSettings,
      blocks: hydratedBlocks,
      index: 1,
    },
  };

  try {
    const html = await engine.parseAndRender(processedLiquid, sectionContext);
    return `<${sectionTag} id="shopify-section-${sectionId}" class="shopify-section ${sectionClass}">${html}</${sectionTag}>`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[StorefrontPreview] Liquid render warning in section ${sectionConfig.type} (${sectionId}): ${message}`);
    return `<div id="shopify-section-${sectionId}" class="shopify-section" data-render-warning="${message.replace(/"/g, '&quot;')}"><!-- Render warning in ${sectionConfig.type}: ${message} --></div>`;
  }
}

async function renderTemplateGroup(
  engine: Liquid,
  groupJsonPath: string,
  globalContext: Record<string, unknown>
): Promise<string> {
  if (!fs.existsSync(groupJsonPath)) return '';
  const groupData = loadJsonFile<{
    sections: Record<string, SectionInstanceConfig>;
    order: string[];
  }>(groupJsonPath);

  const chunks: string[] = [];
  for (const secId of groupData.order || Object.keys(groupData.sections || {})) {
    const secCfg = groupData.sections?.[secId];
    if (!secCfg) continue;
    const rendered = await renderSectionInstance(engine, secId, secCfg, globalContext);
    if (rendered) chunks.push(rendered);
  }
  return chunks.join('\n');
}

function buildPreviewToolbarHtml(currentPath: string, templateName: string): string {
  const routes = [
    { label: 'Homepage', path: '/' },
    { label: 'Collection (All)', path: '/collections/all' },
    { label: 'Collection (Rings)', path: '/collections/ring' },
    { label: 'Product Detail', path: '/products/royal-celeste-solitaire-ring' },
    { label: 'Wishlist', path: '/pages/wishlist' },
    { label: 'Order Tracking', path: '/pages/order-tracking' },
    { label: 'About Us', path: '/pages/about-us' },
    { label: 'Contact Us', path: '/pages/contact' },
    { label: 'Cart', path: '/cart' },
    { label: 'Search', path: '/search?q=diamond' },
    { label: '404 Page', path: '/404' },
  ];

  const linksHtml = routes
    .map((r) => {
      const active = currentPath === r.path.split('?')[0];
      return `<a href="${r.path}" style="padding:5px 10px;border-radius:4px;text-decoration:none;font-size:12px;font-family:sans-serif;white-space:nowrap;${
        active ? 'background:#8A1E32;color:#fff;font-weight:600;' : 'background:#f4efe9;color:#1b1714;'
      }">${r.label}</a>`;
    })
    .join('');

  return `
    <div id="mrs-local-preview-bar" style="position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:999999;background:rgba(20,16,14,0.94);color:#fff;padding:8px 14px;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,0.35);display:flex;align-items:center;gap:8px;max-width:96vw;overflow-x:auto;border:1px solid rgba(212,175,55,0.35);">
      <span style="font-family:sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#d4af37;font-weight:700;padding-right:6px;border-right:1px solid rgba(255,255,255,0.2);white-space:nowrap;">
        MRS Theme Preview (${templateName})
      </span>
      <div style="display:flex;align-items:center;gap:6px;">
        ${linksHtml}
      </div>
      <button onclick="document.getElementById('mrs-local-preview-bar').style.display='none'" title="Hide preview bar" style="background:transparent;border:none;color:#aaa;cursor:pointer;font-size:14px;padding:2px 6px;margin-left:4px;">✕</button>
    </div>
  `;
}

export function createStorefrontPreviewApp() {
  const app = express();
  const locales = loadJsonFile<Record<string, unknown>>(path.join(LOCALES_DIR, 'en.default.json'));
  const themeSettings = buildThemeSettingsContext();
  const engine = createLiquidEngine(locales);

  // Serve theme assets directly from apps/shopify-theme/assets
  app.use('/assets', express.static(ASSETS_DIR, { maxAge: 0 }));
  app.use('/cdn/shop/files', (req, res) => {
    res.redirect(`${SHOPIFY_CDN_FILES_BASE}${req.path.replace(/^\//, '')}`);
  });

  // Cart JSON endpoints for interactive theme JS
  app.get('/cart.js', (_req, res) => {
    res.json({
      token: 'mrs-preview-cart',
      item_count: 2,
      total_price: 12140000,
      currency: 'INR',
      items: [SAMPLE_PRODUCTS[0], SAMPLE_PRODUCTS[2]],
    });
  });

  async function renderStorefrontPage(
    req: express.Request,
    res: express.Response,
    templateJsonFile: string,
    templateName: string,
    pageTitle: string,
    pageOverrides: Record<string, unknown> = {}
  ) {
    try {
      const p0 = SAMPLE_PRODUCTS[0]!;
      const p1 = SAMPLE_PRODUCTS[1]!;
      const p2 = SAMPLE_PRODUCTS[2]!;
      const globalContext: Record<string, unknown> = {
        settings: themeSettings,
        shop: {
          name: 'Mangal Royal Studio',
          url: `http://127.0.0.1:${PORT}`,
          domain: `127.0.0.1:${PORT}`,
          currency: 'INR',
          money_format: 'Rs. {{amount}}',
          customer_accounts_enabled: true,
        },
        request: {
          origin: `http://127.0.0.1:${PORT}`,
          path: req.path,
          page_type: templateName,
          design_mode: false,
          locale: {
            iso_code: 'en',
            root_url: '/',
          },
        },
        routes: {
          root_url: '/',
          account_url: '/account',
          account_login_url: '/account/login',
          account_register_url: '/account/register',
          account_logout_url: '/account/logout',
          cart_url: '/cart',
          cart_add_url: '/cart/add',
          cart_change_url: '/cart/change',
          cart_update_url: '/cart/update',
          cart_clear_url: '/cart/clear',
          search_url: '/search',
          predictive_search_url: '/search/suggest',
          all_products_collection_url: '/collections/all',
        },
        localization: {
          available_countries: [],
          available_languages: [],
          country: { iso_code: 'IN', name: 'India', currency: { iso_code: 'INR', symbol: '₹' } },
          language: { iso_code: 'en', endonym_name: 'English' },
        },
        linklists: LINKLISTS,
        collections: SAMPLE_COLLECTIONS,
        all_products: Object.fromEntries(SAMPLE_PRODUCTS.map((p) => [p.handle, p])),
        template: {
          name: templateName.split('.')[0],
          suffix: templateName.includes('.') ? templateName.split('.')[1] : '',
          directory: '',
        },
        page_title: pageTitle,
        page_description: 'Mangal Royal Studio — Handcrafted Lab-Grown Diamond Fine Jewellery in 18KT & 14KT Hallmarked Gold.',
        canonical_url: `http://127.0.0.1:${PORT}${req.path}`,
        cart: {
          item_count: 2,
          total_price: 12140000,
          original_total_price: 13500000,
          total_discount: 1360000,
          currency: { iso_code: 'INR', symbol: '₹' },
          empty: false,
          items: [
            {
              id: p0.variants[0]!.id,
              key: 'item-1',
              index: 1,
              title: p0.title,
              product: p0,
              variant: p0.variants[0]!,
              image: p0.featured_image,
              url: p0.url,
              quantity: 1,
              price: p0.price,
              original_price: p0.price,
              final_price: p0.price,
              line_price: p0.price,
              original_line_price: p0.price,
              final_line_price: p0.price,
              options_with_values: [
                { name: 'Metal', value: p0.metal },
                { name: 'Ring Size', value: '12' },
              ],
              discounts: [],
              properties: {},
            },
            {
              id: p2.variants[0]!.id,
              key: 'item-2',
              index: 2,
              title: p2.title,
              product: p2,
              variant: p2.variants[0]!,
              image: p2.featured_image,
              url: p2.url,
              quantity: 1,
              price: p2.price,
              original_price: p2.price,
              final_price: p2.price,
              line_price: p2.price,
              original_line_price: p2.price,
              final_line_price: p2.price,
              options_with_values: [{ name: 'Metal', value: p2.metal }],
              discounts: [],
              properties: {},
            },
          ],
        },
        ...pageOverrides,
      };

      const headerGroupHtml = await renderTemplateGroup(
        engine,
        path.join(SECTIONS_DIR, 'header-group.json'),
        globalContext
      );
      const mainContentHtml = await renderTemplateGroup(
        engine,
        path.join(TEMPLATES_DIR, templateJsonFile),
        globalContext
      );
      const footerGroupHtml = await renderTemplateGroup(
        engine,
        path.join(SECTIONS_DIR, 'footer-group.json'),
        globalContext
      );

      // Render layout/theme.liquid
      const rawLayout = fs.readFileSync(path.join(THEME_ROOT, 'layout/theme.liquid'), 'utf8');
      const processedLayout = preprocessShopifyLiquid(rawLayout)
        .replace(/\{%-?\s*sections\s+['"]header-group['"]\s*-?%\}/g, '{{ __header_group_html }}')
        .replace(/\{%-?\s*sections\s+['"]footer-group['"]\s*-?%\}/g, '{{ __footer_group_html }}');

      const customFontsCss = `
        <style>
          @font-face {
            font-family: 'Begum';
            src: url('/assets/BegumRegular.woff2') format('woff2');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Begum';
            src: url('/assets/BegumMedium.woff2') format('woff2');
            font-weight: 500;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Begum';
            src: url('/assets/BegumSemibold.woff2') format('woff2');
            font-weight: 600;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Begum';
            src: url('/assets/BegumBold.woff2') format('woff2');
            font-weight: 700;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Gotham';
            src: url('/assets/GothamBook.woff2') format('woff2');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Gotham';
            src: url('/assets/GothamMedium.woff2') format('woff2');
            font-weight: 500;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Battlemade';
            src: url('/assets/BattlemadeRegular.woff2') format('woff2');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
        </style>
        <script>
          window.Shopify = window.Shopify || {
            shop: 'i1dtfi-iv.myshopify.com',
            locale: 'en',
            currency: { active: 'INR', rate: '1.0' },
            theme: { name: 'Mangal Royal Studio (Dawn 15.5.0)', id: 1, role: 'main' },
            designMode: false
          };
          // Seed sample wishlist items if empty so /pages/wishlist can be visually inspected immediately
          try {
            if (!localStorage.getItem('mrs_wishlist_v1')) {
              localStorage.setItem('mrs_wishlist_v1', JSON.stringify([
                {
                  id: 8901001,
                  variantId: 890100101,
                  handle: 'royal-celeste-solitaire-ring',
                  title: 'Royal Celeste Solitaire Diamond Ring',
                  url: '/products/royal-celeste-solitaire-ring',
                  image: '${resolveImageUrl(p0.featured_image)}',
                  price: 'Rs. 68,500.00',
                  compareAtPrice: 'Rs. 76,000.00',
                  available: true
                },
                {
                  id: 8901002,
                  variantId: 890100201,
                  handle: 'maharani-heritage-diamond-earrings',
                  title: 'Maharani Heritage Diamond Drop Earrings',
                  url: '/products/maharani-heritage-diamond-earrings',
                  image: '${resolveImageUrl(p1.featured_image)}',
                  price: 'Rs. 84,200.00',
                  compareAtPrice: 'Rs. 92,000.00',
                  available: true
                }
              ]));
            }
          } catch (e) {}
        </script>
      `;

      const fullHtml = await engine.parseAndRender(processedLayout, {
        ...globalContext,
        content_for_header: customFontsCss,
        __header_group_html: headerGroupHtml,
        content_for_layout: mainContentHtml,
        __footer_group_html: `${footerGroupHtml}\n${buildPreviewToolbarHtml(req.path, templateJsonFile)}`,
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(fullHtml);
    } catch (err) {
      const message = err instanceof Error ? err.stack || err.message : String(err);
      res.status(500).send(`<pre>Storefront Render Error:\n${message}</pre>`);
    }
  }

  // 1. Homepage
  app.get('/', (req, res) =>
    renderStorefrontPage(req, res, 'index.json', 'index', 'Mangal Royal Studio — Lab-Grown Diamond Fine Jewellery')
  );

  // 2. Collections
  app.get('/collections', (req, res) =>
    renderStorefrontPage(req, res, 'list-collections.json', 'list-collections', 'Collections — Mangal Royal Studio')
  );

  app.get('/collections/:handle', (req, res) => {
    const handle = req.params.handle.toLowerCase();
    const collection = SAMPLE_COLLECTIONS[handle] || {
      ...SAMPLE_COLLECTIONS.all,
      handle,
      title: handle.charAt(0).toUpperCase() + handle.slice(1).replace(/-/g, ' '),
    };
    return renderStorefrontPage(req, res, 'collection.json', 'collection', `${collection.title} — Mangal Royal Studio`, {
      collection,
    });
  });

  // 3. Product Detail Page
  app.get('/products/:handle', (req, res) => {
    const handle = req.params.handle.toLowerCase();
    const product = SAMPLE_PRODUCTS.find((p) => p.handle === handle) || SAMPLE_PRODUCTS[0]!;
    return renderStorefrontPage(req, res, 'product.json', 'product', `${product.title} — Mangal Royal Studio`, {
      product,
      collection: SAMPLE_COLLECTIONS.all,
    });
  });

  // 4. Custom Pages (About Us, Wishlist, Order Tracking, Contact, Policies)
  app.get('/pages/about-us', (req, res) =>
    renderStorefrontPage(req, res, 'page.about-us.json', 'page.about-us', 'About Us — Mangal Royal Studio', {
      page: {
        title: 'About Mangal Royal Studio',
        handle: 'about-us',
        url: '/pages/about-us',
        content: '',
      },
    })
  );

  app.get('/pages/wishlist', (req, res) =>
    renderStorefrontPage(req, res, 'page.wishlist.json', 'page.wishlist', 'My Wishlist — Mangal Royal Studio', {
      page: {
        title: 'My Wishlist',
        handle: 'wishlist',
        url: '/pages/wishlist',
        content: '',
      },
    })
  );

  app.get('/pages/order-tracking', (req, res) =>
    renderStorefrontPage(req, res, 'page.order-tracking.json', 'page.order-tracking', 'Track Your Order — Mangal Royal Studio', {
      page: {
        title: 'Track Your Order',
        handle: 'order-tracking',
        url: '/pages/order-tracking',
        content: '',
      },
    })
  );

  app.get('/pages/contact', (req, res) =>
    renderStorefrontPage(req, res, 'page.contact.json', 'page.contact', 'Contact Us — Mangal Royal Studio', {
      page: {
        title: 'Contact Mangal Royal Studio',
        handle: 'contact',
        url: '/pages/contact',
        content:
          '<p>Visit our flagship studio at <strong>Ground Floor, Shreejikrupa Building, 11th Khetwadi Lane, Grant Road East, Mumbai – 400004</strong> or reach out to our jewellery concierge below.</p>',
      },
    })
  );

  app.get('/pages/:handle', (req, res) => {
    const title = req.params.handle
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return renderStorefrontPage(req, res, 'page.json', 'page', `${title} — Mangal Royal Studio`, {
      page: {
        title,
        handle: req.params.handle,
        url: req.path,
        content: `<p>Official ${title} information for Mangal Royal Studio (A Luxury Venture by Mangal Group).</p>`,
      },
    });
  });

  // 5. Cart Page
  app.get('/cart', (req, res) =>
    renderStorefrontPage(req, res, 'cart.json', 'cart', 'Your Shopping Bag — Mangal Royal Studio')
  );

  // 6. Search Page
  app.get('/search', (req, res) => {
    const query = String(req.query.q || 'diamond');
    return renderStorefrontPage(req, res, 'search.json', 'search', `Search: "${query}" — Mangal Royal Studio`, {
      search: {
        performed: true,
        terms: query,
        results_count: SAMPLE_PRODUCTS.length,
        results: SAMPLE_PRODUCTS.map((p) => ({ ...p, object_type: 'product' })),
        types: ['product'],
        filters: [],
        sort_by: 'relevance',
        default_sort_by: 'relevance',
        sort_options: [{ value: 'relevance', name: 'Relevance' }],
      },
    });
  });

  // 7. 404 & Password Pages
  app.get('/404', (req, res) =>
    renderStorefrontPage(req, res, '404.json', '404', '404 Not Found — Mangal Royal Studio')
  );

  app.get('/password', (req, res) =>
    renderStorefrontPage(req, res, 'password.json', 'password', 'Opening Soon — Mangal Royal Studio')
  );

  app.use((req, res) =>
    renderStorefrontPage(req, res, '404.json', '404', '404 Not Found — Mangal Royal Studio')
  );

  return app;
}

async function startServer() {
  const app = createStorefrontPreviewApp();

  if (process.argv.includes('--verify')) {
    const routes = [
      '/',
      '/collections/all',
      '/collections/ring',
      '/products/royal-celeste-solitaire-ring',
      '/cart',
      '/search?q=diamond',
      '/pages/wishlist',
      '/pages/about-us',
      '/pages/order-tracking',
      '/pages/contact',
      '/404',
    ];
    for (const r of routes) {
      const [pathPart, queryPart] = r.split('?');
      const query: Record<string, string> = {};
      if (queryPart) {
        for (const pair of queryPart.split('&')) {
          const [k, v] = pair.split('=');
          if (k) query[k] = v || '';
        }
      }
      await new Promise<void>((resolve) => {
        let statusCode = 200;
        const reqMock = {
          method: 'GET',
          url: r,
          originalUrl: r,
          path: pathPart,
          query,
          headers: {},
        } as unknown as express.Request;
        const resMock = {
          setHeader: () => resMock,
          status: (code: number) => {
            statusCode = code;
            return resMock;
          },
          send: (body: string) => {
            const warnMatches = (body || '').match(/data-render-warning="([^"]+)"/g) || [];
            console.log(`[Verify] ${r} -> HTTP ${statusCode} (${body.length} bytes) warnings=${warnMatches.length}`);
            if (r === '/') {
              const bStart = body.indexOf('id="shopify-section-featured_collection_rFm8fg"');
              const bEnd = body.indexOf('</section>', bStart);
              const bSection = body.slice(bStart, bEnd);
              const imgSrcs = Array.from(bSection.matchAll(/<img[^>]+src="([^"]+)"/g)).map((m) => m[1]);
              console.log(`[Verify] Bestsellers section rendered ${imgSrcs.length} <img> elements (8 main + 8 hover):`);
              for (const src of imgSrcs.slice(0, 8)) {
                console.log(`   - ${src}`);
              }
            }
            for (const w of warnMatches) {
              console.log(`   ${w}`);
            }
            resolve();
          },
        } as unknown as express.Response;
        (app as unknown as { handle: (req: unknown, res: unknown, next: () => void) => void }).handle(
          reqMock,
          resMock,
          () => resolve()
        );
      });
    }
    return;
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[StorefrontPreview] Mangal Royal Studio Shopify Liquid Theme server running at http://127.0.0.1:${PORT}`);
    console.log(`[StorefrontPreview] Theme directory: ${THEME_ROOT}`);
  });
}

startServer().catch((err) => {
  console.error('[StorefrontPreview] Fatal error:', err);
  process.exit(1);
});
