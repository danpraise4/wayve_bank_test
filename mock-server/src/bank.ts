import { calculateFeeMinor } from '../../src/domain/policy';
import { addMinor } from '../../src/domain/money';
import { filterTransactions, paginateTransactions } from '../../src/domain/transactions';
import type { Bank, Transaction, TransactionStatus } from '../../src/domain/types';

export const DEMO_TOKEN = 'demo-session-token';
export const OPENING_BALANCE_MINOR = 25_000_000;

export const BANKS: Bank[] = [
  { code: '000001', name: 'Wayve Microfinance Bank' },
  { code: '000013', name: 'GTBank' },
  { code: '000014', name: 'Access Bank' },
  { code: '000015', name: 'Zenith Bank' },
  { code: '000016', name: 'UBA' },
  { code: '000017', name: 'First Bank' },
];

export const ACCOUNT_DIRECTORY: Record<string, string> = {
  '000013:1029384756': 'Chinedu Adeyemi',
  '000014:5647382910': 'Fatima Bello',
  '000015:9081726354': 'John Okon',
  '000016:1122334455': 'Ngozi Eze',
  '000017:9988776655': 'Ibrahim Musa',
  '000001:1234567890': 'Kunle Balogun',
  '000001:0123456789': 'Ada Okafor',
};

export const CUSTOMER = {
  accountId: 'acc_001',
  accountNumber: '0123456789',
  accountName: 'Ada Okafor',
  currency: 'NGN',
};

const SPECS: readonly (readonly [string, Transaction['type'], TransactionStatus, number])[] = [
  ['Transfer to merchant', 'debit', 'successful', 250_000],
  ['Salary credit', 'credit', 'successful', 4_500_000],
  ['POS purchase merchant', 'debit', 'successful', 185_000],
  ['Transfer to John Okon', 'debit', 'successful', 5_000_000],
  ['Inbound transfer', 'credit', 'successful', 750_000],
  ['Merchant settlement', 'credit', 'successful', 320_000],
  ['ATM withdrawal', 'debit', 'failed', 2_000_000],
  ['Airtime purchase', 'debit', 'successful', 100_000],
  ['Reversed card payment', 'debit', 'reversed', 640_000],
  ['Pending bill payment', 'debit', 'pending', 450_000],
  ['Transfer from Ngozi Eze', 'credit', 'successful', 1_250_000],
  ['Grocery merchant', 'debit', 'successful', 89_050],
  ['Failed transfer attempt', 'debit', 'failed', 300_000],
  ['Interest credit', 'credit', 'successful', 25_000],
  ['School fees transfer', 'debit', 'successful', 8_000_000],
  ['Refund from merchant', 'credit', 'reversed', 220_000],
  ['Fuel purchase', 'debit', 'successful', 310_000],
  ['Standing transfer', 'debit', 'pending', 1_000_000],
  ['Dividend credit', 'credit', 'successful', 880_000],
  ['Pharmacy merchant', 'debit', 'successful', 142_500],
  ['Rent transfer', 'debit', 'successful', 12_000_000],
  ['Cash deposit', 'credit', 'successful', 5_000_000],
  ['Chargeback reversed', 'credit', 'reversed', 410_000],
  ['Weekend transfer', 'debit', 'successful', 275_000],
];

export function buildSeedTransactions(): Transaction[] {
  const newest = Date.parse('2026-10-17T16:00:00.000Z');
  const seeded = SPECS.map((spec, index): Transaction => {
    const [description, type, status, amountMinor] = spec;
    const feeMinor = type === 'debit' && status !== 'failed' ? calculateFeeMinor(amountMinor) : undefined;
    return {
      id: `txn_${String(index + 1).padStart(3, '0')}`,
      reference: `WAYVE-2026-${String(index + 1).padStart(4, '0')}`,
      amountMinor,
      currency: 'NGN',
      type,
      status,
      description,
      createdAt: new Date(newest - index * 36 * 60 * 60 * 1000).toISOString(),
      ...(feeMinor !== undefined ? { feeMinor } : {}),
      counterparty:
        type === 'debit'
          ? {
              role: 'recipient',
              accountName: 'Chinedu Adeyemi',
              accountNumber: '1029384756',
              bankCode: '000013',
              bankName: 'GTBank',
            }
          : {
              role: 'sender',
              accountName: 'Ngozi Eze',
              accountNumber: '1122334455',
              bankCode: '000016',
              bankName: 'UBA',
            },
    };
  });

  seeded.unshift({
    id: 'txn_status_watch',
    reference: 'WAYVE-2026-WATCH',
    amountMinor: 150_000,
    currency: 'NGN',
    type: 'debit',
    status: 'pending',
    description: 'Status watch demo',
    createdAt: '2026-10-17T18:30:00.000Z',
    feeMinor: calculateFeeMinor(150_000),
    narration: 'Status transition fixture',
    counterparty: {
      role: 'recipient',
      accountName: 'Fatima Bello',
      accountNumber: '5647382910',
      bankCode: '000014',
      bankName: 'Access Bank',
    },
  });

  return seeded;
}

export interface StoredTransfer {
  receipt: {
    transactionId: string;
    reference: string;
    status: TransactionStatus;
    amountMinor: number;
    feeMinor: number;
    totalDebitMinor: number;
    currency: 'NGN';
    idempotencyKey: string;
  };
  bodyKey: string;
  reads: number;
  promoteAfterReads: number | null;
  transaction: Transaction;
}

export interface BankState {
  balanceMinor: number;
  transactions: Transaction[];
  transfers: Map<string, StoredTransfer>;
  /** HTTP POSTs received, including idempotent replays. */
  transferHttpPosts: number;
  detailReads: Map<string, number>;
  sequence: number;
}

