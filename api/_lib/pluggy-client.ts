import { ApiError } from "./shared.js";

const PLUGGY_BASE = "https://api.pluggy.ai";
const PLUGGY_TIMEOUT_MS = 20_000;
const MAX_TRANSACTION_PAGES = 60;

export interface PluggyItem {
  id: string;
  status?: string;
  executionStatus?: string;
  error?: { code?: string; message?: string } | null;
  connector?: { id?: number; name?: string } | null;
  [key: string]: unknown;
}

export interface PluggyAccount {
  id: string;
  name?: string;
  marketingName?: string;
  balance?: number;
  type?: string;
  subtype?: string;
  currencyCode?: string;
  [key: string]: unknown;
}

function credentials() {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(
      "Credenciais do Pluggy não estão configuradas na Vercel.",
      503,
      "PLUGGY_CREDENTIALS_MISSING",
    );
  }
  return { clientId, clientSecret };
}

async function pluggyRequest<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PLUGGY_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (apiKey) headers["X-API-KEY"] = apiKey;
  try {
    const response = await fetch(`${PLUGGY_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as {
        message?: string;
        description?: string;
        code?: string;
      } | null;
      const message =
        detail?.message ||
        detail?.description ||
        `Pluggy respondeu com HTTP ${response.status}.`;
      const status =
        response.status === 404
          ? 404
          : response.status === 400 || response.status === 422
            ? 400
            : 503;
      throw new ApiError(message, status, detail?.code || "");
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(
        "O Pluggy demorou demais para responder. Tente novamente em instantes.",
        503,
        "PLUGGY_TIMEOUT",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function pluggyAuth(): Promise<string> {
  const { clientId, clientSecret } = credentials();
  const result = await pluggyRequest<{ apiKey?: string }>("/auth", "", {
    method: "POST",
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!result.apiKey) {
    throw new ApiError(
      "O Pluggy não retornou uma API Key válida.",
      503,
      "PLUGGY_AUTH_FAILED",
    );
  }
  return result.apiKey;
}

export async function createConnectToken(
  apiKey: string,
  details: {
    clientUserId: string;
    itemId?: string | null;
    webhookUrl?: string;
  },
) {
  const options: Record<string, unknown> = {
    clientUserId: details.clientUserId,
    avoidDuplicates: true,
  };
  if (details.webhookUrl) options.webhookUrl = details.webhookUrl;
  const body: Record<string, unknown> = { options };
  if (details.itemId) body.itemId = details.itemId;
  const result = await pluggyRequest<{ accessToken?: string }>(
    "/connect_token",
    apiKey,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (!result.accessToken) {
    throw new ApiError(
      "O Pluggy não retornou um connect token válido.",
      503,
      "PLUGGY_CONNECT_TOKEN_FAILED",
    );
  }
  return result.accessToken;
}

export function fetchItem(apiKey: string, itemId: string) {
  return pluggyRequest<PluggyItem>(
    `/items/${encodeURIComponent(itemId)}`,
    apiKey,
  );
}

export async function fetchAccounts(
  apiKey: string,
  itemId: string,
): Promise<PluggyAccount[]> {
  const accounts: PluggyAccount[] = [];
  let page = 1;
  for (let guard = 0; guard < 20; guard++) {
    const result = await pluggyRequest<{
      results?: PluggyAccount[];
      totalPages?: number;
    }>(
      `/accounts?itemId=${encodeURIComponent(itemId)}&pageSize=100&page=${page}`,
      apiKey,
    );
    const results = Array.isArray(result.results) ? result.results : [];
    accounts.push(...results);
    const totalPages = Number(result.totalPages || 1);
    if (page >= totalPages || results.length === 0) break;
    page += 1;
  }
  return accounts;
}

export async function fetchTransactions(
  apiKey: string,
  accountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<Record<string, unknown>[]> {
  const transactions: Record<string, unknown>[] = [];
  let path =
    `/v2/transactions?accountId=${encodeURIComponent(accountId)}` +
    `&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;

  for (let page = 0; page < MAX_TRANSACTION_PAGES; page++) {
    const result = await pluggyRequest<{
      results?: unknown[];
      next?: string | null;
    }>(path, apiKey);
    const results = Array.isArray(result.results) ? result.results : [];
    transactions.push(
      ...results.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      ),
    );
    if (!result.next) break;
    path = `/v2/transactions${result.next}`;
  }

  return transactions;
}

export function requestItemUpdate(apiKey: string, itemId: string) {
  return pluggyRequest<PluggyItem>(
    `/items/${encodeURIComponent(itemId)}`,
    apiKey,
    { method: "PATCH", body: JSON.stringify({}) },
  );
}

export async function deleteItem(apiKey: string, itemId: string) {
  try {
    await pluggyRequest<unknown>(
      `/items/${encodeURIComponent(itemId)}`,
      apiKey,
      { method: "DELETE" },
    );
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }
}
