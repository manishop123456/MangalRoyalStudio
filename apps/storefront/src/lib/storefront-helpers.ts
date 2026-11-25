import type {
  CustomizationQuoteBreakdownLine,
  CustomizationSelectionSnapshotItem,
  JewelleryProductSpec,
} from '@mrs/shared';

export interface StorefrontCartItem {
  id: string;
  sku: string;
  handle: string;
  title: string;
  imageUrl: string;
  quantity: number;
  unitPriceInr: number;
  metalPurity: string;
  metalColor: string;
  ringSize: string;
  selections?: Record<string, string>;
  selectionSnapshot?: CustomizationSelectionSnapshotItem[];
  breakdownLines?: CustomizationQuoteBreakdownLine[];
  customerDesignId?: string;
}

export function buildCartItemId(params: {
  sku: string;
  metalPurity: string;
  metalColor: string;
  ringSize: string;
  selections?: Record<string, string>;
}): string {
  const selectionSig = params.selections
    ? `::${JSON.stringify(Object.entries(params.selections).sort(([a], [b]) => a.localeCompare(b)))}`
    : '';
  return `${params.sku}-${params.metalPurity}-${params.metalColor}-${params.ringSize}${selectionSig}`;
}

export function addItemToCart(
  cart: StorefrontCartItem[],
  product: JewelleryProductSpec,
  options?: {
    quantity?: number;
    metalPurity?: string;
    metalColor?: string;
    ringSize?: string;
    unitPriceInr?: number;
    fallbackImageUrl?: string;
    selections?: Record<string, string>;
    selectionSnapshot?: CustomizationSelectionSnapshotItem[];
    breakdownLines?: CustomizationQuoteBreakdownLine[];
    customerDesignId?: string;
  }
): StorefrontCartItem[] {
  const qty = Math.max(1, Math.floor(options?.quantity || 1));
  const purity = options?.metalPurity || product.metalPurity;
  const color = options?.metalColor || product.metalColor.replace('_', ' ');
  const ringSize = options?.ringSize || product.ringSize || '12';
  const isPriceOnRequest = Boolean(
    !options?.selections && (product.priceOnRequest || product.priceBreakup?.priceOnRequest)
  );
  if (isPriceOnRequest && !options?.unitPriceInr) {
    return cart;
  }
  const authoritativePrice = Number(
    product.priceBreakup?.finalProposedPriceInr ||
      product.effectivePriceInr ||
      product.currentShopifyPriceInr
  );
  const unitPrice = options?.unitPriceInr ?? authoritativePrice;
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return cart;
  }
  const itemId = buildCartItemId({
    sku: product.sku,
    metalPurity: purity,
    metalColor: color,
    ringSize,
    selections: options?.selections,
  });

  const existingIdx = cart.findIndex((c) => c.id === itemId);
  if (existingIdx >= 0) {
    return cart.map((item, idx) =>
      idx === existingIdx
        ? { ...item, quantity: item.quantity + qty, unitPriceInr: unitPrice }
        : item
    );
  }

  return [
    ...cart,
    {
      id: itemId,
      sku: product.sku,
      handle: product.handle,
      title: product.title,
      imageUrl: product.imageUrl || options?.fallbackImageUrl || '',
      quantity: qty,
      unitPriceInr: unitPrice,
      metalPurity: purity,
      metalColor: color,
      ringSize,
      selections: options?.selections,
      selectionSnapshot: options?.selectionSnapshot,
      breakdownLines: options?.breakdownLines,
      customerDesignId: options?.customerDesignId,
    },
  ];
}

export function updateCartItemQuantity(
  cart: StorefrontCartItem[],
  id: string,
  qty: number
): StorefrontCartItem[] {
  if (qty <= 0) {
    return cart.filter((item) => item.id !== id);
  }
  return cart.map((item) => (item.id === id ? { ...item, quantity: Math.floor(qty) } : item));
}

export function parseStoredCart(raw: string | null): StorefrontCartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StorefrontCartItem =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.sku === 'string' &&
        typeof item.handle === 'string' &&
        typeof item.title === 'string' &&
        typeof item.quantity === 'number' &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        typeof item.unitPriceInr === 'number' &&
        Number.isFinite(item.unitPriceInr) &&
        item.unitPriceInr >= 0
    );
  } catch {
    return [];
  }
}

