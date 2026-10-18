import { useQuery } from '@tanstack/react-query';
import { openScreen } from '../navigation/openScreen';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../components/AppIcon';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { Banner, Button, ScreenIntro, TextField } from '../components/ui';
import { ApiError } from '../domain/errors';
import { createLatestQuery } from '../domain/staleRequest';
import { validateAccountNumber, validateBankCode } from '../domain/validation';
import { bankApi, useSession } from '../state/runtime';
import { useTransferDraft } from '../state/transferDraftStore';
import { colors, radius, shadow, space, type as typeScale } from '../theme/tokens';

export function RecipientScreen() {
  const expired = useSession((state) => state.expired);
  const bankCode = useTransferDraft((state) => state.bankCode);
  const bankName = useTransferDraft((state) => state.bankName);
  const accountNumber = useTransferDraft((state) => state.accountNumber);
  const accountName = useTransferDraft((state) => state.accountName);
  const setBank = useTransferDraft((state) => state.setBank);
  const setAccountNumber = useTransferDraft((state) => state.setAccountNumber);
  const setAccountName = useTransferDraft((state) => state.setAccountName);
  const account = useQuery({ queryKey: ['account'], queryFn: ({ signal }) => bankApi.getAccount(signal), enabled: !expired });
  const banks = useQuery({ queryKey: ['banks'], queryFn: ({ signal }) => bankApi.listBanks(signal), enabled: !expired });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const enquiry = useRef(
    createLatestQuery(async (input: { bankCode: string; accountNumber: string }, signal: AbortSignal) =>
      bankApi.resolveAccount(input, signal),
    ),
  ).current;

  const accountError = validateAccountNumber(accountNumber, account.data?.accountNumber);
  const bankError = bankCode ? validateBankCode(bankCode) : null;
  const canResolve = !accountError && !bankError && bankCode.length > 0;

  useEffect(() => {
    if (!canResolve) {
      enquiry.cancel();
      setResolving(false);
      return;
    }
    let active = true;
    setResolving(true);
    setEnquiryError(null);
    void enquiry
      .run({ bankCode, accountNumber })
      .then((result) => {
        if (!active || !result.applied) {
          return;
        }
        setAccountName(result.result.accountName);
        setEnquiryError(null);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setAccountName(null);
        setEnquiryError(error instanceof ApiError ? error.customerMessage : 'We could not confirm that account.');
      })
      .finally(() => {
        if (active) {
          setResolving(false);
        }
      });
    return () => {
      active = false;
    };
  }, [accountNumber, bankCode, canResolve, enquiry, setAccountName]);

  return (
    <KeyboardScreen>
      <ScreenIntro eyebrow="Step 1 of 3" title="Who are you paying?" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={bankName ? `Selected bank ${bankName}. Change bank` : 'Select a bank'}
        onPress={() => setPickerOpen(true)}
        style={styles.bank}
      >
        <AppIcon name="bank" size={20} color={colors.blue} wellColor={colors.blueSoft} />
        <View style={styles.bankCopy}>
          <Text style={styles.bankLabel}>Bank</Text>
          <Text style={styles.bankValue}>{bankName || 'Select a bank'}</Text>
        </View>
        <AppIcon name="chevron" size={18} color={colors.muted} />
      </Pressable>
      <TextField
        label="Account number"
        value={accountNumber}
        onChangeText={(value) => setAccountNumber(value.replace(/\D/g, '').slice(0, 10))}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
        error={accountNumber.length > 0 ? accountError : null}
        hint="10 digits"
      />
      {resolving ? <Banner tone="info" message="Checking the account name…" /> : null}
      {enquiryError ? <Banner message={enquiryError} /> : null}
      {accountName ? (
        <View style={styles.confirmed} accessibilityLabel={`Account name: ${accountName}`}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(accountName)}</Text>
          </View>
          <View style={styles.confirmedCopy}>
            <Text style={styles.confirmedLabel}>Account name</Text>
            <Text style={styles.confirmedName}>{accountName}</Text>
          </View>
        </View>
      ) : null}
      <Button label="Continue" disabled={!accountName || Boolean(accountError)} onPress={() => openScreen('/transfer/amount')} />
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modal}>
          <ScreenIntro eyebrow="Transfer" title="Select a bank" />
          <FlatList
            data={banks.data ?? []}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.name}
                style={styles.bankRow}
                onPress={() => {
                  setBank(item.code, item.name);
                  setPickerOpen(false);
                }}
              >
                <Text style={styles.bankValue}>{item.name}</Text>
                <Text style={styles.bankLabel}>{item.code}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.bankLabel}>Banks are unavailable right now.</Text>}
          />
          <Button label="Close" variant="secondary" onPress={() => setPickerOpen(false)} />
        </View>
      </Modal>
    </KeyboardScreen>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const styles = StyleSheet.create({
  bank: {
    minHeight: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    ...shadow.card,
  },
  bankCopy: { flex: 1 },
  bankLabel: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '700' },
  bankValue: { color: colors.text, fontSize: typeScale.body, fontWeight: '800', marginTop: 2 },
  confirmed: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.white, borderRadius: radius.lg, padding: space.md, ...shadow.card },
  avatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '800' },
  confirmedCopy: { flex: 1, gap: 2 },
  confirmedLabel: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '700' },
  confirmedName: { color: colors.text, fontSize: typeScale.section, fontWeight: '800' },
  modal: { flex: 1, backgroundColor: colors.background, padding: space.lg, gap: space.md },
  bankRow: {
    minHeight: 64,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
});
