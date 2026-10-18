import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError, TimeoutError } from '../domain/errors';
import type { TransferDraft, TransferIntent } from '../domain/transferMachine';
import type { TransferReceipt } from '../domain/types';
import { createMemoryRepository, createTransferController, type TransferGateway } from './transferController';

const draft: TransferDraft = {
  recipientBankCode: '000013',
  recipientBankName: 'GTBank',
  recipientAccountNumber: '1029384756',
  recipientAccountName: 'Chinedu Adeyemi',
  amountMinor: 150_050,
  feeMinor: 1_000,
  totalDebitMinor: 151_050,
  narration: 'Personal transfer',
  currency: 'NGN',
};

function receipt(key: string, status: TransferReceipt['status'] = 'successful'): TransferReceipt {
  return {
    transactionId: 'txn_transfer_001',
    reference: 'WAYVE-TRANSFER-001',
    status,
    amountMinor: draft.amountMinor,
    feeMinor: draft.feeMinor,
    totalDebitMinor: draft.totalDebitMinor,
    currency: 'NGN',
    idempotencyKey: key,
  };
}

function gateway(overrides: Partial<TransferGateway> & { posts?: string[] } = {}): TransferGateway & { posts: string[]; lookups: string[] } {
  const posts = overrides.posts ?? [];
  const lookups: string[] = [];
  return {
    posts,
    lookups,
    async createTransfer(intent) {
      posts.push(intent.idempotencyKey);
      if (overrides.createTransfer) {
        return overrides.createTransfer(intent);
      }
      return receipt(intent.idempotencyKey);
    },
    async findByIdempotencyKey(key) {
      lookups.push(key);
      if (overrides.findByIdempotencyKey) {
        return overrides.findByIdempotencyKey(key);
      }
      return null;
    },
  };
}

describe('transfer submission', () => {
  it('posts once and reuses the in-flight promise for a duplicate confirmation', async () => {
    let release: (() => void) | undefined;
    const api = gateway({
      async createTransfer(intent) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return receipt(intent.idempotencyKey);
      },
    });
    const repository = createMemoryRepository();
    const controller = createTransferController({
      gateway: api,
      repository,
      createKey: () => 'wayve_locked',
      now: () => '2026-10-18T00:00:00.000Z',
    });

    const first = controller.confirm(draft);
    const second = controller.confirm(draft);
    assert.equal(first, second);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(api.posts.length, 1);
    release?.();
    const [left, right] = await Promise.all([first, second]);
    assert.equal(left.idempotencyKey, 'wayve_locked');
    assert.equal(right.idempotencyKey, 'wayve_locked');
    assert.equal(left.phase, 'successful');
    assert.equal(api.posts.length, 1);
  });

  it('verifies a timed-out transfer instead of posting it again', async () => {
    const api = gateway({
      async createTransfer() {
        throw new TimeoutError();
      },
      async findByIdempotencyKey(key) {
        return receipt(key, 'pending');
      },
    });
    const repository = createMemoryRepository();
    const controller = createTransferController({
      gateway: api,
      repository,
      createKey: () => 'wayve_timeout',
      now: () => '2026-10-18T00:00:00.000Z',
    });

    const outcome = await controller.confirm(draft);
    assert.equal(api.posts.length, 1);
    assert.deepEqual(api.lookups, ['wayve_timeout']);
    assert.equal(outcome.phase, 'pending');
    assert.equal(outcome.idempotencyKey, 'wayve_timeout');

    const again = await controller.confirm(draft);
    assert.equal(api.posts.length, 1);
    assert.equal(again.idempotencyKey, 'wayve_timeout');
  });

  it('restores an interrupted transfer with a lookup and the original key', async () => {
    const repository = createMemoryRepository({
      idempotencyKey: 'wayve_restart',
      draft,
      phase: 'submitting',
      lookup: 'not_checked',
      customerMessage: 'Sending your transfer…',
      updatedAt: '2026-10-18T00:00:00.000Z',
    } satisfies TransferIntent);
    const api = gateway({
      async findByIdempotencyKey(key) {
        return receipt(key, 'successful');
      },
    });
    const restarted = createTransferController({
      gateway: api,
      repository,
      createKey: () => 'wayve_should_not_be_used',
      now: () => '2026-10-18T00:05:00.000Z',
    });

    const restored = await restarted.resume();
    assert.equal(api.posts.length, 0);
    assert.deepEqual(api.lookups, ['wayve_restart']);
    assert.equal(restored?.phase, 'successful');
    assert.equal(restored?.idempotencyKey, 'wayve_restart');
  });

  it('records a rejection without a second post, and reuses the key only when explicitly asked', async () => {
    let attempts = 0;
    const api = gateway({
      async createTransfer(intent) {
        attempts += 1;
        if (attempts === 1) {
          throw new ApiError('INSUFFICIENT_FUNDS', 422);
        }
        return receipt(intent.idempotencyKey);
      },
      async findByIdempotencyKey() {
        return null;
      },
    });
    const repository = createMemoryRepository();
    const controller = createTransferController({
      gateway: api,
      repository,
      createKey: () => 'wayve_retry',
      now: () => '2026-10-18T00:00:00.000Z',
    });

    const rejected = await controller.confirm(draft);
    assert.equal(rejected.phase, 'failed');
    assert.match(rejected.customerMessage, /available balance/);
    assert.deepEqual(api.posts, ['wayve_retry']);

    const blocked = await controller.retrySameKey();
    assert.equal(blocked.phase, 'failed');
    assert.deepEqual(api.posts, ['wayve_retry']);

    await repository.save({ ...rejected, phase: 'unknown', lookup: 'not_found' });
    const retried = await controller.retrySameKey();
    assert.equal(retried.phase, 'successful');
    assert.deepEqual(api.posts, ['wayve_retry', 'wayve_retry']);
  });
});
