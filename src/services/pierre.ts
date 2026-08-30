import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/lib/firebase/config";

export interface PierreAccount {
  id: string;
  name: string;
  balance: number;
}

export interface PierreTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "receita" | "despesa";
  category: string;
  accountId: string;
}

type ValidationResponse = { ok: boolean; message: string };
type SaveKeyResponse = ValidationResponse & { accounts: PierreAccount[] };
type SyncResponse = { imported: number };

const functions = getFunctions(firebaseApp, "southamerica-east1");
const validateKeyCall = httpsCallable<{ key: string }, ValidationResponse>(
  functions,
  "validatePierreKey",
);
const saveKeyCall = httpsCallable<
  { key: string; preferredAccountId?: string | null },
  SaveKeyResponse
>(functions, "savePierreApiKey");
const syncCall = httpsCallable<
  { fromDate?: string; toDate?: string; preferredAccountId?: string | null },
  SyncResponse
>(functions, "syncPierreData");

export async function validatePierreKey(key: string) {
  const result = await validateKeyCall({ key: key.trim() });
  return result.data;
}

export async function savePierreKey(
  key: string,
  preferredAccountId?: string | null,
) {
  const result = await saveKeyCall({
    key: key.trim(),
    preferredAccountId,
  });
  return result.data;
}

export async function syncPierreRange(
  fromDate?: string,
  toDate?: string,
  preferredAccountId?: string | null,
) {
  const result = await syncCall({ fromDate, toDate, preferredAccountId });
  return result.data;
}
