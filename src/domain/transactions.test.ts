import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyFilterPatch, emptyFilters, filterTransactions, mergeTransactionPages, paginateTransactions } from './transactions';
import type { Transaction } from './types';

function transaction(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    reference: `REF-${id}`,
    amountMinor: 10_000,
    currency: 'NGN',
    type: 'debit',
    status: 'successful',
    description: 'Transfer to merchant',
    createdAt: '2026-10-15T12:30:00.000Z',
    ...overrides,
  };
}

describe('transaction filtering', () => {
  const items = [
    transaction('a', { description: 'Transfer to merchant', reference: 'WAYVE-1', type: 'debit', status: 'successful', createdAt: '2026-10-15T12:30:00.000Z' }),
    transaction('b', { description: 'Salary credit', reference: 'WAYVE-2', type: 'credit', status: 'pending', createdAt: '2026-10-10T12:30:00.000Z' }),
    transaction('c', { description: 'Failed transfer', reference: 'WAYVE-3', type: 'debit', status: 'failed', createdAt: '2026-09-01T12:30:00.000Z' }),
  ];

  it('combines search, type, status, and date instead of replacing them', () => {
    const filters = applyFilterPatch(applyFilterPatch(emptyFilters(), { search: 'transfer', type: 'debit' }), { status: 'successful' });
    assert.deepEqual(filters, {
      search: 'transfer',
      type: 'debit',
      status: 'successful',
      from: null,
      to: null,
    });
    const matched = filterTransactions(items, { search: filters.search, type: 'debit', status: 'successful' });
    assert.deepEqual(matched.map((item) => item.id), ['a']);
  });

  it('filters an inclusive WAT date range', () => {
    const matched = filterTransactions(items, { from: '2026-10-10', to: '2026-10-15' });
    assert.deepEqual(matched.map((item) => item.id), ['a', 'b']);
  });
});

describe('duplicate pagination', () => {
  it('keeps one row and the original order when the next page repeats an id', () => {
    const first = [transaction('txn_1'), transaction('txn_2')];
    const second = paginateTransactions(
      [transaction('txn_1'), transaction('txn_2'), transaction('txn_3', { description: 'Later' })],
      2,
      2,
      { duplicatePreviousTail: true },
    );
    assert.equal(second.items[0]?.id, 'txn_2');
    const merged = mergeTransactionPages([first, second.items]);
    assert.deepEqual(merged.map((item) => item.id), ['txn_1', 'txn_2', 'txn_3']);
  });

  it('lets a later page refresh status without moving the row', () => {
    const merged = mergeTransactionPages([
      [transaction('txn_1', { status: 'pending' }), transaction('txn_2')],
      [transaction('txn_1', { status: 'successful' })],
    ]);
    assert.equal(merged[0]?.status, 'successful');
    assert.deepEqual(merged.map((item) => item.id), ['txn_1', 'txn_2']);
  });
});
