import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { customerMessage, shouldRetryQuery, ApiError, TimeoutError } from './errors';
import { describeQueryState, reduceRemoteList } from './queryState';
import { redactForLog, redactPath } from './redact';
import { createDebouncer, createLatestQuery, createTapGuard, singleFlight } from './staleRequest';
import { statusPollInterval, statusPresentation } from './status';
import {
  createSubmittingIntent,
  isUnresolvedPhase,
  reduceTransferIntent,
  type TransferDraft,
} from './transferMachine';

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

describe('stale responses', () => {
  it('keeps the newer search when the older request resolves last', async () => {
    let releaseFirst: (() => void) | undefined;
    let releaseSecond: (() => void) | undefined;
    const query = createLatestQuery(async (search: string) => {
      await new Promise<void>((resolve) => {
        if (search === 'merchant') {
          releaseFirst = resolve;
        } else {
          releaseSecond = resolve;
        }
      });
      return search;
    });

    const first = query.run('merchant');
    const second = query.run('transfer');
    releaseSecond?.();
    releaseFirst?.();
    const [older, newer] = await Promise.all([first, second]);
    assert.deepEqual(older, { applied: false });
    assert.deepEqual(newer, { applied: true, result: 'transfer' });
  });

  it('debounces to the latest value and ignores repeated navigation taps', async () => {
    const debounced: string[] = [];
    const debounce = createDebouncer(20);
    debounce.push('merchant', (value) => debounced.push(value));
    debounce.push('transfer', (value) => debounced.push(value));
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.deepEqual(debounced, ['transfer']);

    const allow = createTapGuard(500);
    assert.equal(allow('history', 1_000), true);
    assert.equal(allow('history', 1_200), false);
    assert.equal(allow('history', 1_600), true);
  });

  it('shares one refresh while the first is still running', async () => {
    let calls = 0;
    const refresh = singleFlight(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'ok';
    });
    const [left, right] = await Promise.all([refresh(), refresh()]);
    assert.equal(left, 'ok');
    assert.equal(right, 'ok');
    assert.equal(calls, 1);
  });
});

describe('transfer intent rules', () => {
  it('refuses to replace an unresolved idempotency key', () => {
    const current = createSubmittingIntent('wayve_one', draft, '2026-10-18T00:00:00.000Z');
    const next = reduceTransferIntent(
      current,
      { type: 'start', intent: createSubmittingIntent('wayve_two', draft, '2026-10-18T00:00:01.000Z') },
      '2026-10-18T00:00:01.000Z',
    );
    assert.equal(next?.idempotencyKey, 'wayve_one');
    assert.equal(isUnresolvedPhase('unknown'), true);
  });

  it('moves a timeout to unknown and then adopts the looked-up status', () => {
    const started = createSubmittingIntent('wayve_one', draft, '2026-10-18T00:00:00.000Z');
    const unknown = reduceTransferIntent(started, { type: 'outcome-unknown' }, '2026-10-18T00:00:02.000Z');
    assert.equal(unknown?.phase, 'unknown');
    assert.match(unknown?.customerMessage ?? '', /not been sent again/);
    const found = reduceTransferIntent(
      unknown,
      {
        type: 'reconciled',
        transactionId: 'txn_transfer_001',
        reference: 'WAYVE-TRANSFER-001',
        status: 'pending',
        feeMinor: 1_000,
        totalDebitMinor: 151_050,
      },
      '2026-10-18T00:00:03.000Z',
    );
    assert.equal(found?.phase, 'pending');
    assert.equal(found?.idempotencyKey, 'wayve_one');
    assert.match(found?.customerMessage ?? '', /not final/);
  });

  it('does not present failed or reversed transfers as successful', () => {
    assert.equal(statusPresentation('failed').label, 'Failed');
    assert.equal(statusPresentation('reversed').tone, 'reversed');
    assert.notEqual(statusPresentation('pending').description, statusPresentation('successful').description);
    assert.equal(statusPollInterval('pending'), 3_000);
    assert.equal(statusPollInterval('successful'), false);
  });
});

describe('errors, refresh, and redaction', () => {
  it('hides raw server details and does not retry customer errors', () => {
    const message = customerMessage('UPSTREAM_FAILURE');
    assert.equal(message.includes('token'), false);
    assert.equal(message.includes('10.0.0.8'), false);
    assert.equal(shouldRetryQuery(0, new ApiError('SESSION_EXPIRED', 401)), false);
    assert.equal(shouldRetryQuery(0, new ApiError('UPSTREAM_FAILURE', 503)), true);
    assert.equal(shouldRetryQuery(1, new ApiError('UPSTREAM_FAILURE', 503)), false);
    assert.equal(shouldRetryQuery(0, new TimeoutError()), false);
  });

  it('keeps loaded rows when a refresh fails', () => {
    const loaded = reduceRemoteList<string>({ items: null, errorMessage: null, refreshing: false }, { type: 'success', items: ['txn_1'] });
    const refreshing = reduceRemoteList(loaded, { type: 'refresh-start' });
    const failed = reduceRemoteList(refreshing, { type: 'failure', message: "We couldn't refresh." });
    assert.deepEqual(failed.items, ['txn_1']);
    assert.equal(failed.errorMessage, "We couldn't refresh.");
    assert.equal(
      describeQueryState({ data: ['txn_1'], isPending: false, isFetching: false, isError: true, isEmpty: (data) => data.length === 0 }).mode,
      'refresh-error',
    );
    assert.equal(
      describeQueryState({ data: [], isPending: false, isFetching: false, isError: false, isEmpty: (data) => data.length === 0 }).mode,
      'empty',
    );
  });

  it('redacts balances, account numbers, tokens, and idempotency keys', () => {
    const redacted = redactForLog({
      accountNumber: '0123456789',
      availableBalanceMinor: 25_000_000,
      authorization: 'Bearer secret',
      idempotencyKey: 'wayve_secret',
      status: 'pending',
    }) as Record<string, unknown>;
    assert.equal(redacted.accountNumber, '[redacted]');
    assert.equal(redacted.availableBalanceMinor, '[redacted]');
    assert.equal(redacted.authorization, '[redacted]');
    assert.equal(redacted.idempotencyKey, '[redacted]');
    assert.equal(redacted.status, 'pending');
    assert.equal(redactPath('/api/v1/transfers/by-idempotency/wayve_secret?amount=10'), '/api/v1/transfers/by-idempotency/[redacted]');
  });
});
