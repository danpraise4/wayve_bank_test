import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createBankApi, type BankApi } from '../api/bankApi';
import { shouldRetryQuery } from '../domain/errors';
import { TRANSFER_POLICY } from '../domain/policy';
import type { TransferIntent } from '../domain/transferMachine';
import { createTransferController, type TransferController } from '../services/transferController';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      staleTime: 15_000,
    },
    mutations: { retry: false },
  },
});

interface SessionState {
  token: string | null;
  expired: boolean;
  expire: () => void;
  restore: () => void;
}

export const useSession = create<SessionState>((set) => ({
  token: 'demo-session-token',
  expired: false,
  expire: () => set({ token: null, expired: true }),
  restore: () => set({ token: 'demo-session-token', expired: false }),
}));

interface ScenarioState {
  scenario: string | null;
  setScenario: (scenario: string | null) => void;
}

export const useScenario = create<ScenarioState>((set) => ({
  scenario: null,
  setScenario: (scenario) => set({ scenario }),
}));

interface IntentState {
  intent: TransferIntent | null;
  setIntent: (intent: TransferIntent | null) => void;
}

export const useTransferIntent = create<IntentState>((set) => ({
  intent: null,
  setIntent: (intent) => set({ intent }),
}));

const INTENT_KEY = 'wayve.transferIntent.v1';

export const bankApi: BankApi = createBankApi({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4010',
  getToken: () => useSession.getState().token,
  getScenario: () => useScenario.getState().scenario,
  timeoutMs: TRANSFER_POLICY.clientTimeoutMs,
  onSessionExpired: () => {
    void queryClient.cancelQueries();
    queryClient.clear();
    useSession.getState().expire();
  },
  log: (event) => {
    if (__DEV__) {
      console.info('[wayve]', event.method, event.path, event.status ?? '', event.code ?? '');
    }
  },
});

export const transferController: TransferController = createTransferController({
  gateway: {
    createTransfer: (intent, signal) => bankApi.createTransfer(intent.draft, intent.idempotencyKey, signal),
    findByIdempotencyKey: (key, signal) => bankApi.findTransfer(key, signal),
  },
  repository: {
    async load() {
      const raw = await AsyncStorage.getItem(INTENT_KEY);
      if (!raw) {
        return null;
      }
      try {
        const parsed = JSON.parse(raw) as Partial<TransferIntent>;
        if (!parsed || typeof parsed.idempotencyKey !== 'string' || typeof parsed.phase !== 'string' || !parsed.draft) {
          return null;
        }
        return parsed as TransferIntent;
      } catch {
        return null;
      }
    },
    async save(intent) {
      if (!intent) {
        await AsyncStorage.removeItem(INTENT_KEY);
        return;
      }
      await AsyncStorage.setItem(INTENT_KEY, JSON.stringify(intent));
    },
  },
  createKey: () => `wayve_${Crypto.randomUUID()}`,
});

export async function refreshBankingData() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['account'] }),
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  ]);
}
