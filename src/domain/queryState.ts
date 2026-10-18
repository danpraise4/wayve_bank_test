export type QueryMode = 'loading' | 'error' | 'empty' | 'refresh-error' | 'ready';

export function describeQueryState<T>(input: {
  data: T | null | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  isEmpty?: (data: T) => boolean;
}): { mode: QueryMode; showExistingData: boolean } {
  const data = input.data;
  const hasData = data !== null && data !== undefined;
  const empty = hasData && input.isEmpty ? input.isEmpty(data) : false;

  if (!hasData && (input.isPending || input.isFetching) && !input.isError) {
    return { mode: 'loading', showExistingData: false };
  }
  if (!hasData && input.isError) {
    return { mode: 'error', showExistingData: false };
  }
  if (hasData && input.isError) {
    return { mode: 'refresh-error', showExistingData: true };
  }
  if (hasData && empty) {
    return { mode: 'empty', showExistingData: false };
  }
  return { mode: 'ready', showExistingData: hasData };
}

export interface RemoteListState<T> {
  items: T[] | null;
  errorMessage: string | null;
  refreshing: boolean;
}

export function reduceRemoteList<T>(
  state: RemoteListState<T>,
  event:
    | { type: 'load-start' }
    | { type: 'refresh-start' }
    | { type: 'success'; items: T[] }
    | { type: 'failure'; message: string },
): RemoteListState<T> {
  switch (event.type) {
    case 'load-start':
      return state.items ? { ...state, refreshing: true, errorMessage: null } : { items: null, refreshing: false, errorMessage: null };
    case 'refresh-start':
      return { ...state, refreshing: true, errorMessage: null };
    case 'success':
      return { items: event.items, refreshing: false, errorMessage: null };
    case 'failure':
      return {
        items: state.items,
        refreshing: false,
        errorMessage: event.message,
      };
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}
