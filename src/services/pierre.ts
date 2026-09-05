import { auth } from "@/lib/firebase/config";

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
type BalanceResponse = { accounts: PierreAccount[]; balance: number | null };

const pierreApiUrl = process.env.NEXT_PUBLIC_PIERRE_API_URL || "/api/pierre";

type PierreRequest = {
  action: "validate" | "save" | "sync" | "balance";
  key?: string;
  fromDate?: string;
  toDate?: string;
  preferredAccountId?: string | null;
};

async function callPierre<T>(body: PierreRequest): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Faça login para sincronizar o Pierre.");
  const token = await currentUser.getIdToken();
  const response = await fetch(pierreApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) {
    const error = new Error(data?.error || `Erro HTTP ${response.status}.`);
    (error as Error & { code?: string }).code = String(response.status);
    throw error;
  }
  if (!data) throw new Error("Resposta inválida da API do Pierre.");
  return data;
}

export async function validatePierreKey(key: string) {
  return callPierre<ValidationResponse>({ action: "validate", key: key.trim() });
}

export async function savePierreKey(
  key: string,
  preferredAccountId?: string | null,
) {
  return callPierre<SaveKeyResponse>({
    action: "save",
    key: key.trim(),
    preferredAccountId,
  });
}

export async function syncPierreRange(
  fromDate?: string,
  toDate?: string,
  preferredAccountId?: string | null,
) {
  return callPierre<SyncResponse>({
    action: "sync",
    fromDate,
    toDate,
    preferredAccountId,
  });
}

export async function refreshPierreBalance(preferredAccountId?: string | null) {
  return callPierre<BalanceResponse>({
    action: "balance",
    preferredAccountId,
  });
}
