import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { IncomingMessage, ServerResponse } from "node:http";

type VercelRequest = IncomingMessage & { body?: unknown };
type VercelResponse = ServerResponse & {
  status: (statusCode: number) => VercelResponse;
  json: (body: unknown) => void;
};

type PierreAccount = {
  id: string;
  name: string;
  balance: number;
  aliases?: string[];
};

type PierreTransaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense";
  category: string;
  accountId: string;
};

class PierreApiError extends Error {
  constructor(public status: number, public path: string, message = "") {
    super(message || `HTTP ${status}`);
    this.name = "PierreApiError";
  }
}

const PIERRE_BASE = "https://www.pierre.finance/tools/api";
const PIERRE_TIMEOUT_MS = 10_000;

function adminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Credenciais administrativas do Firebase não estão configuradas na Vercel.");
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

function firestore() {
  return getFirestore(adminApp());
}

async function verifyFirebaseToken(token: string) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw new Error("FIREBASE_WEB_API_KEY não está configurada na Vercel.");
  const result = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!result.ok) throw Object.assign(new Error("Token Firebase inválido."), { status: 401 });
  const body = await result.json() as { users?: Array<{ localId?: string }> };
  const uid = body.users?.[0]?.localId;
  if (!uid) throw Object.assign(new Error("Token Firebase sem usuário."), { status: 401 });
  return uid;
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseAmount(raw: unknown) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  let value = String(raw ?? "").replace(/\s/g, "").replace(/^R\$/i, "");
  if (value.includes(",") && value.includes(".")) {
    value = value.lastIndexOf(",") > value.lastIndexOf(".")
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  } else if (value.includes(",")) {
    value = value.replace(",", ".");
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function listFromResponse(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  if (!data || typeof data !== "object") return [];
  const response = data as Record<string, unknown>;
  const list = response.data || response.accounts || response.transactions || response.items;
  return Array.isArray(list)
    ? list.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

async function request(path: string, key: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PIERRE_TIMEOUT_MS);
  try {
    return await fetch(`${PIERRE_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function responseError(response: Response, path: string): Promise<never> {
  let message = "";
  try {
    const body = await response.json() as { message?: unknown; error?: unknown };
    message = String(body.message || body.error || "");
  } catch {
    // A API pode devolver um corpo vazio ou não-JSON em erros upstream.
  }
  throw new PierreApiError(response.status, path, message);
}

async function validatePierreKey(key: string) {
  try {
    const response = await request("/get-accounts", key);
    if (response.ok) return { ok: true, message: "Conexão estabelecida!" };
    if (response.status === 401) return { ok: false, message: "API Key inválida." };
    return { ok: false, message: `Erro HTTP ${response.status}.` };
  } catch {
    return { ok: false, message: "Sem conexão com o servidor." };
  }
}

async function triggerUpdate(key: string) {
  await request("/manual-update", key, { method: "POST" }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function fetchAccounts(key: string): Promise<PierreAccount[]> {
  const response = await request("/get-accounts", key);
  if (!response.ok) await responseError(response, "/get-accounts");
  return listFromResponse(await response.json()).map((account, index) => {
    const aliases = [
      account.name,
      account.accountName,
      account.accountMarketingName,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim());
    return {
      id: String(account.id || account.accountId || account._id || ""),
      name: `Carteira ${index + 1} - ${aliases[0] || "Conta"}`,
      balance: parseAmount(
        account.balance ??
          account.accountBalance ??
          account.current_balance ??
          account.available_balance ??
          account.currentBalance ??
          0,
      ),
      aliases,
    };
  }).filter((account) => account.id);
}

async function fetchTransactions(
  key: string,
  startDate: string,
  endDate: string,
  accounts: PierreAccount[],
): Promise<PierreTransaction[]> {
  const params = new URLSearchParams({ startDate, endDate });
  const response = await request(`/get-transactions?${params}`, key);
  if (!response.ok) await responseError(response, "/get-transactions");

  const accountIdsByName = new Map<string, string>();
  accounts.forEach((account) => {
    [account.name, ...(account.aliases || [])].forEach((name) => {
      accountIdsByName.set(normalizeText(name), account.id);
    });
  });

  return listFromResponse(await response.json()).map((transaction) => {
    const amount = parseAmount(transaction.amount ?? transaction.value ?? 0);
    const type = String(transaction.type || transaction.transactionType || transaction.direction || "")
      .trim()
      .toUpperCase();
    const isDebit = ["DEBIT", "DESPESA", "EXPENSE", "OUT", "SAIDA", "SAÍDA"].includes(type) || amount < 0;
    const merchant = transaction.merchant;
    const merchantName = merchant && typeof merchant === "object"
      ? String((merchant as Record<string, unknown>).name || "")
      : "";
    const description = String(
      transaction.description || transaction.title || transaction.name || merchantName || "Pierre",
    ).slice(0, 120);
    const date = String(
      transaction.date || transaction.dateTime || transaction.transactionDate || transaction.createdAt || "",
    ).slice(0, 10);
    const account = transaction.account;
    const accountObject = account && typeof account === "object"
      ? account as Record<string, unknown>
      : null;
    const accountName = String(
      transaction.account_name ||
      transaction.accountName ||
      transaction.account_marketing_name ||
      transaction.accountMarketingName ||
      accountObject?.name ||
      accountObject?.accountName ||
      "",
    );
    const directAccountId = transaction.accountId ||
      transaction.account_id ||
      (typeof account === "string" ? account : "") ||
      accountObject?.id ||
      accountObject?.accountId ||
      "";

    return {
      id: String(transaction.id || transaction.transactionId || transaction._id || ""),
      description,
      amount: Math.abs(amount),
      date,
      type: isDebit ? ("expense" as const) : ("income" as const),
      category: String(transaction.category || transaction.categoryName || "Outros"),
      accountId: String(directAccountId || accountIdsByName.get(normalizeText(accountName)) || ""),
    };
  }).filter((transaction) => transaction.id && transaction.amount > 0 && validDate(transaction.date));
}

function bodyRecord(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" ? body as Record<string, unknown> : {};
}

function preferredAccountId(body: Record<string, unknown>) {
  return typeof body.preferredAccountId === "string" ? body.preferredAccountId : null;
}

function userReference(uid: string) {
  return firestore().collection("users").doc(uid);
}

function selectedAccount(accounts: PierreAccount[], preferredId: string | null) {
  return accounts.find((account) => account.id === preferredId) ||
    accounts.reduce<PierreAccount | null>(
      (highest, account) => !highest || account.balance > highest.balance ? account : highest,
      null,
    );
}

async function getPierreKey(uid: string) {
  const profile = await userReference(uid).get();
  const profileData = profile.data() || {};
  const legacyConfig = profileData.cfg && typeof profileData.cfg === "object"
    ? profileData.cfg as Record<string, unknown>
    : {};
  const privateProfile = await userReference(uid).collection("private").doc("pierre").get();
  const privateData = privateProfile.data() || {};
  return typeof privateData.apiKey === "string"
    ? privateData.apiKey.trim()
    : typeof profileData.pierreApiKey === "string"
      ? profileData.pierreApiKey.trim()
      : typeof legacyConfig.pierreKey === "string"
        ? legacyConfig.pierreKey.trim()
        : "";
}

async function savePierreProfile(
  uid: string,
  key: string,
  accounts: PierreAccount[],
  preferredId: string | null,
) {
  const selected = selectedAccount(accounts, preferredId);
  if (!selected) throw new Error("Nenhuma carteira encontrada no Pierre.");
  await userReference(uid).collection("private").doc("pierre").set({
    apiKey: key,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await userReference(uid).set({
    pierreApiKeyConfigured: true,
    pierreApiKey: FieldValue.delete(),
    "cfg.pierreKey": FieldValue.delete(),
    pierreAccounts: accounts,
    pierreAccountId: selected.id,
    pierreAccountName: selected.name,
    pierreBalance: selected.balance,
    pierreBalanceUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

function syncPeriod(body: Record<string, unknown>) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const ago = new Date(now);
  ago.setFullYear(now.getFullYear() - 1);
  const from = typeof body.fromDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fromDate)
    ? body.fromDate
    : ago.toISOString().slice(0, 10);
  const to = typeof body.toDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.toDate)
    ? body.toDate
    : today;
  if (!validDate(from) || !validDate(to) || from > to) throw new Error("Período inválido.");
  return { from, to };
}

async function syncPierre(uid: string, body: Record<string, unknown>) {
  const key = await getPierreKey(uid);
  if (!key) throw Object.assign(new Error("Configure a API Key Pierre primeiro."), { status: 412 });
  const { from, to } = syncPeriod(body);
  const validation = await validatePierreKey(key);
  if (!validation.ok) throw Object.assign(new Error(validation.message), { status: 412 });
  await triggerUpdate(key);
  const accounts = await fetchAccounts(key);
  await savePierreProfile(uid, key, accounts, preferredAccountId(body));
  const items = await fetchTransactions(key, from, to, accounts);
  const transactionReference = userReference(uid).collection("transactions");
  const existingSnapshot = await transactionReference.get();
  const existingIds = new Set(
    existingSnapshot.docs
      .map((document) => document.data().pierreId)
      .filter((id): id is string => typeof id === "string" && Boolean(id)),
  );
  const newItems = items.filter((item) => !existingIds.has(item.id));

  for (let start = 0; start < newItems.length; start += 450) {
    const batch = firestore().batch();
    newItems.slice(start, start + 450).forEach((item) => {
      const reference = transactionReference.doc();
      const [referenceYear, referenceMonth] = item.date.split("-").map(Number);
      batch.set(reference, {
        userId: uid,
        type: item.type,
        description: item.description,
        amount: item.amount,
        date: item.date,
        referenceMonth,
        referenceYear,
        pierreId: item.id,
        category: item.category,
        accountId: item.accountId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
  return { imported: newItems.length };
}

async function refreshPierreBalance(uid: string, body: Record<string, unknown>) {
  const key = await getPierreKey(uid);
  if (!key) throw Object.assign(new Error("Configure a API Key Pierre primeiro."), { status: 412 });
  const validation = await validatePierreKey(key);
  if (!validation.ok) throw Object.assign(new Error(validation.message), { status: 412 });
  await triggerUpdate(key);
  const accounts = await fetchAccounts(key);
  const selected = selectedAccount(accounts, preferredAccountId(body));
  if (!selected) throw new Error("Nenhuma carteira encontrada no Pierre.");
  await savePierreProfile(uid, key, accounts, preferredAccountId(body));
  return { accounts, balance: selected.balance };
}

function setCors(response: VercelResponse, requestOrigin?: string) {
  const configuredOrigins = (process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    ...configuredOrigins,
    "https://setenta.web.app",
    "https://setenta.firebaseapp.com",
    "https://wallet-on-c0b05.web.app",
    "https://wallet-on-c0b05.firebaseapp.com",
    "https://wallet-on.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://172.22.192.1:3001",
  ]);
  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    response.setHeader("Access-Control-Allow-Origin", requestOrigin);
  } else if (!requestOrigin && !configuredOrigins.length) {
    response.setHeader("Access-Control-Allow-Origin", "*");
  }
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Vary", "Origin");
}

function errorStatus(error: unknown) {
  const status = Number((error as { status?: unknown })?.status);
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status === 404) return 404;
  if (status === 408 || status === 429 || status >= 500) return 503;
  if (status === 412) return 412;
  return 500;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  setCors(response, typeof request.headers.origin === "string" ? request.headers.origin : undefined);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ error: "Método não permitido." });

  const authorization = request.headers.authorization;
  const token = typeof authorization === "string"
    ? authorization.replace(/^Bearer\s+/i, "").trim()
    : "";
  if (!token) return response.status(401).json({ error: "Faça login para continuar." });

  try {
    const uid = await verifyFirebaseToken(token);
    const body = bodyRecord(request.body);
    const action = typeof body.action === "string" ? body.action : "sync";

    if (action === "validate") {
      const key = typeof body.key === "string" ? body.key.trim() : "";
      if (!key) return response.status(400).json({ error: "Informe a API Key." });
      return response.status(200).json(await validatePierreKey(key));
    }

    if (action === "save") {
      const key = typeof body.key === "string" ? body.key.trim() : "";
      if (!key) return response.status(400).json({ error: "Informe a API Key." });
      const validation = await validatePierreKey(key);
      if (!validation.ok) return response.status(412).json({ error: validation.message });
      const accounts = await fetchAccounts(key);
      await savePierreProfile(uid, key, accounts, preferredAccountId(body));
      return response.status(200).json({ ok: true, message: validation.message, accounts });
    }

    if (action === "sync") {
      return response.status(200).json(await syncPierre(uid, body));
    }

    if (action === "balance") {
      return response.status(200).json(await refreshPierreBalance(uid, body));
    }

    return response.status(400).json({ error: "Ação inválida." });
  } catch (error) {
    const status = errorStatus(error);
    console.error("Falha na API Pierre", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return response.status(status).json({
      error: error instanceof Error ? error.message : "Não foi possível sincronizar o Pierre agora.",
    });
  }
}
