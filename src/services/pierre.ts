import { auth } from "@/lib/firebase/config";
import { withTrailingSlash } from "@/utils/api-url";

export interface PierreAccount {
  id: string;
  name: string;
  balance: number;
}

type SaveKeyResponse = { ok: boolean; message: string; accounts: PierreAccount[] };
type SyncResponse = { imported: number };

function pierreApiUrl() {
  const configured = process.env.NEXT_PUBLIC_PIERRE_API_URL;
  if (configured) return withTrailingSlash(configured);
  if (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".web.app")
  ) {
    return "https://wallet-on.vercel.app/api/pierre/";
  }
  return "/api/pierre/";
}
const PIERRE_CLIENT_TIMEOUT_MS = 45_000;

type PierreRequest = {
  action: "save" | "sync" | "update";
  key?: string;
  fromDate?: string;
  toDate?: string;
  preferredAccountId?: string | null;
  manualUpdate?: boolean;
};

async function callPierre<T>(body: PierreRequest): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Faça login para sincronizar o Pierre.");
  const token = await currentUser.getIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PIERRE_CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch(pierreApiUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
    if (!response.ok) {
      const error = new Error(data?.error || `Erro HTTP ${response.status}.`);
      (error as Error & { code?: string }).code = String(response.status);
      throw error;
    }
    if (!data) throw new Error("Resposta inválida da API do Pierre.");
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("O Pierre demorou demais para responder. Tente novamente em instantes.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
  manualUpdate = false,
) {
  return callPierre<SyncResponse>({
    action: "sync",
    fromDate,
    toDate,
    preferredAccountId,
    manualUpdate,
  });
}

export async function triggerPierreUpdate() {
  return callPierre<{ ok: boolean }>({ action: "update" });
}
