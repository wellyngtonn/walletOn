import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { selectDefaultPierreAccount } from "@/utils/pierre";

const profilePath = (uid: string) => doc(db, "users", uid);

export interface PierreAccountProfile {
  id: string;
  name: string;
  balance: number;
}

export interface PierreProfile {
  balance: number | null;
  accountId: string | null;
  accountName: string | null;
  accounts: PierreAccountProfile[];
  hasApiKey: boolean;
}

export function subscribePierreProfile(
  uid: string,
  onData: (profile: PierreProfile) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    profilePath(uid),
    (snapshot) => {
      const data = snapshot.data() || {};
      const legacyConfig =
        data.cfg && typeof data.cfg === "object"
          ? (data.cfg as Record<string, unknown>)
          : {};
      const rawAccounts = Array.isArray(data.pierreAccounts)
        ? data.pierreAccounts
        : Array.isArray(legacyConfig.pierreAccounts)
          ? legacyConfig.pierreAccounts
          : [];
      const accounts = rawAccounts.filter(
            (account): account is PierreAccountProfile =>
              Boolean(account) &&
              typeof account.id === "string" &&
              typeof account.name === "string" &&
              typeof account.balance === "number",
          );
      const configuredAccountId =
        typeof data.pierreAccountId === "string"
          ? data.pierreAccountId
          : typeof legacyConfig.pierreAccountId === "string"
            ? legacyConfig.pierreAccountId
            : null;
      const selectedAccount =
        accounts.find((account) => account.id === configuredAccountId) ||
        selectDefaultPierreAccount(accounts);
      const configuredBalance =
        typeof data.pierreBalance === "number"
          ? data.pierreBalance
          : typeof legacyConfig.pierreTotalBalance === "number"
            ? legacyConfig.pierreTotalBalance
            : null;
      onData({
        balance:
          selectedAccount?.balance ?? configuredBalance,
        accountId: selectedAccount?.id ?? configuredAccountId,
        accountName:
          typeof data.pierreAccountName === "string"
            ? data.pierreAccountName
            : selectedAccount?.name || null,
        accounts,
        hasApiKey:
          data.pierreApiKeyConfigured === true ||
          (typeof data.pierreApiKey === "string" && data.pierreApiKey.length > 0) ||
          (typeof legacyConfig.pierreKey === "string" && legacyConfig.pierreKey.length > 0),
      });
    },
    onError,
  );
}

export function savePierreAccounts(
  uid: string,
  accounts: PierreAccountProfile[],
  selectedAccount: PierreAccountProfile,
) {
  return setDoc(
    profilePath(uid),
    {
      pierreAccounts: accounts,
      pierreAccountId: selectedAccount.id,
      pierreAccountName: selectedAccount.name,
      pierreBalance: selectedAccount.balance,
      pierreBalanceUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function savePierreAccountSelection(
  uid: string,
  account: PierreAccountProfile,
) {
  return setDoc(
    profilePath(uid),
    {
      pierreAccountId: account.id,
      pierreAccountName: account.name,
      pierreBalance: account.balance,
      pierreBalanceUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
