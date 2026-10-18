import type { TransactionStatus } from './types';

export type TransferPhase = 'submitting' | 'unknown' | 'pending' | 'successful' | 'failed' | 'reversed';

export interface TransferDraft {
  recipientBankCode: string;
  recipientBankName: string;
  recipientAccountNumber: string;
  recipientAccountName: string;
  amountMinor: number;
  feeMinor: number;
  totalDebitMinor: number;
  narration: string;
  currency: 'NGN';
}

export type LookupState = 'not_checked' | 'found' | 'not_found' | 'lookup_failed';

export interface TransferIntent {
  idempotencyKey: string;
  draft: TransferDraft;
  phase: TransferPhase;
  lookup: LookupState;
  transactionId?: string;
  reference?: string;
  customerMessage: string;
  updatedAt: string;
}

export const TRANSFER_COPY = {
  submitting: 'Sending your transfer…',
  unknown: "We're verifying this transfer. It has not been sent again.",
  unknownMissing: 'The bank has no record of this request yet. Checking again looks up the original transfer and does not create a new one.',
  unknownLookupFailed: "We couldn't reach the bank to verify this transfer. It has not been sent again.",
  pending: 'This transfer is pending. The outcome is not final.',
  successful: 'Transfer completed.',
  failed: 'This transfer failed and was not completed.',
  reversed: 'This transfer was reversed. That is different from a failed payment.',
} as const;

export function isUnresolvedPhase(phase: TransferPhase): boolean {
  return phase === 'submitting' || phase === 'unknown' || phase === 'pending';
}

export function phaseFromStatus(status: TransactionStatus): TransferPhase {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'successful':
      return 'successful';
    case 'failed':
      return 'failed';
    case 'reversed':
      return 'reversed';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function messageForPhase(phase: TransferPhase, lookup: LookupState = 'not_checked'): string {
  if (phase === 'unknown' && lookup === 'not_found') {
    return TRANSFER_COPY.unknownMissing;
  }
  if (phase === 'unknown' && lookup === 'lookup_failed') {
    return TRANSFER_COPY.unknownLookupFailed;
  }
  switch (phase) {
    case 'submitting':
      return TRANSFER_COPY.submitting;
    case 'unknown':
      return TRANSFER_COPY.unknown;
    case 'pending':
      return TRANSFER_COPY.pending;
    case 'successful':
      return TRANSFER_COPY.successful;
    case 'failed':
      return TRANSFER_COPY.failed;
    case 'reversed':
      return TRANSFER_COPY.reversed;
    default: {
      const unreachable: never = phase;
      return unreachable;
    }
  }
}

export type TransferEvent =
  | { type: 'start'; intent: TransferIntent }
  | {
      type: 'accepted';
      transactionId: string;
      reference: string;
      status: TransactionStatus;
      feeMinor: number;
      totalDebitMinor: number;
    }
  | { type: 'rejected'; customerMessage: string }
  | { type: 'outcome-unknown' }
  | {
      type: 'reconciled';
      transactionId: string;
      reference: string;
      status: TransactionStatus;
      feeMinor?: number;
      totalDebitMinor?: number;
    }
  | { type: 'reconcile-missing' }
  | { type: 'reconcile-failed' };

/**
 * Unresolved intents keep their idempotency key. A start event cannot replace one.
 * Unknown outcomes stay unknown until a lookup finds a server record.
 */
export function reduceTransferIntent(
  current: TransferIntent | null,
  event: TransferEvent,
  now: string,
): TransferIntent | null {
  switch (event.type) {
    case 'start':
      if (current && isUnresolvedPhase(current.phase)) {
        return current;
      }
      return event.intent;
    case 'accepted':
      if (!current || current.phase !== 'submitting') {
        return current;
      }
      return applyStatus(current, event.status, {
        transactionId: event.transactionId,
        reference: event.reference,
        feeMinor: event.feeMinor,
        totalDebitMinor: event.totalDebitMinor,
        lookup: 'found',
        now,
      });
    case 'rejected':
      if (!current || current.phase !== 'submitting') {
        return current;
      }
      return {
        ...current,
        phase: 'failed',
        lookup: 'found',
        customerMessage: event.customerMessage,
        updatedAt: now,
      };
    case 'outcome-unknown':
      if (!current || (current.phase !== 'submitting' && current.phase !== 'unknown')) {
        return current;
      }
      return {
        ...current,
        phase: 'unknown',
        customerMessage: messageForPhase('unknown', current.lookup),
        updatedAt: now,
      };
    case 'reconciled':
      if (!current || !isUnresolvedPhase(current.phase)) {
        return current;
      }
      return applyStatus(current, event.status, {
        transactionId: event.transactionId,
        reference: event.reference,
        feeMinor: event.feeMinor,
        totalDebitMinor: event.totalDebitMinor,
        lookup: 'found',
        now,
      });
    case 'reconcile-missing':
      if (!current || !isUnresolvedPhase(current.phase)) {
        return current;
      }
      return {
        ...current,
        phase: 'unknown',
        lookup: 'not_found',
        customerMessage: TRANSFER_COPY.unknownMissing,
        updatedAt: now,
      };
    case 'reconcile-failed':
      if (!current || !isUnresolvedPhase(current.phase)) {
        return current;
      }
      return {
        ...current,
        phase: 'unknown',
        lookup: 'lookup_failed',
        customerMessage: TRANSFER_COPY.unknownLookupFailed,
        updatedAt: now,
      };
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

function applyStatus(
  current: TransferIntent,
  status: TransactionStatus,
  details: {
    transactionId: string;
    reference: string;
    feeMinor?: number;
    totalDebitMinor?: number;
    lookup: LookupState;
    now: string;
  },
): TransferIntent {
  const phase = phaseFromStatus(status);
  return {
    ...current,
    phase,
    lookup: details.lookup,
    transactionId: details.transactionId,
    reference: details.reference,
    customerMessage: messageForPhase(phase, details.lookup),
    updatedAt: details.now,
    draft: {
      ...current.draft,
      feeMinor: details.feeMinor ?? current.draft.feeMinor,
      totalDebitMinor: details.totalDebitMinor ?? current.draft.totalDebitMinor,
    },
  };
}

export function createSubmittingIntent(idempotencyKey: string, draft: TransferDraft, now: string): TransferIntent {
  return {
    idempotencyKey,
    draft,
    phase: 'submitting',
    lookup: 'not_checked',
    customerMessage: TRANSFER_COPY.submitting,
    updatedAt: now,
  };
}
