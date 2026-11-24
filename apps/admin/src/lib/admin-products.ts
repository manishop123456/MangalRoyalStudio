export interface AdminProductFilterable {
  sku: string;
  title: string;
  category?: string | null;
  status?: string | null;
  calculatedPriceInr?: string | null;
  priceBreakup?: {
    isPriceOnRequest?: boolean;
  } | null;
}

export interface AdminProductFilterOptions {
  search?: string;
  category?: string;
  status?: string;
}

export function isProductPriceOnRequest(product: AdminProductFilterable): boolean {
  return Boolean(product.priceBreakup?.isPriceOnRequest) || !product.calculatedPriceInr;
}

export function filterAdminProducts<T extends AdminProductFilterable>(
  products: T[],
  options: AdminProductFilterOptions
): T[] {
  const search = (options.search || '').trim().toLowerCase();
  const category = (options.category || '').trim().toLowerCase();
  const status = (options.status || '').trim().toUpperCase();

  return products.filter((p) => {
    if (
      search &&
      !p.sku.toLowerCase().includes(search) &&
      !p.title.toLowerCase().includes(search)
    ) {
      return false;
    }
    if (category && (p.category || '').toLowerCase() !== category) {
      return false;
    }
    if (status === 'PRICE_ON_REQUEST') {
      return isProductPriceOnRequest(p);
    }
    if (status && (p.status || 'ACTIVE').toUpperCase() !== status) {
      return false;
    }
    return true;
  });
}
