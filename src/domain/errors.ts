const CUSTOMER_MESSAGES: Record<string, string> = {
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  UNAUTHENTICATED: 'Your session has expired. Please sign in again.',
  INSUFFICIENT_FUNDS: 'Your available balance is not enough for this transfer.',
  TRANSFER_REJECTED: 'The bank declined this transfer.',
  INVALID_ACCOUNT: 'We could not find that account. Check the number and bank.',
  VALIDATION_ERROR: 'Check the transfer details and try again.',
  NOT_FOUND: "We couldn't find that transaction.",
  TRANSFER_NOT_FOUND: "We couldn't find a record of this transfer yet.",
  IDEMPOTENCY_CONFLICT: 'This transfer does not match the original request.',
  UPSTREAM_FAILURE: "We couldn't complete that request. Please try again.",
  MALFORMED_RESPONSE: "We couldn't read the server response. Please try again.",
  NETWORK: 'You appear to be offline or the network was interrupted.',
  TIMEOUT: "This is taking longer than usual. We're checking the original transfer and will not send it again.",
  CANCELLED: 'The request was cancelled.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export function customerMessage(code: string | null | undefined): string {
  if (!code) {
    return CUSTOMER_MESSAGES.UNKNOWN ?? 'Something went wrong. Please try again.';
  }
  return CUSTOMER_MESSAGES[code] ?? CUSTOMER_MESSAGES.UNKNOWN ?? 'Something went wrong. Please try again.';
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly customerMessage: string;

  constructor(code: string, status: number, message = customerMessage(code)) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.customerMessage = message;
  }
}

export class TimeoutError extends Error {
  readonly code = 'TIMEOUT';
  readonly customerMessage = customerMessage('TIMEOUT');

  constructor() {
    super(customerMessage('TIMEOUT'));
    this.name = 'TimeoutError';
  }
}

export function isDefinitiveClientRejection(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 401 &&
    error.status !== 408
  );
}

export function isUncertainOutcome(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true;
  }
  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 401 || error.status === 408 || error.status >= 500;
  }
  return false;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  if (error instanceof ApiError && error.code === 'MALFORMED_RESPONSE') {
    return false;
  }
  if (error instanceof TimeoutError) {
    return false;
  }
  return failureCount < 1;
}

export function readErrorCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.length > 0 && code.length < 64 ? code : null;
}
