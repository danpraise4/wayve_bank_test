import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  ACCOUNT_DIRECTORY,
  BANKS,
  createBankState,
  CUSTOMER,
  decideTransfer,
  listTransactions,
  readTransaction,
  readTransfer,
  type BankState,
} from './bank';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-wayve-scenario, x-wayve-delay-ms',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'content-type': 'application/json; charset=utf-8',
};

export function createBankApp() {
  const state = createBankState();
  const server = createServer((req, res) => {
    void handle(req, res, state);
  });
  return { server, state };
}

async function handle(req: IncomingMessage, res: ServerResponse, state: BankState) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://mock.local');
  const scenario = header(req, 'x-wayve-scenario');
  const delayOverride = Number(header(req, 'x-wayve-delay-ms') ?? '');

  if (req.method === 'GET' && url.pathname === '/health') {
    send(res, 200, { ok: true });
    return;
  }

  if (scenario === 'session-expired' || header(req, 'authorization') !== 'Bearer demo-session-token') {
    send(res, 401, { error: { code: 'SESSION_EXPIRED', message: 'session rejected' } });
    return;
  }

  if (scenario === 'refresh-fail' && (url.pathname === '/api/v1/account' || url.pathname === '/api/v1/transactions')) {
    send(res, 503, {
      error: {
        code: 'UPSTREAM_FAILURE',
        message: 'db reset at 10.0.0.8 token=super-secret-token',
      },
    });
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/v1/account') {
      await delay(delayFor(scenario, delayOverride, url));
      send(res, 200, { ...CUSTOMER, availableBalanceMinor: state.balanceMinor });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/banks') {
      send(res, 200, BANKS);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/transactions') {
      if (scenario === 'malformed') {
        send(res, 200, { items: [{ id: 1 }], page: 'first' });
        return;
      }
      const page = listTransactions(state, url.searchParams, scenario === 'duplicate-page');
      await delay(delayFor(scenario, delayOverride, url));
      send(res, 200, page);
      return;
    }

    const transactionMatch = /^\/api\/v1\/transactions\/([^/]+)$/.exec(url.pathname);
    if (req.method === 'GET' && transactionMatch) {
      const id = decodeURIComponent(transactionMatch[1] ?? '');
      if (scenario === 'not-found') {
        send(res, 404, { error: { code: 'NOT_FOUND', message: `missing transaction ${id}` } });
        return;
      }
      if (scenario === 'malformed') {
        send(res, 200, { id: null, amount: 'lots' });
        return;
      }
      const transaction = readTransaction(state, id);
      if (!transaction) {
        send(res, 404, { error: { code: 'NOT_FOUND', message: `missing transaction ${id}` } });
        return;
      }
      send(res, 200, transaction);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/transfers/resolve-account') {
      const body = await readJson(req);
      const bankCode = stringField(body, 'bankCode');
      const accountNumber = stringField(body, 'accountNumber');
      await delay(scenario === 'slow' ? Math.max(numberOrZero(delayOverride), 2_000) : numberOrZero(delayOverride));
      const bank = BANKS.find((item) => item.code === bankCode);
      const accountName = bankCode && accountNumber ? ACCOUNT_DIRECTORY[`${bankCode}:${accountNumber}`] ?? null : null;
      if (!bank || !accountName) {
        send(res, 404, { error: { code: 'INVALID_ACCOUNT', message: 'unknown account' } });
        return;
      }
      send(res, 200, { accountName, bankCode, bankName: bank.name, accountNumber });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/transfers') {
      const body = await readJson(req);
      state.transferHttpPosts += 1;
      const decision = decideTransfer(
        state,
        {
          recipientBankCode: stringField(body, 'recipientBankCode') ?? '',
          recipientAccountNumber: stringField(body, 'recipientAccountNumber') ?? '',
          amountMinor: numberField(body, 'amountMinor') ?? Number.NaN,
          narration: stringField(body, 'narration') ?? '',
          idempotencyKey: stringField(body, 'idempotencyKey') ?? '',
        },
        scenario,
      );
      if (decision.type === 'invalid') {
        send(res, 400, { error: { code: 'VALIDATION_ERROR', message: 'invalid transfer' } });
        return;
      }
      if (decision.type === 'conflict') {
        send(res, 409, { error: { code: 'IDEMPOTENCY_CONFLICT', message: 'key reused with a different body' } });
        return;
      }
      if (decision.type === 'rejected') {
        send(res, 422, { error: { code: decision.code, message: decision.code } });
        return;
      }
      if (decision.created) {
        const waitMs = scenario === 'timeout' ? Math.max(numberOrZero(delayOverride) || 12_000, 1) : delayFor(scenario, delayOverride, url);
        await delay(waitMs);
      }
      send(res, 200, decision.stored.receipt);
      return;
    }

    const transferMatch = /^\/api\/v1\/transfers\/by-idempotency\/([^/]+)$/.exec(url.pathname);
    if (req.method === 'GET' && transferMatch) {
      const key = decodeURIComponent(transferMatch[1] ?? '');
      const stored = readTransfer(state, key);
      if (!stored) {
        send(res, 404, { error: { code: 'TRANSFER_NOT_FOUND', message: 'no transfer for key' } });
        return;
      }
      send(res, 200, stored.receipt);
      return;
    }

    send(res, 404, { error: { code: 'NOT_FOUND', message: 'unknown route' } });
  } catch {
    send(res, 400, { error: { code: 'VALIDATION_ERROR', message: 'invalid json' } });
  }
}

function delayFor(scenario: string | null, delayOverride: number, url: URL): number {
  const override = numberOrZero(delayOverride);
  if (scenario === 'slow') {
    return Math.max(override, 2_500);
  }
  if (scenario === 'out-of-order') {
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    if (search.includes('merchant')) {
      return Math.max(override, 700);
    }
    if (search.includes('transfer')) {
      return Math.max(override, 20);
    }
  }
  return override;
}

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, CORS_HEADERS);
  res.end(JSON.stringify(body));
}

function delay(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function numberOrZero(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) {
    return {};
  }
  return JSON.parse(text) as unknown;
}

function stringField(body: unknown, key: string): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function numberField(body: unknown, key: string): number | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : null;
}
