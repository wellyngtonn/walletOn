import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

const profilePath = (uid: string) => doc(db, "users", uid);

export function subscribePierreBalance(
  uid: string,
  onData: (balance: number | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    profilePath(uid),
    (snapshot) => {
      const balance = snapshot.data()?.pierreBalance;
      onData(typeof balance === "number" ? balance : null);
    },
    onError,
  );
}

export function savePierreBalance(uid: string, balance: number) {
  return setDoc(
    profilePath(uid),
    {
      pierreBalance: balance,
      pierreBalanceUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
