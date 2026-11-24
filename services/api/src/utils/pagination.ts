export interface PaginationOptions<T> {
  page?: number | string;
  pageSize?: number | string;
  limit?: number | string;
  search?: string;
  searchFields?: Array<(item: T) => string | undefined | null>;
  filterFn?: (item: T) => boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  sortDirection?: 'asc' | 'desc';
  sortMap?: Record<string, (a: T, b: T) => number>;
  maxPageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginateList<T>(items: T[], options: PaginationOptions<T> = {}): PaginatedResult<T> {
  let filtered = [...items];

  // 1. Filter
  if (options.filterFn) {
    filtered = filtered.filter(options.filterFn);
  }

  // 2. Search
  if (options.search && options.searchFields && options.searchFields.length > 0) {
    const term = options.search.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter((item) =>
        options.searchFields!.some((extractor) => {
          const val = extractor(item);
          return val ? val.toLowerCase().includes(term) : false;
        })
      );
    }
  }

  // 3. Sort
  if (options.sortBy && options.sortMap && options.sortMap[options.sortBy]) {
    const comparator = options.sortMap[options.sortBy]!;
    const direction = options.sortDirection || options.sortOrder || 'desc';
    const isAsc = direction.toLowerCase() === 'asc';
    filtered.sort((a, b) => (isAsc ? comparator(a, b) : -comparator(a, b)));
  }

  // 4. Paginate
  const page = Math.max(1, Number(options.page) || 1);
  const maxPageSize = Math.max(1, options.maxPageSize ?? 100);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(options.pageSize || options.limit) || 25));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;
  const paginatedItems = filtered.slice(offset, offset + pageSize);

  return {
    items: paginatedItems,
    page,
    pageSize,
    total,
    totalPages,
  };
}
