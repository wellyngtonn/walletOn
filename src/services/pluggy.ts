import { auth } from "@/lib/firebase/config";
import { withTrailingSlash } from "@/utils/api-url";

export interface PluggyAccount {
  id: string;
  name: string;
  balance: number;
  type?: string;
  subtype?: string;
  currency?: string;
}

export interface PluggyItemStatus {
  connected: boolean;
  status: string | null;
  executionStatus: string | null;
  error?: { code?: string; message?: string } | null;
}

type SaveItemResponse = {
  ok: boolean;
  message: string;
  accounts: PluggyAccount[];
  balance: number | null;
  itemStatus: string | null;
};

type SyncResponse = { imported: number; total?: number; balance?: number };

const PLUGGY_CLIENT_TIMEOUT_MS = 55_000;

function pluggyApiUrl() {
  const configured = process.env.NEXT_PUBLIC_PLUGGY_API_URL;
  if (configured) return withTrailingSlash(configured);
  if (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".web.app")
  ) {
    return "https://wallet-on.vercel.app/api/pluggy/";
  }
  return "/api/pluggy/";
}

type PluggyRequest = {
  action:
    | "connect-token"
    | "save"
    | "sync"
    | "update"
    | "status"
    | "disconnect"
    | "recategorize";
  itemId?: string;
  fromDate?: string;
  toDate?: string;
  preferredAccountId?: string | null;
};

async function callPluggy<T>(body: PluggyRequest): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Faça login para conectar o Pluggy.");

  const token = await currentUser.getIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PLUGGY_CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch(pluggyApiUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as
      | (T & { error?: string })
      | null;
    if (!response.ok) {
      const error = new Error(
        data?.error || `Erro HTTP ${response.status}.`,
      );
      (error as Error & { code?: string }).code = String(response.status);
      throw error;
    }
    if (!data) throw new Error("Resposta inválida da API do Pluggy.");
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "O Pluggy demorou demais para responder. Tente novamente em instantes.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createPluggyConnectToken(itemId?: string | null) {
  return callPluggy<{ connectToken: string }>({
    action: "connect-token",
    ...(itemId ? { itemId } : {}),
  });
}

export function savePluggyItem(
  itemId: string,
  preferredAccountId?: string | null,
) {
  return callPluggy<SaveItemResponse>({
    action: "save",
    itemId,
    preferredAccountId,
  });
}

export function syncPluggyRange(
  fromDate?: string,
  toDate?: string,
  preferredAccountId?: string | null,
) {
  return callPluggy<SyncResponse>({
    action: "sync",
    fromDate,
    toDate,
    preferredAccountId,
  });
}

export function updatePluggyConnection() {
  return callPluggy<{ ok: boolean; status: string | null; executionStatus: string | null }>(
    { action: "update" },
  );
}

export function getPluggyStatus() {
  return callPluggy<PluggyItemStatus>({ action: "status" });
}

export function disconnectPluggy() {
  return callPluggy<{ ok: boolean }>({ action: "disconnect" });
}

export function recategorizeTransactions() {
  return callPluggy<{ updated: number; imported: number }>({
    action: "recategorize",
  });
}
