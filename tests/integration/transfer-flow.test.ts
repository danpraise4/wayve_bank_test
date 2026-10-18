import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import { createBankApi } from '../../src/api/bankApi';
import { ApiError } from '../../src/domain/errors';
import { addMinor, parseAmountInput } from '../../src/domain/money';
import { calculateFeeMinor } from '../../src/domain/policy';
import { createLatestQuery } from '../../src/domain/staleRequest';
import { mergeTransactionPages } from '../../src/domain/transactions';
import type { TransferDraft } from '../../src/domain/transferMachine';
import { createMemoryRepository, createTransferController } from '../../src/services/transferController';
import { createBankApp } from '../../mock-server/src/createApp';

let server: Server;
let baseUrl = '';
let state: ReturnType<typeof createBankApp>['state'];

before(async () => {
  const app = createBankApp();
  state = app.state;
  server = app.server;
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Mock server did not bind to a port');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function api(scenario: string | null = null, timeoutMs = 8_000, delayMs?: number) {
  return createBankApi({
    baseUrl,
    getToken: () => 'demo-session-token',
    getScenario: () => scenario,
    timeoutMs,
    delayMs,
  });
}

describe('transfer flow against the mock service', () => {
  it('resolves an account, prices the debit, and completes one transfer', async () => {
    const client = api();
    const resolved = await client.resolveAccount({ bankCode: '000013', accountNumber: '1029384756' });
    assert.equal(resolved.accountName, 'Chinedu Adeyemi');

    const parsed = parseAmountInput('1500.50');
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    const feeMinor = calculateFeeMinor(parsed.amountMinor);
    const totalDebitMinor = addMinor(parsed.amountMinor, feeMinor);
    const draft: TransferDraft = {
      recipientBankCode: '000013',
      recipientBankName: resolved.bankName,
      recipientAccountNumber: resolved.accountNumber,
      recipientAccountName: resolved.accountName,
      amountMinor: parsed.amountMinor,
      feeMinor,
      totalDebitMinor,
      narration: 'Personal transfer',
      currency: 'NGN',
    };

    const repository = createMemoryRepository();
    const controller = createTransferController({
      gateway: {
        createTransfer: (intent) => client.createTransfer(intent.draft, intent.idempotencyKey),
        findByIdempotencyKey: (key) => client.findTransfer(key),
      },
      repository,
      createKey: () => 'wayve_integration_success',
      now: () => '2026-10-18T12:00:00.000Z',
    });

    const result = await controller.confirm(draft);
    assert.equal(result.phase, 'successful');
    assert.equal(result.reference?.startsWith('WAYVE-TRANSFER-'), true);
    assert.equal(result.draft.totalDebitMinor, 151_050);

    const replay = await client.createTransfer(draft, 'wayve_integration_success');
    assert.equal(replay.transactionId, result.transactionId);
    assert.equal(state.transfers.size, 1);

    const detail = await client.getTransaction(result.transactionId ?? '');
    assert.equal(detail.status, 'successful');
    assert.equal(detail.counterparty?.accountName, 'Chinedu Adeyemi');
  });

  it('checks the accepted transfer after the client times out', async () => {
    const postsBefore = state.transferHttpPosts;
    const client = api('timeout', 40, 200);
    const repository = createMemoryRepository();
    const controller = createTransferController({
      gateway: {
        createTransfer: (intent) => client.createTransfer(intent.draft, intent.idempotencyKey),
        findByIdempotencyKey: (key) => client.findTransfer(key),
      },
      repository,
      createKey: () => 'wayve_integration_timeout',
      now: () => '2026-10-18T12:05:00.000Z',
    });
    const draft: TransferDraft = {
      recipientBankCode: '000014',
      recipientBankName: 'Access Bank',
      recipientAccountNumber: '5647382910',
      recipientAccountName: 'Fatima Bello',
      amountMinor: 100_000,
      feeMinor: 1_000,
      totalDebitMinor: 101_000,
      narration: 'Timeout case',
      currency: 'NGN',
    };

    const outcome = await controller.confirm(draft);
    assert.equal(state.transferHttpPosts, postsBefore + 1);
    assert.equal(outcome.phase, 'pending');
    assert.equal(outcome.idempotencyKey, 'wayve_integration_timeout');
    assert.match(outcome.customerMessage, /not final/);

    const promoted = await client.findTransfer('wayve_integration_timeout');
    assert.equal(promoted?.status, 'successful');
  });

  it('keeps the latest search, dedupes pages, and hides raw failures', async () => {
    const slow = api('out-of-order');
    const query = createLatestQuery(async (search: string, signal: AbortSignal) => {
      const page = await slow.listTransactions({ ...emptyish(), search, page: 1, limit: 10 }, signal);
      return page.items.map((item) => item.description);
    });
    const merchant = query.run('merchant');
    const transfer = query.run('transfer');
    const [first, second] = await Promise.all([merchant, transfer]);
    assert.equal(first.applied, false);
    assert.equal(second.applied, true);
    if (second.applied) {
      assert.equal(second.result.every((description) => description.toLowerCase().includes('transfer')), true);
    }

    const paged = api('duplicate-page');
    const pageOne = await paged.listTransactions({ ...emptyish(), page: 1, limit: 10 });
    const pageTwo = await paged.listTransactions({ ...emptyish(), page: 2, limit: 10 });
    const merged = mergeTransactionPages([pageOne.items, pageTwo.items]);
    assert.equal(new Set(merged.map((item) => item.id)).size, merged.length);
    assert.equal(pageTwo.items.some((item) => item.id === pageOne.items.at(-1)?.id), true);

    await assert.rejects(() => api('refresh-fail').listTransactions({ ...emptyish(), page: 1, limit: 10 }), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.customerMessage.includes('super-secret-token'), false);
      assert.equal(error.customerMessage.includes('10.0.0.8'), false);
      return true;
    });

    await assert.rejects(() => api('session-expired').getAccount(), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      assert.match(error.customerMessage, /session has expired/i);
      return true;
    });

    await assert.rejects(() => api('malformed').getTransaction('txn_001'), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'MALFORMED_RESPONSE');
      assert.equal(error.customerMessage.includes('lots'), false);
      return true;
    });

    await assert.rejects(() => api('not-found').getTransaction('txn_001'), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'NOT_FOUND');
      assert.match(error.customerMessage, /couldn't find that transaction/i);
      return true;
    });

    await assert.rejects(
      () =>
        api('insufficient').createTransfer(
          {
            recipientBankCode: '000013',
            recipientBankName: 'GTBank',
            recipientAccountNumber: '1029384756',
            recipientAccountName: 'Chinedu Adeyemi',
            amountMinor: 100_000,
            feeMinor: 1_000,
            totalDebitMinor: 101_000,
            narration: 'Should fail',
            currency: 'NGN',
          },
          'wayve_insufficient',
        ),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, 'INSUFFICIENT_FUNDS');
        assert.match(error.customerMessage, /available balance/);
        return true;
      },
    );
  });

  it('promotes the status-watch transaction on the second read', async () => {
    const client = api();
    const first = await client.getTransaction('txn_status_watch');
    const second = await client.getTransaction('txn_status_watch');
    assert.equal(first.status, 'pending');
    assert.equal(second.status, 'successful');
  });
});

function emptyish() {
  return { search: '', type: 'all' as const, status: 'all' as const, from: null, to: null };
}