export function toggleWishlistHandle(handles: string[], handle: string): string[] {
  const normalized = handle.trim();
  if (!normalized) return handles;
  if (handles.includes(normalized)) {
    return handles.filter((h) => h !== normalized);
  }
  return Array.from(new Set([...handles, normalized]));
}

export function filterAndSortProducts(
  products: JewelleryProductSpec[],
  options: {
    collectionHandle?: string;
    purity?: string;
    shape?: string;
    sortBy?: string;
    searchQuery?: string;
  }
): JewelleryProductSpec[] {
  const handle = (options.collectionHandle || 'all').toLowerCase();
  const purity = options.purity || 'ALL';
  const shape = (options.shape || 'ALL').toUpperCase();
  const q = (options.searchQuery || '').trim().toLowerCase();

  const list = products.filter((p) => {
    if (handle === 'best-sellers' && !p.isFeaturedBestseller) return false;
    const isPor = Boolean(p.priceOnRequest ?? p.priceBreakup?.priceOnRequest);
    if (isPor && ['under-15k', '15k-to-25k', '25k-to-50k', '50k-and-above'].includes(handle)) return false;
    if (handle === 'under-15k' && Number(p.currentShopifyPriceInr) >= 15000) return false;
    if (handle === '15k-to-25k') {
      const pr = Number(p.currentShopifyPriceInr);
      if (pr < 15000 || pr > 25000) return false;
    }
    if (handle === '25k-to-50k') {
      const pr = Number(p.currentShopifyPriceInr);
      if (pr < 25000 || pr > 50000) return false;
    }
    if (handle === '50k-and-above' && Number(p.currentShopifyPriceInr) < 50000) return false;
    if (
      !['all', 'best-sellers', 'under-15k', '15k-to-25k', '25k-to-50k', '50k-and-above'].includes(
        handle
      )
    ) {
      if (p.category.toLowerCase().replace(/\s+/g, '-') !== handle) return false;
    }

    if (purity !== 'ALL' && p.metalPurity !== purity) return false;
    if (shape !== 'ALL' && !p.diamondComponents.some((d) => d.shape.toUpperCase() === shape)) {
      return false;
    }

    if (q) {
      const matches =
        p.title.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.metalPurity.toLowerCase().includes(q);
      if (!matches) return false;
    }

    return true;
  });

  if (options.sortBy === 'price-asc') {
    list.sort((a, b) => Number(a.currentShopifyPriceInr) - Number(b.currentShopifyPriceInr));
  } else if (options.sortBy === 'price-desc') {
    list.sort((a, b) => Number(b.currentShopifyPriceInr) - Number(a.currentShopifyPriceInr));
  } else if (options.sortBy === 'title-asc') {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  return list;
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; totalPages: number; currentPage: number } {
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((currentPage - 1) * safeSize, currentPage * safeSize),
    totalPages,
    currentPage,
  };
}

export function validateCheckoutInput(input: {
  fullName: string;
  email: string;
  phone: string;
  line1: string;
  city: string;
  stateName: string;
  pincode: string;
  itemCount: number;
}): { ok: true } | { ok: false; message: string } {
  if (input.itemCount <= 0) {
    return { ok: false, message: 'Your shopping bag is empty.' };
  }
  if (!input.fullName.trim()) {
    return { ok: false, message: 'Full name is required for insured jewellery delivery.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }
  if (!/^\+?[0-9\s-]{8,15}$/.test(input.phone.trim())) {
    return { ok: false, message: 'Please enter a valid contact phone number.' };
  }
  if (!input.line1.trim() || !input.city.trim() || !input.stateName.trim()) {
    return { ok: false, message: 'Complete street address, city, and state are required.' };
  }
  if (!/^[0-9]{6}$/.test(input.pincode.trim())) {
    return { ok: false, message: 'Please enter a valid 6-digit Indian PIN code.' };
  }
  return { ok: true };
}
