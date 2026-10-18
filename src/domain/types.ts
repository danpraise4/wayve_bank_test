export const TRANSACTION_TYPES = ['credit', 'debit'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = ['pending', 'successful', 'failed', 'reversed'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export interface Counterparty {
  role: 'sender' | 'recipient';
  accountName: string;
  accountNumber: string;
  bankCode?: string;
  bankName?: string;
}

export interface Transaction {
  id: string;
  reference: string;
  amountMinor: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  description: string;
  createdAt: string;
  feeMinor?: number;
  narration?: string;
  counterparty?: Counterparty;
}

export interface Account {
  accountId: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  availableBalanceMinor: number;
}

export interface TransactionPage {
  items: Transaction[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface Bank {
  code: string;
  name: string;
}

export interface ResolvedAccount {
  accountName: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
}

export interface TransferRequestBody {
  recipientBankCode: string;
  recipientAccountNumber: string;
  amountMinor: number;
  narration: string;
  idempotencyKey: string;
}

export interface TransferReceipt {
  transactionId: string;
  reference: string;
  status: TransactionStatus;
  amountMinor: number;
  feeMinor: number;
  totalDebitMinor: number;
  currency: string;
  idempotencyKey: string;
}
