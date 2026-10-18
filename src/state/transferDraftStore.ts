import { create } from 'zustand';

interface DraftState {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string | null;
  amountInput: string;
  narration: string;
  setBank: (bankCode: string, bankName: string) => void;
  setAccountNumber: (accountNumber: string) => void;
  setAccountName: (accountName: string | null) => void;
  setAmountInput: (amountInput: string) => void;
  setNarration: (narration: string) => void;
  reset: () => void;
}

const initial = {
  bankCode: '',
  bankName: '',
  accountNumber: '',
  accountName: null,
  amountInput: '',
  narration: 'Personal transfer',
};

export const useTransferDraft = create<DraftState>((set) => ({
  ...initial,
  setBank: (bankCode, bankName) => set({ bankCode, bankName, accountName: null }),
  setAccountNumber: (accountNumber) => set({ accountNumber, accountName: null }),
  setAccountName: (accountName) => set({ accountName }),
  setAmountInput: (amountInput) => set({ amountInput }),
  setNarration: (narration) => set({ narration }),
  reset: () => set(initial),
}));
