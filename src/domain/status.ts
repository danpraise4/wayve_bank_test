import type { TransactionStatus } from './types';

export interface StatusPresentation {
  label: string;
  description: string;
  tone: 'success' | 'pending' | 'failed' | 'reversed';
}

export function statusPresentation(status: TransactionStatus): StatusPresentation {
  switch (status) {
    case 'successful':
      return { label: 'Successful', description: 'Completed', tone: 'success' };
    case 'pending':
      return { label: 'Pending', description: 'Not final', tone: 'pending' };
    case 'failed':
      return { label: 'Failed', description: 'Not completed', tone: 'failed' };
    case 'reversed':
      return {
        label: 'Reversed',
        description: 'Completed, then reversed',
        tone: 'reversed',
      };
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function statusPollInterval(status: TransactionStatus | undefined): number | false {
  return status === 'pending' ? 3_000 : false;
}