export function createBankState(): BankState {
  return {
    balanceMinor: OPENING_BALANCE_MINOR,
    transactions: buildSeedTransactions(),
    transfers: new Map(),
    transferHttpPosts: 0,
    detailReads: new Map(),
    sequence: 1,
  };
}

export function listTransactions(state: BankState, query: URLSearchParams, duplicatePage: boolean) {
  const type = query.get('type');
  const status = query.get('status');
  const filtered = filterTransactions(state.transactions, {
    search: query.get('search') ?? '',
    type: type === 'credit' || type === 'debit' ? type : undefined,
    status: status === 'pending' || status === 'successful' || status === 'failed' || status === 'reversed' ? status : undefined,
    from: query.get('from'),
    to: query.get('to'),
  });
  const page = Number(query.get('page') ?? '1');
  const limit = Number(query.get('limit') ?? '10');
  return paginateTransactions(filtered, page, limit, { duplicatePreviousTail: duplicatePage });
}

export function readTransaction(state: BankState, id: string): Transaction | null {
  const index = state.transactions.findIndex((item) => item.id === id);
  if (index < 0) {
    return null;
  }
  const current = state.transactions[index];
  if (!current) {
    return null;
  }
  if (current.id === 'txn_status_watch') {
    const reads = (state.detailReads.get(current.id) ?? 0) + 1;
    state.detailReads.set(current.id, reads);
    if (reads >= 2 && current.status === 'pending') {
      const updated: Transaction = { ...current, status: 'successful' };
      state.transactions[index] = updated;
      return updated;
    }
  }
  return current;
}

export interface TransferCommand {
  recipientBankCode: string;
  recipientAccountNumber: string;
  amountMinor: number;
  narration: string;
  idempotencyKey: string;
}

export type TransferDecision =
  | { type: 'invalid' }
  | { type: 'conflict' }
  | { type: 'rejected'; code: 'INSUFFICIENT_FUNDS' | 'TRANSFER_REJECTED' | 'INVALID_ACCOUNT' }
  | { type: 'ready'; stored: StoredTransfer; created: boolean };

export function decideTransfer(state: BankState, command: TransferCommand, scenario: string | null): TransferDecision {
  if (
    !command.idempotencyKey ||
    !/^\d{6}$/.test(command.recipientBankCode) ||
    !/^\d{10}$/.test(command.recipientAccountNumber) ||
    !Number.isSafeInteger(command.amountMinor) ||
    command.amountMinor <= 0
  ) {
    return { type: 'invalid' };
  }

  const bodyKey = `${command.recipientBankCode}|${command.recipientAccountNumber}|${command.amountMinor}|${command.narration}`;
  const existing = state.transfers.get(command.idempotencyKey);
  if (existing) {
    if (existing.bodyKey !== bodyKey) {
      return { type: 'conflict' };
    }
    return { type: 'ready', stored: existing, created: false };
  }

  if (scenario === 'reject') {
    return { type: 'rejected', code: 'TRANSFER_REJECTED' };
  }

  const bank = BANKS.find((item) => item.code === command.recipientBankCode);
  const accountName = ACCOUNT_DIRECTORY[`${command.recipientBankCode}:${command.recipientAccountNumber}`];
  if (!bank || !accountName) {
    return { type: 'rejected', code: 'INVALID_ACCOUNT' };
  }

  const feeMinor = calculateFeeMinor(command.amountMinor);
  const totalDebitMinor = addMinor(command.amountMinor, feeMinor);
  if (scenario === 'insufficient' || totalDebitMinor > state.balanceMinor) {
    return { type: 'rejected', code: 'INSUFFICIENT_FUNDS' };
  }

  const status: TransactionStatus = scenario === 'pending' || scenario === 'timeout' ? 'pending' : 'successful';
  const transactionId = `txn_transfer_${String(state.sequence).padStart(3, '0')}`;
  const reference = `WAYVE-TRANSFER-${String(state.sequence).padStart(3, '0')}`;
  state.sequence += 1;
  state.balanceMinor -= totalDebitMinor;

  const transaction: Transaction = {
    id: transactionId,
    reference,
    amountMinor: command.amountMinor,
    currency: 'NGN',
    type: 'debit',
    status,
    description: `Transfer to ${accountName}`,
    createdAt: new Date().toISOString(),
    feeMinor,
    narration: command.narration,
    counterparty: {
      role: 'recipient',
      accountName,
      accountNumber: command.recipientAccountNumber,
      bankCode: command.recipientBankCode,
      bankName: bank.name,
    },
  };
  state.transactions.unshift(transaction);

  const stored: StoredTransfer = {
    receipt: {
      transactionId,
      reference,
      status,
      amountMinor: command.amountMinor,
      feeMinor,
      totalDebitMinor,
      currency: 'NGN',
      idempotencyKey: command.idempotencyKey,
    },
    bodyKey,
    reads: 0,
    promoteAfterReads: scenario === 'timeout' ? 2 : null,
    transaction,
  };
  state.transfers.set(command.idempotencyKey, stored);
  return { type: 'ready', stored, created: true };
}

export function readTransfer(state: BankState, idempotencyKey: string): StoredTransfer | null {
  const stored = state.transfers.get(idempotencyKey);
  if (!stored) {
    return null;
  }
  stored.reads += 1;
  if (stored.promoteAfterReads !== null && stored.reads >= stored.promoteAfterReads && stored.receipt.status === 'pending') {
    stored.receipt = { ...stored.receipt, status: 'successful' };
    stored.transaction = { ...stored.transaction, status: 'successful' };
    const index = state.transactions.findIndex((item) => item.id === stored.transaction.id);
    if (index >= 0) {
      state.transactions[index] = stored.transaction;
    }
  }
  return stored;
}
