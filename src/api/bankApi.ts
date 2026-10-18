import { ApiError } from '../domain/errors';
import type { TransactionFilters } from '../domain/transactions';
import type { TransferDraft } from '../domain/transferMachine';
import type { TransferReceipt } from '../domain/types';
import { requestJson } from './http';
import {
  parseAccount,
  parseBanks,
  parseResolvedAccount,
  parseTransaction,
  parseTransactionPage,
  parseTransferReceipt,
} from './parse';

export interface BankApi {
  getAccount(signal?: AbortSignal): Promise<ReturnType<typeof parseAccount>>;
  listTransactions(filters: TransactionFilters & { page: number; limit: number }, signal?: AbortSignal): Promise<ReturnType<typeof parseTransactionPage>>;
  getTransaction(id: string, signal?: AbortSignal): Promise<ReturnType<typeof parseTransaction>>;
  listBanks(signal?: AbortSignal): Promise<ReturnType<typeof parseBanks>>;
  resolveAccount(input: { bankCode: string; accountNumber: string }, signal?: AbortSignal): Promise<ReturnType<typeof parseResolvedAccount>>;
  createTransfer(draft: TransferDraft, idempotencyKey: string, signal?: AbortSignal): Promise<TransferReceipt>;
  findTransfer(idempotencyKey: string, signal?: AbortSignal): Promise<TransferReceipt | null>;
  noteSessionRestored(): void;
}

export function createBankApi(options: {
  baseUrl: string;
  getToken: () => string | null;
  getScenario?: () => string | null;
  timeoutMs?: number;
  delayMs?: number;
  onSessionExpired?: () => void;
  fetchImpl?: typeof fetch;
  log?: (event: { method: string; path: string; status?: number; code?: string }) => void;
}): BankApi {
  let sessionNotified = false;
  const timeoutMs = options.timeoutMs ?? 8_000;

  async function call(path: string, method: 'GET' | 'POST', body?: unknown, signal?: AbortSignal): Promise<unknown> {
    try {
      return await requestJson({
        baseUrl: options.baseUrl,
        path,
        method,
        token: options.getToken(),
        scenario: options.getScenario?.() ?? null,
        delayMs: options.delayMs,
        body,
        timeoutMs,
        signal,
        fetchImpl: options.fetchImpl,
        log: options.log,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && !sessionNotified) {
        sessionNotified = true;
        options.onSessionExpired?.();
      }
      throw error;
    }
  }

  return {
    noteSessionRestored() {
      sessionNotified = false;
    },
    async getAccount(signal) {
      return parseAccount(await call('/api/v1/account', 'GET', undefined, signal));
    },
    async listTransactions(filters, signal) {
      return parseTransactionPage(await call(transactionPath(filters), 'GET', undefined, signal));
    },
    async getTransaction(id, signal) {
      return parseTransaction(await call(`/api/v1/transactions/${encodeURIComponent(id)}`, 'GET', undefined, signal));
    },
    async listBanks(signal) {
      return parseBanks(await call('/api/v1/banks', 'GET', undefined, signal));
    },
    async resolveAccount(input, signal) {
      return parseResolvedAccount(
        await call(
          '/api/v1/transfers/resolve-account',
          'POST',
          { bankCode: input.bankCode, accountNumber: input.accountNumber },
          signal,
        ),
      );
    },
    async createTransfer(draft, idempotencyKey, signal) {
      return parseTransferReceipt(
        await call(
          '/api/v1/transfers',
          'POST',
          {
            recipientBankCode: draft.recipientBankCode,
            recipientAccountNumber: draft.recipientAccountNumber,
            amountMinor: draft.amountMinor,
            narration: draft.narration,
            idempotencyKey,
          },
          signal,
        ),
      );
    },
    async findTransfer(idempotencyKey, signal) {
      try {
        return parseTransferReceipt(
          await call(`/api/v1/transfers/by-idempotency/${encodeURIComponent(idempotencyKey)}`, 'GET', undefined, signal),
        );
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.code === 'TRANSFER_NOT_FOUND')) {
          return null;
        }
        throw error;
      }
    },
  };
}

function transactionPath(filters: TransactionFilters & { page: number; limit: number }): string {
  const params = new URLSearchParams();
  params.set('page', String(filters.page));
  params.set('limit', String(filters.limit));
  const search = filters.search.trim();
  if (search) {
    params.set('search', search);
  }
  if (filters.type !== 'all') {
    params.set('type', filters.type);
  }
  if (filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters.from) {
    params.set('from', filters.from);
  }
  if (filters.to) {
    params.set('to', filters.to);
  }
  return `/api/v1/transactions?${params.toString()}`;
}
