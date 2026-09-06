const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

initializeApp();

const db = getFirestore();
const REGION = "southamerica-east1";

const {
  fetchAccounts,
  fetchTransactions,
  triggerUpdate,
  validateKey,
} = require("./pierre");

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }
  return request.auth.uid;
}

function profileReference(uid) {
  return db.collection("users").doc(uid);
}

function selectedAccount(accounts, preferredAccountId) {
  return accounts.find((account) => account.id === preferredAccountId) ||
    accounts.reduce(
      (highest, account) => (!highest || account.balance > highest.balance ? account : highest),
      null,
    );
}

function pierreHttpsError(error, fallbackMessage) {
  const status = Number(error?.status);
  if (status === 401) return new HttpsError("failed-precondition", "API Key Pierre inválida.");
  if (status === 403) return new HttpsError("permission-denied", "A API do Pierre negou o acesso.");
  if (status === 404) return new HttpsError("not-found", "Endpoint do Pierre não encontrado.");
  if (status === 408 || status === 429 || status >= 500) {
    return new HttpsError("unavailable", "O Pierre está indisponível no momento. Tente novamente em instantes.");
  }
  return new HttpsError("internal", fallbackMessage);
}

async function savePierreProfile(uid, key, accounts, preferredAccountId) {
  const selected = selectedAccount(accounts, preferredAccountId);
  if (!selected) throw new HttpsError("failed-precondition", "Nenhuma carteira encontrada no Pierre.");
  await profileReference(uid).collection("private").doc("pierre").set({
    apiKey: key,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await profileReference(uid).set({
    pierreApiKeyConfigured: true,
    pierreApiKey: FieldValue.delete(),
    "cfg.pierreKey": FieldValue.delete(),
    pierreAccounts: accounts,
    pierreAccountId: selected.id,
    pierreAccountName: selected.name,
    pierreBalance: selected.balance,
    pierreBalanceUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return selected;
}

function syncPeriod(data) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const ago = new Date(now);
  ago.setFullYear(now.getFullYear() - 1);
  const from = typeof data?.fromDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.fromDate)
    ? data.fromDate
    : ago.toISOString().slice(0, 10);
  const to = typeof data?.toDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.toDate)
    ? data.toDate
    : today;
  if (!validDate(from) || !validDate(to) || from > to) {
    throw new HttpsError("invalid-argument", "Período inválido.");
  }
  return { from, to };
}

exports.validatePierreKey = onCall(
  { region: REGION },
  async (request) => {
    requireAuth(request);
    const key = typeof request.data?.key === "string" ? request.data.key.trim() : "";
    if (!key) throw new HttpsError("invalid-argument", "Informe a API Key.");
    return validateKey(key);
  },
);

exports.savePierreApiKey = onCall(
  { region: REGION },
  async (request) => {
    const uid = requireAuth(request);
    const key = typeof request.data?.key === "string" ? request.data.key.trim() : "";
    const preferredAccountId = typeof request.data?.preferredAccountId === "string"
      ? request.data.preferredAccountId
      : null;
    if (!key) throw new HttpsError("invalid-argument", "Informe a API Key.");
    const validation = await validateKey(key);
    if (!validation.ok) throw new HttpsError("failed-precondition", validation.message);
    try {
      const accounts = await fetchAccounts(key);
      await savePierreProfile(uid, key, accounts, preferredAccountId);
      return { ok: true, message: validation.message, accounts };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Falha ao salvar a chave Pierre", { uid, error: String(error) });
      throw pierreHttpsError(error, "Não foi possível salvar a conexão Pierre.");
    }
  },
);

exports.syncPierreData = onCall(
  { region: REGION, timeoutSeconds: 60, memory: "512MiB" },
  async (request) => {
    const uid = requireAuth(request);
    const profile = await profileReference(uid).get();
    const profileData = profile.data() || {};
    const legacyConfig = profileData.cfg && typeof profileData.cfg === "object"
      ? profileData.cfg
      : {};
    const privateProfile = await profileReference(uid).collection("private").doc("pierre").get();
    const privateData = privateProfile.data() || {};
    const key = typeof privateData.apiKey === "string"
      ? privateData.apiKey.trim()
      : typeof profileData.pierreApiKey === "string"
        ? profileData.pierreApiKey.trim()
        : typeof legacyConfig.pierreKey === "string"
          ? legacyConfig.pierreKey.trim()
          : "";
    if (!key) throw new HttpsError("failed-precondition", "Configure a API Key Pierre primeiro.");

    const { from, to } = syncPeriod(request.data);
    try {
      const validation = await validateKey(key);
      if (!validation.ok) throw new HttpsError("failed-precondition", validation.message);
      await triggerUpdate(key);
      const accounts = await fetchAccounts(key);
      const preferredAccountId = typeof request.data?.preferredAccountId === "string"
        ? request.data.preferredAccountId
        : null;
      await savePierreProfile(uid, key, accounts, preferredAccountId);

      const items = await fetchTransactions(key, from, to, accounts);
      const existingSnapshot = await profileReference(uid).collection("transactions").get();
      const existingIds = new Set(
        existingSnapshot.docs
          .map((document) => document.data().pierreId)
          .filter((id) => typeof id === "string" && id),
      );
      const newItems = items.filter((item) => !existingIds.has(item.id));
      for (let start = 0; start < newItems.length; start += 450) {
        const batch = db.batch();
        newItems.slice(start, start + 450).forEach((item) => {
          const reference = profileReference(uid).collection("transactions").doc();
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
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Falha na sincronização Pierre", {
        uid,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw pierreHttpsError(error, "Não foi possível sincronizar o Pierre agora.");
    }
  },
);
