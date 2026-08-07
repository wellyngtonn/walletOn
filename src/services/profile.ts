import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

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
      const accounts = Array.isArray(data.pierreAccounts)
        ? data.pierreAccounts.filter(
            (account): account is PierreAccountProfile =>
              Boolean(account) &&
              typeof account.id === "string" &&
              typeof account.name === "string" &&
              typeof account.balance === "number",
          )
        : [];
      onData({
        balance: typeof data.pierreBalance === "number" ? data.pierreBalance : null,
        accountId: typeof data.pierreAccountId === "string" ? data.pierreAccountId : null,
        accountName:
          typeof data.pierreAccountName === "string" ? data.pierreAccountName : null,
        accounts,
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
