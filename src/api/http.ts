import {
  ApiError,
  customerMessage,
  readErrorCode,
  TimeoutError,
} from '../domain/errors';
import { redactPath } from '../domain/redact';

export interface RequestOptions {
  baseUrl: string;
  path: string;
  method: 'GET' | 'POST';
  token: string | null;
  scenario?: string | null;
  delayMs?: number;
  body?: unknown;
  timeoutMs: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  log?: (event: { method: string; path: string; status?: number; code?: string }) => void;
}

export async function requestJson(options: RequestOptions): Promise<unknown> {
  if (!options.token) {
    throw new ApiError('UNAUTHENTICATED', 401);
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);

  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${options.token}`,
  };
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (options.scenario) {
    headers['x-wayve-scenario'] = options.scenario;
  }
  if (options.delayMs && options.delayMs > 0) {
    headers['x-wayve-delay-ms'] = String(options.delayMs);
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(`${options.baseUrl}${options.path}`, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        options.log?.({ method: options.method, path: redactPath(options.path), status: response.status, code: 'MALFORMED_RESPONSE' });
        throw new ApiError('MALFORMED_RESPONSE', response.status);
      }
    }

    if (!response.ok) {
      const code = response.status === 401 ? 'SESSION_EXPIRED' : readErrorCode(parsed) ?? 'UNKNOWN';
      options.log?.({ method: options.method, path: redactPath(options.path), status: response.status, code });
      throw new ApiError(code, response.status, customerMessage(code));
    }

    options.log?.({ method: options.method, path: redactPath(options.path), status: response.status });
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (options.signal?.aborted && !timedOut) {
      throw options.signal.reason instanceof Error ? options.signal.reason : new DOMException('The operation was aborted.', 'AbortError');
    }
    if (timedOut) {
      options.log?.({ method: options.method, path: redactPath(options.path), code: 'TIMEOUT' });
      throw new TimeoutError();
    }
    options.log?.({ method: options.method, path: redactPath(options.path), code: 'NETWORK' });
    throw new ApiError('NETWORK', 0);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
