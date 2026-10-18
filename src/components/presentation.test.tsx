import { render } from '@testing-library/react-native';
import { StatusBadge } from './StatusBadge';
import { TransferQuote } from './TransferQuote';

describe('financial presentation', () => {
  it('shows the amount, fee, and total debit from minor units', async () => {
    const view = await render(<TransferQuote amountMinor={150050} feeMinor={1000} totalDebitMinor={151050} />);
    expect(view.getByText('₦1,500.50')).toBeTruthy();
    expect(view.getByText('₦10.00')).toBeTruthy();
    expect(view.getByText('₦1,510.50')).toBeTruthy();
    expect(view.getByLabelText('Total debit ₦1,510.50')).toBeTruthy();
  });

  it('labels a failed transaction as failed', async () => {
    const view = await render(<StatusBadge status="failed" />);
    expect(view.getByText('Failed')).toBeTruthy();
    expect(view.queryByText('Successful')).toBeNull();
  });

  it('labels a reversed transaction differently from a failed one', async () => {
    const view = await render(<StatusBadge status="reversed" />);
    expect(view.getByText('Reversed')).toBeTruthy();
    expect(view.getByLabelText('Reversed. Completed, then reversed')).toBeTruthy();
    expect(view.queryByText('Failed')).toBeNull();
  });

  it('labels a pending transaction as not final', async () => {
    const view = await render(<StatusBadge status="pending" />);
    expect(view.getByText('Pending')).toBeTruthy();
    expect(view.getByLabelText('Pending. Not final')).toBeTruthy();
    expect(view.queryByText('Successful')).toBeNull();
  });
});
