import { ApiError } from '../domain/errors';
import type {
  Account,
  Bank,
  ResolvedAccount,
  Transaction,
  TransactionPage,
  TransactionStatus,
  TransactionType,
  TransferReceipt,
} from '../domain/types';

export function parseAccount(value: unknown): Account {
  const record = expectRecord(value);
  return {
    accountId: expectString(record, 'accountId'),
    accountNumber: expectString(record, 'accountNumber'),
    accountName: expectString(record, 'accountName'),
    currency: expectString(record, 'currency'),
    availableBalanceMinor: expectMinor(record, 'availableBalanceMinor'),
  };
}

export function parseTransaction(value: unknown): Transaction {
  const record = expectRecord(value);
  const fee = record.feeMinor;
  const narration = record.narration;
  const counterparty = record.counterparty;
  return {
    id: expectString(record, 'id'),
    reference: expectString(record, 'reference'),
    amountMinor: expectMinor(record, 'amountMinor'),
    currency: expectString(record, 'currency'),
    type: expectUnion(record, 'type', ['credit', 'debit'] as const),
    status: expectUnion(record, 'status', ['pending', 'successful', 'failed', 'reversed'] as const),
    description: expectString(record, 'description'),
    createdAt: expectIso(record, 'createdAt'),
    ...(typeof fee === 'number' ? { feeMinor: expectMinor(record, 'feeMinor') } : {}),
    ...(typeof narration === 'string' ? { narration } : {}),
    ...(counterparty ? { counterparty: parseCounterparty(counterparty) } : {}),
  };
}

export function parseTransactionPage(value: unknown): TransactionPage {
  const record = expectRecord(value);
  if (!Array.isArray(record.items)) {
    throw new ApiError('MALFORMED_RESPONSE', 200);
  }
  return {
    items: record.items.map((item) => parseTransaction(item)),
    page: expectPositiveInt(record, 'page'),
    limit: expectPositiveInt(record, 'limit'),
    total: expectNonNegativeInt(record, 'total'),
    hasMore: expectBoolean(record, 'hasMore'),
  };
}

export function parseBanks(value: unknown): Bank[] {
  if (!Array.isArray(value)) {
    throw new ApiError('MALFORMED_RESPONSE', 200);
  }
  return value.map((item) => {
    const record = expectRecord(item);
    return { code: expectString(record, 'code'), name: expectString(record, 'name') };
  });
}

export function parseResolvedAccount(value: unknown): ResolvedAccount {
  const record = expectRecord(value);
  return {
    accountName: expectString(record, 'accountName'),
    bankCode: expectString(record, 'bankCode'),
    bankName: expectString(record, 'bankName'),
    accountNumber: expectString(record, 'accountNumber'),
  };
}

export function parseTransferReceipt(value: unknown): TransferReceipt {
  const record = expectRecord(value);
  return {
    transactionId: expectString(record, 'transactionId'),
    reference: expectString(record, 'reference'),
    status: expectUnion(record, 'status', ['pending', 'successful', 'failed', 'reversed'] as const),
    amountMinor: expectMinor(record, 'amountMinor'),
    feeMinor: expectMinor(record, 'feeMinor'),
    totalDebitMinor: expectMinor(record, 'totalDebitMinor'),
    currency: expectString(record, 'currency'),
    idempotencyKey: expectString(record, 'idempotencyKey'),
  };
}

function parseCounterparty(value: unknown): Transaction['counterparty'] {
  const record = expectRecord(value);
  const bankCode = record.bankCode;
  const bankName = record.bankName;
  return {
    role: expectUnion(record, 'role', ['sender', 'recipient'] as const),
    accountName: expectString(record, 'accountName'),
    accountNumber: expectString(record, 'accountNumber'),
    ...(typeof bankCode === 'string' ? { bankCode } : {}),
    ...(typeof bankName === 'string' ? { bankName } : {}),
  };
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('MALFORMED_RESPONSE', 200);
  }
  return value as Record<string, unknown>;
}

function expectString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError('MALFORMED_RESPONSE', 200);
  }
  return value;
}

function expectMinor(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new ApiError('MALFORMED_RESPONSE', 200);
  }
  return value;
}

function expectBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new ApiError('MALFORMED_RESPONSE', 200);
  }
  return value;
}

function expectPositiveInt(record: Record<string, unknown>, key: string): number {
  const value = expectMinor(record, key);
  if (value <= 0) {
    throw new ApiError('MALFORMED_RESPONSE', 200);
  }
  return value;
}

function expectNonNegativeInt(record: Record<string, unknown>, key: string): number {
  const value = expectMinor(record, key);
  if (value < 0) {
    throw new ApiError('MALFORMED_RESPONSE', 200);
  }
  return value;
}

function expectIso(record: Record<string, unknown>, key: string): string {
  const value = expectString(record, key);
  if (Number.isNaN(Date.parse(value))) {
    throw new ApiError('MALFORMED_RESPONSE', 200);
  }
  return value;
}

function expectUnion<T extends string>(record: Record<string, unknown>, key: string, allowed: readonly T[]): T {
  const value = record[key];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ApiError('MALFORMED_RESPONSE', 200);
  }
  return value as T;
}

export function isTransactionType(value: string): value is TransactionType {
  return value === 'credit' || value === 'debit';
}

export function isTransactionStatus(value: string): value is TransactionStatus {
  return value === 'pending' || value === 'successful' || value === 'failed' || value === 'reversed';
}
