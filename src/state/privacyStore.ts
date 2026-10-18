import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PrivacyState {
  balanceHidden: boolean;
  toggleBalance: () => void;
}

export const usePrivacy = create<PrivacyState>()(
  persist(
    (set, get) => ({
      balanceHidden: false,
      toggleBalance: () => set({ balanceHidden: !get().balanceHidden }),
    }),
    {
      name: 'wayve.privacy.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ balanceHidden: state.balanceHidden }),
    },
  ),
);
