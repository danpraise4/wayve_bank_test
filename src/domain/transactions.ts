import { watDayBounds } from './dates';
import type { Transaction, TransactionPage, TransactionStatus, TransactionType } from './types';

export interface TransactionFilters {
  search: string;
  type: TransactionType | 'all';
  status: TransactionStatus | 'all';
  from: string | null;
  to: string | null;
}

export function emptyFilters(): TransactionFilters {
  return { search: '', type: 'all', status: 'all', from: null, to: null };
}

/** Filters combine. Any change other than an explicit page load starts again at page 1. */
export function applyFilterPatch(
  current: TransactionFilters,
  patch: Partial<TransactionFilters>,
): TransactionFilters {
  return { ...current, ...patch };
}

export function filterTransactions(
  items: readonly Transaction[],
  filters: {
    search?: string;
    type?: TransactionType;
    status?: TransactionStatus;
    from?: string | null;
    to?: string | null;
  },
): Transaction[] {
  const search = filters.search?.trim().toLowerCase() ?? '';
  const fromMs = filters.from ? boundStart(filters.from) : null;
  const toMs = filters.to ? boundEnd(filters.to) : null;

  return items.filter((item) => {
    if (filters.type && item.type !== filters.type) {
      return false;
    }
    if (filters.status && item.status !== filters.status) {
      return false;
    }
    if (search) {
      const haystack = `${item.description} ${item.reference}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    const createdMs = Date.parse(item.createdAt);
    if (fromMs !== null && createdMs < fromMs) {
      return false;
    }
    if (toMs !== null && createdMs > toMs) {
      return false;
    }
    return true;
  });
}

export function paginateTransactions(
  items: readonly Transaction[],
  page: number,
  limit: number,
  options?: { duplicatePreviousTail?: boolean },
): TransactionPage {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
  const start = (safePage - 1) * safeLimit;
  const window = items.slice(start, start + safeLimit);
  let pageItems = window;

  if (options?.duplicatePreviousTail && safePage > 1 && start > 0) {
    const previous = items[start - 1];
    if (previous && !window.some((item) => item.id === previous.id)) {
      pageItems = [previous, ...window];
    }
  }

  return {
    items: pageItems,
    page: safePage,
    limit: safeLimit,
    total: items.length,
    hasMore: start + safeLimit < items.length,
  };
}

/**
 * Pages may repeat an id. Keep the first position so ordering stays stable,
 * and let a later copy refresh fields such as status.
 */
export function mergeTransactionPages(pages: readonly (readonly Transaction[])[]): Transaction[] {
  const order: string[] = [];
  const byId = new Map<string, Transaction>();

  for (const page of pages) {
    for (const item of page) {
      if (!byId.has(item.id)) {
        order.push(item.id);
      }
      byId.set(item.id, item);
    }
  }

  return order.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

function boundStart(day: string): number | null {
  const bounds = watDayBounds(day);
  return bounds ? Date.parse(bounds.startIso) : null;
}

function boundEnd(day: string): number | null {
  const bounds = watDayBounds(day);
  return bounds ? Date.parse(bounds.endIso) : null;
}
