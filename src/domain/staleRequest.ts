export function createRequestGuard() {
  let latest = 0;
  return {
    issue(): number {
      latest += 1;
      return latest;
    },
    isLatest(token: number): boolean {
      return token === latest;
    },
  };
}

export type LatestResult<T> = { applied: true; result: T } | { applied: false };

/**
 * Only the most recently issued request may publish a result.
 * Starting a new request aborts the previous one.
 */
export function createLatestQuery<TArgs, TResult>(
  fetcher: (args: TArgs, signal: AbortSignal) => Promise<TResult>,
) {
  const guard = createRequestGuard();
  let active: AbortController | null = null;

  return {
    cancel() {
      guard.issue();
      active?.abort();
      active = null;
    },
    async run(args: TArgs): Promise<LatestResult<TResult>> {
      const token = guard.issue();
      active?.abort();
      const controller = new AbortController();
      active = controller;

      try {
        const result = await fetcher(args, controller.signal);
        if (!guard.isLatest(token) || controller.signal.aborted) {
          return { applied: false };
        }
        return { applied: true, result };
      } catch (error) {
        if (!guard.isLatest(token) || controller.signal.aborted) {
          return { applied: false };
        }
        throw error;
      }
    },
  };
}

export function createDebouncer(waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest = 0;

  return {
    push(value: string, onFire: (value: string) => void) {
      const token = latest + 1;
      latest = token;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        if (token === latest) {
          onFire(value);
        }
      }, waitMs);
    },
    cancel() {
      latest += 1;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

export function createTapGuard(windowMs = 700) {
  let lastAt = 0;
  let lastKey = '';
  return (key: string, now = Date.now()): boolean => {
    if (key === lastKey && now - lastAt < windowMs) {
      return false;
    }
    lastKey = key;
    lastAt = now;
    return true;
  };
}

export function singleFlight<T>(task: () => Promise<T>): () => Promise<T> {
  let current: Promise<T> | null = null;
  return () => {
    if (current) {
      return current;
    }
    current = task().finally(() => {
      current = null;
    });
    return current;
  };
}
