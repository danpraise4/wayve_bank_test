import { ApiError, isDefinitiveClientRejection, isUncertainOutcome, TimeoutError } from '../domain/errors';
import {
  createSubmittingIntent,
  isUnresolvedPhase,
  reduceTransferIntent,
  type TransferDraft,
  type TransferIntent,
} from '../domain/transferMachine';
import type { TransferReceipt } from '../domain/types';

export interface TransferIntentRepository {
  load(): Promise<TransferIntent | null>;
  save(intent: TransferIntent | null): Promise<void>;
}

export interface TransferGateway {
  createTransfer(intent: TransferIntent, signal?: AbortSignal): Promise<TransferReceipt>;
  findByIdempotencyKey(idempotencyKey: string, signal?: AbortSignal): Promise<TransferReceipt | null>;
}

export interface TransferController {
  confirm(draft: TransferDraft): Promise<TransferIntent>;
  /** Looks up an unresolved transfer. Never creates one. */
  resume(): Promise<TransferIntent | null>;
  /**
   * Explicit customer action after a lookup found no record.
   * Reuses the original idempotency key.
   */
  retrySameKey(): Promise<TransferIntent>;
  clearTerminal(): Promise<void>;
}

export function createMemoryRepository(initial: TransferIntent | null = null): TransferIntentRepository & {
  current(): TransferIntent | null;
} {
  let value = initial;
  return {
    async load() {
      return value;
    },
    async save(intent) {
      value = intent;
    },
    current() {
      return value;
    },
  };
}

export function createTransferController(deps: {
  gateway: TransferGateway;
  repository: TransferIntentRepository;
  createKey?: () => string;
  now?: () => string;
}): TransferController {
  let inFlight: Promise<TransferIntent> | null = null;

  const now = () => deps.now?.() ?? new Date().toISOString();
  const createKey = deps.createKey ?? (() => {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (!uuid) {
      throw new Error('A cryptographically random idempotency key is required');
    }
    return `wayve_${uuid}`;
  });

  async function persist(intent: TransferIntent | null): Promise<TransferIntent | null> {
    await deps.repository.save(intent);
    return intent;
  }

  async function reconcile(intent: TransferIntent): Promise<TransferIntent> {
    let current = intent;
    if (current.phase === 'submitting') {
      const unknown = reduceTransferIntent(current, { type: 'outcome-unknown' }, now());
      if (!unknown) {
        return current;
      }
      current = unknown;
      await persist(current);
    }

    try {
      const found = await deps.gateway.findByIdempotencyKey(current.idempotencyKey);
      if (!found) {
        const missing = reduceTransferIntent(current, { type: 'reconcile-missing' }, now());
        return (await persist(missing ?? current)) ?? current;
      }
      const reconciled = reduceTransferIntent(
        current,
        {
          type: 'reconciled',
          transactionId: found.transactionId,
          reference: found.reference,
          status: found.status,
          feeMinor: found.feeMinor,
          totalDebitMinor: found.totalDebitMinor,
        },
        now(),
      );
      return (await persist(reconciled ?? current)) ?? current;
    } catch {
      const failedLookup = reduceTransferIntent(current, { type: 'reconcile-failed' }, now());
      return (await persist(failedLookup ?? current)) ?? current;
    }
  }

  async function postIntent(intent: TransferIntent): Promise<TransferIntent> {
    try {
      const receipt = await deps.gateway.createTransfer(intent);
      const accepted = reduceTransferIntent(
        intent,
        {
          type: 'accepted',
          transactionId: receipt.transactionId,
          reference: receipt.reference,
          status: receipt.status,
          feeMinor: receipt.feeMinor,
          totalDebitMinor: receipt.totalDebitMinor,
        },
        now(),
      );
      return (await persist(accepted ?? intent)) ?? intent;
    } catch (error) {
      if (isDefinitiveClientRejection(error)) {
        const rejected = reduceTransferIntent(
          intent,
          { type: 'rejected', customerMessage: error.customerMessage },
          now(),
        );
        return (await persist(rejected ?? intent)) ?? intent;
      }
      if (isUncertainOutcome(error) || error instanceof TimeoutError || error instanceof ApiError) {
        const unknown = reduceTransferIntent(intent, { type: 'outcome-unknown' }, now());
        const persisted = (await persist(unknown ?? intent)) ?? intent;
        return reconcile(persisted);
      }
      const unknown = reduceTransferIntent(intent, { type: 'outcome-unknown' }, now());
      const persisted = (await persist(unknown ?? intent)) ?? intent;
      return reconcile(persisted);
    }
  }

  async function confirmUnsynchronized(draft: TransferDraft): Promise<TransferIntent> {
    const existing = await deps.repository.load();
    if (existing && isUnresolvedPhase(existing.phase)) {
      return reconcile(existing);
    }

    const key = createKey();
    const started = reduceTransferIntent(null, { type: 'start', intent: createSubmittingIntent(key, draft, now()) }, now());
    if (!started) {
      throw new ApiError('UNKNOWN', 0);
    }
    await persist(started);
    return postIntent(started);
  }

  return {
    confirm(draft) {
      if (inFlight) {
        return inFlight;
      }
      inFlight = confirmUnsynchronized(draft).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    async resume() {
      const existing = await deps.repository.load();
      if (!existing) {
        return null;
      }
      if (!isUnresolvedPhase(existing.phase)) {
        return existing;
      }
      if (inFlight) {
        return inFlight;
      }
      inFlight = reconcile(existing).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    async retrySameKey() {
      const existing = await deps.repository.load();
      if (!existing) {
        throw new ApiError('TRANSFER_NOT_FOUND', 404);
      }
      if (existing.phase !== 'unknown' || existing.lookup !== 'not_found') {
        return existing;
      }
      if (inFlight) {
        return inFlight;
      }
      const submitting = {
        ...existing,
        phase: 'submitting' as const,
        customerMessage: 'Sending the original transfer again…',
        updatedAt: now(),
      };
      await persist(submitting);
      inFlight = postIntent(submitting).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    async clearTerminal() {
      const existing = await deps.repository.load();
      if (existing && !isUnresolvedPhase(existing.phase)) {
        await persist(null);
      }
    },
  };
}
