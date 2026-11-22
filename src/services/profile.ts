import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import {
  selectDefaultAccount,
  type BankAccountSummary,
  type BankProvider,
} from "@/utils/bank";

const profilePath = (uid: string) => doc(db, "users", uid);

export type BankAccountProfile = BankAccountSummary;

export interface BankProfile {
  provider: BankProvider | null;
  connected: boolean;
  pierreConnected: boolean;
  pluggyConnected: boolean;
  balance: number | null;
  accountId: string | null;
  accountName: string | null;
  accounts: BankAccountProfile[];
  itemId: string | null;
  itemStatus: string | null;
  connectorName: string | null;
}

function accountsFrom(value: unknown): BankAccountProfile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (account): account is Record<string, unknown> =>
        Boolean(account) && typeof account === "object",
    )
    .map((account) => ({
      id: typeof account.id === "string" ? account.id : "",
      name: typeof account.name === "string" ? account.name : "",
      balance:
        typeof account.balance === "number" && Number.isFinite(account.balance)
          ? account.balance
          : 0,
      ...(typeof account.type === "string" ? { type: account.type } : {}),
      ...(typeof account.subtype === "string"
        ? { subtype: account.subtype }
        : {}),
    }))
    .filter((account) => account.id && account.name);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

export function subscribeBankProfile(
  uid: string,
  onData: (profile: BankProfile) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    profilePath(uid),
    (snapshot) => {
      const data = snapshot.data() || {};
      const legacyConfig = objectValue(data.cfg);

      const pierreAccounts = accountsFrom(
        Array.isArray(data.pierreAccounts)
          ? data.pierreAccounts
          : legacyConfig.pierreAccounts,
      );
      const pluggyAccounts = accountsFrom(data.pluggyAccounts);

      const pierreConnected =
        data.pierreApiKeyConfigured === true ||
        (typeof data.pierreApiKey === "string" && data.pierreApiKey.length > 0) ||
        (typeof legacyConfig.pierreKey === "string" &&
          legacyConfig.pierreKey.length > 0);
      const pluggyConnected =
        data.pluggyConnected === true || Boolean(stringValue(data.pluggyItemId));

      let provider: BankProvider | null = null;
      if (data.bankProvider === "pluggy" && pluggyConnected) provider = "pluggy";
      else if (data.bankProvider === "pierre" && pierreConnected) provider = "pierre";
      else if (pluggyConnected) provider = "pluggy";
      else if (pierreConnected) provider = "pierre";

      if (!provider) {
        onData({
          provider: null,
          connected: false,
          pierreConnected,
          pluggyConnected,
          balance: null,
          accountId: null,
          accountName: null,
          accounts: [],
          itemId: null,
          itemStatus: null,
          connectorName: null,
        });
        return;
      }

      const accounts = provider === "pluggy" ? pluggyAccounts : pierreAccounts;
      const configuredAccountId =
        provider === "pluggy"
          ? stringValue(data.pluggyAccountId)
          : stringValue(data.pierreAccountId) ||
            stringValue(legacyConfig.pierreAccountId);
      const balanceCandidates =
        provider === "pluggy"
          ? [data.pluggyBalance]
          : [data.pierreBalance, legacyConfig.pierreTotalBalance];
      const configuredBalance =
        balanceCandidates.find(
          (value): value is number =>
            typeof value === "number" && Number.isFinite(value),
        ) ?? null;
      const selectedAccount =
        accounts.find((account) => account.id === configuredAccountId) ||
        selectDefaultAccount(accounts);
      const configuredName =
        provider === "pluggy"
          ? stringValue(data.pluggyAccountName)
          : stringValue(data.pierreAccountName);

      onData({
        provider,
        connected: true,
        pierreConnected,
        pluggyConnected,
        balance: selectedAccount?.balance ?? configuredBalance,
        accountId: selectedAccount?.id ?? configuredAccountId,
        accountName: selectedAccount?.name ?? configuredName,
        accounts,
        itemId:
          provider === "pluggy" ? stringValue(data.pluggyItemId) : null,
        itemStatus:
          provider === "pluggy" ? stringValue(data.pluggyItemStatus) : null,
        connectorName:
          provider === "pluggy"
            ? stringValue(data.pluggyConnectorName)
            : null,
      });
    },
    onError,
  );
}

export function saveAccountSelection(
  uid: string,
  provider: BankProvider,
  account: BankAccountProfile,
) {
  const prefix = provider === "pluggy" ? "pluggy" : "pierre";
  return setDoc(
    profilePath(uid),
    {
      bankProvider: provider,
      [`${prefix}AccountId`]: account.id,
      [`${prefix}AccountName`]: account.name,
      [`${prefix}Balance`]: account.balance,
      [`${prefix}BalanceUpdatedAt`]: serverTimestamp(),
    },
    { merge: true },
  );
}

export function savePierreAccountSelection(
  uid: string,
  account: BankAccountProfile,
) {
  return saveAccountSelection(uid, "pierre", account);
}

export function savePluggyAccountSelection(
  uid: string,
  account: BankAccountProfile,
) {
  return saveAccountSelection(uid, "pluggy", account);
}
