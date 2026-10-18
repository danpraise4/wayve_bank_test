const SENSITIVE_KEYS = new Set([
  'accountnumber',
  'accountname',
  'availablebalanceminor',
  'amountminor',
  'feeminor',
  'totaldebitminor',
  'authorization',
  'token',
  'idempotencykey',
  'password',
  'secret',
]);

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[max-depth]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, depth + 1));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    output[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[redacted]' : redactForLog(nested, depth + 1);
  }
  return output;
}

export function redactPath(path: string): string {
  const withoutQuery = path.split('?')[0] ?? path;
  return withoutQuery.replace(/\/by-idempotency\/[^/]+/g, '/by-idempotency/[redacted]');
}
