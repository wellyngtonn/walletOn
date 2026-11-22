import {
  FieldValue,
  type DocumentReference,
} from "firebase-admin/firestore";
import {
  mapPluggyAccounts,
  mapPluggyTransactions,
  pluggyTransactionDocId,
  type MappedBankAccount,
  type MappedBankTransaction,
} from "../src/utils/pluggy.js";
import { selectDefaultAccount } from "../src/utils/bank.js";
import { categorizeTransaction } from "../src/utils/transaction-category.js";
import {
  ApiError,
  bodyRecord,
  errorStatus,
  firestore,
  preferredAccountId,
  setCors,
  syncPeriod,
  userReference,
  verifyFirebaseToken,
  bearerToken,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/shared.js";
import {
  createConnectToken,
  deleteItem,
  fetchAccounts,
  fetchItem,
  fetchTransactions,
  pluggyAuth,
  requestItemUpdate,
  type PluggyItem,
} from "./_lib/pluggy-client.js";

function selectedAccount(
  accounts: MappedBankAccount[],
  preferredId: string | null,
) {
  return (
    accounts.find((account) => account.id === preferredId) ||
    selectDefaultAccount(accounts) ||
    null
  );
}

async function getPluggyItemId(uid: string) {
  const privateDocument = await userReference(uid)
    .collection("private")
    .doc("pluggy")
    .get();
  const privateItemId = privateDocument.data()?.itemId;
  if (typeof privateItemId === "string" && privateItemId) return privateItemId;

  const profile = await userReference(uid).get();
  const publicItemId = profile.data()?.pluggyItemId;
  return typeof publicItemId === "string" ? publicItemId : "";
}

function assertItemOwnership(item: PluggyItem, uid: string) {
  const owner =
    typeof item.clientUserId === "string" ? item.clientUserId.trim() : "";
  if (owner !== uid) {
    throw new ApiError("Esta conexão não pertence ao usuário.", 403);
  }
}

async function savePluggyConnection(uid: string, item: PluggyItem) {
  const connectorId =
    typeof item.connector?.id === "number" ? item.connector.id : null;
  const connectorName =
    typeof item.connector?.name === "string" ? item.connector.name : null;

  await userReference(uid).collection("private").doc("pluggy").set(
    {
      itemId: item.id,
      connectorId,
      connectorName,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await userReference(uid).set(
    {
      bankProvider: "pluggy",
      pluggyConnected: true,
      pluggyItemId: item.id,
      pluggyItemStatus: item.status || null,
      pluggyExecutionStatus: item.executionStatus || null,
      pluggyConnectorId: connectorId,
      pluggyConnectorName: connectorName,
    },
    { merge: true },
  );

  return { connectorId, connectorName };
}

async function savePluggyProfile(
  uid: string,
  item: PluggyItem,
  accounts: MappedBankAccount[],
  preferredId: string | null,
) {
  const selected = selectedAccount(accounts, preferredId);
  if (!selected) {
    throw new ApiError("Nenhuma conta encontrada no Pluggy.", 412);
  }

  await savePluggyConnection(uid, item);

  await userReference(uid).set(
    {
      pluggyAccounts: accounts,
      pluggyAccountId: selected.id,
      pluggyAccountName: selected.name,
      pluggyBalance: selected.balance,
      pluggyBalanceUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return selected;
}

async function persistPluggyTransactions(
  uid: string,
  items: MappedBankTransaction[],
) {
  const unique = new Map<string, MappedBankTransaction>();
  items.forEach((item) => unique.set(item.id, item));
  const transactions = Array.from(unique.values());
  const reference = userReference(uid).collection("transactions");

  const existingSnapshot = await reference
    .where("provider", "==", "pluggy")
    .get();
  const existingIds = new Set(
    existingSnapshot.docs
      .map((document) => document.data().externalId)
      .filter((id): id is string => typeof id === "string" && Boolean(id)),
  );

  const newItems = transactions.filter((item) => !existingIds.has(item.id));

  for (let start = 0; start < newItems.length; start += 400) {
    const batch = firestore().batch();
    newItems.slice(start, start + 400).forEach((item) => {
      const [referenceYear, referenceMonth] = item.date.split("-").map(Number);
      batch.set(reference.doc(pluggyTransactionDocId(item.id)), {
        userId: uid,
        type: item.type,
        description: item.description,
        amount: item.amount,
        date: item.date,
        referenceMonth,
        referenceYear,
        externalId: item.id,
        provider: "pluggy",
        category: item.category,
        accountId: item.accountId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return newItems.length;
}

async function recategorizeTransactions(uid: string) {
  const snapshot = await userReference(uid).collection("transactions").get();
  const updates: Array<{ reference: DocumentReference; category: string }> = [];
  let imported = 0;

  snapshot.docs.forEach((document) => {
    const data = document.data();
    if (!data.pierreId && !data.externalId) return;
    if (data.categorySource === "manual") return;
    imported += 1;

    const current = typeof data.category === "string" ? data.category : "";
    const type =
      data.type === "income" || data.type === "investment"
        ? data.type
        : "expense";
    const category = categorizeTransaction({
      description:
        typeof data.description === "string" ? data.description : "",
      category: current,
      type,
    });

    if (category && category !== current) {
      updates.push({ reference: document.ref, category });
    }
  });

  for (let start = 0; start < updates.length; start += 450) {
    const batch = firestore().batch();
    updates.slice(start, start + 450).forEach(({ reference, category }) => {
      batch.update(reference, {
        category,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return { updated: updates.length, imported };
}

async function syncPluggy(uid: string, body: Record<string, unknown>) {
  const itemId = await getPluggyItemId(uid);
  if (!itemId) {
    throw new ApiError("Conecte uma conta do Pluggy primeiro.", 412);
  }

  const { from, to } = syncPeriod(body);
  const apiKey = await pluggyAuth();
  const item = await fetchItem(apiKey, itemId);
  assertItemOwnership(item, uid);
  const rawAccounts = await fetchAccounts(apiKey, itemId);
  const accounts = mapPluggyAccounts(rawAccounts);
  if (!accounts.length) {
    throw new ApiError("Nenhuma conta encontrada no Pluggy.", 412);
  }

  const selected = await savePluggyProfile(
    uid,
    item,
    accounts,
    preferredAccountId(body),
  );

  const transactions: MappedBankTransaction[] = [];
  for (const account of accounts) {
    const raw = await fetchTransactions(apiKey, account.id, from, to);
    transactions.push(...mapPluggyTransactions(raw, account.id));
  }

  const imported = await persistPluggyTransactions(uid, transactions);
  return {
    imported,
    total: transactions.length,
    balance: selected.balance,
  };
}

async function updatePluggyItem(uid: string) {
  const itemId = await getPluggyItemId(uid);
  if (!itemId) {
    throw new ApiError("Conecte uma conta do Pluggy primeiro.", 412);
  }
  const apiKey = await pluggyAuth();
  const current = await fetchItem(apiKey, itemId);
  assertItemOwnership(current, uid);
  const item = await requestItemUpdate(apiKey, itemId);
  await userReference(uid).set(
    {
      pluggyItemStatus: item.status || null,
      pluggyExecutionStatus: item.executionStatus || null,
    },
    { merge: true },
  );
  return {
    ok: true,
    status: item.status || null,
    executionStatus: item.executionStatus || null,
  };
}

async function pluggyStatus(uid: string) {
  const itemId = await getPluggyItemId(uid);
  if (!itemId) {
    return { connected: false, status: null, executionStatus: null };
  }
  const apiKey = await pluggyAuth();
  const item = await fetchItem(apiKey, itemId);
  assertItemOwnership(item, uid);
  await userReference(uid).set(
    {
      pluggyItemStatus: item.status || null,
      pluggyExecutionStatus: item.executionStatus || null,
    },
    { merge: true },
  );
  return {
    connected: true,
    status: item.status || null,
    executionStatus: item.executionStatus || null,
    error: item.error || null,
  };
}

async function disconnectPluggy(uid: string) {
  const itemId = await getPluggyItemId(uid);
  if (itemId) {
    try {
      const apiKey = await pluggyAuth();
      const item = await fetchItem(apiKey, itemId);
      assertItemOwnership(item, uid);
      await deleteItem(apiKey, itemId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) throw error;
      console.warn("Não foi possível remover o item no Pluggy; limpando apenas o vínculo local.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await userReference(uid).collection("private").doc("pluggy").delete();

  const profile = await userReference(uid).get();
  const data = profile.data() || {};
  const legacyConfig =
    data.cfg && typeof data.cfg === "object"
      ? (data.cfg as Record<string, unknown>)
      : {};
  const hasPierre =
    data.pierreApiKeyConfigured === true ||
    (typeof data.pierreApiKey === "string" && data.pierreApiKey.length > 0) ||
    (typeof legacyConfig.pierreKey === "string" &&
      legacyConfig.pierreKey.length > 0);

  await userReference(uid).set(
    {
      pluggyConnected: FieldValue.delete(),
      pluggyItemId: FieldValue.delete(),
      pluggyItemStatus: FieldValue.delete(),
      pluggyExecutionStatus: FieldValue.delete(),
      pluggyConnectorId: FieldValue.delete(),
      pluggyConnectorName: FieldValue.delete(),
      pluggyAccounts: FieldValue.delete(),
      pluggyAccountId: FieldValue.delete(),
      pluggyAccountName: FieldValue.delete(),
      pluggyBalance: FieldValue.delete(),
      pluggyBalanceUpdatedAt: FieldValue.delete(),
      bankProvider: hasPierre ? "pierre" : FieldValue.delete(),
    },
    { merge: true },
  );

  return { ok: true };
}

async function createToken(uid: string, body: Record<string, unknown>) {
  const itemId =
    typeof body.itemId === "string" && body.itemId.trim()
      ? body.itemId.trim()
      : null;
  const apiKey = await pluggyAuth();
  if (itemId) {
    const storedItemId = await getPluggyItemId(uid);
    if (storedItemId !== itemId) {
      throw new ApiError("Esta conexão não pertence ao usuário.", 403);
    }
    const item = await fetchItem(apiKey, itemId);
    assertItemOwnership(item, uid);
  }

  const connectToken = await createConnectToken(apiKey, {
    clientUserId: uid,
    itemId,
    webhookUrl: process.env.PLUGGY_WEBHOOK_URL,
  });
  return { connectToken };
}

async function savePluggyItem(uid: string, body: Record<string, unknown>) {
  const itemId =
    typeof body.itemId === "string" ? body.itemId.trim() : "";
  if (!itemId) {
    throw new ApiError("Informe o itemId retornado pelo Pluggy.", 400);
  }

  const apiKey = await pluggyAuth();
  const item = await fetchItem(apiKey, itemId);
  assertItemOwnership(item, uid);
  const rawAccounts = await fetchAccounts(apiKey, itemId);
  const accounts = mapPluggyAccounts(rawAccounts);
  if (!accounts.length) {
    await savePluggyConnection(uid, item);
    return {
      ok: true,
      message:
        "Conexão criada! O banco ainda está enviando os dados; sincronize novamente em instantes.",
      accounts: [],
      balance: null,
      itemStatus: item.status || null,
    };
  }

  const selected = await savePluggyProfile(
    uid,
    item,
    accounts,
    preferredAccountId(body),
  );

  return {
    ok: true,
    message: "Conexão Pluggy estabelecida!",
    accounts,
    balance: selected.balance,
    itemStatus: item.status || null,
  };
}

export default async function handler(
  request: ApiRequest,
  response: ApiResponse,
) {
  setCors(
    response,
    typeof request.headers.origin === "string"
      ? request.headers.origin
      : undefined,
  );
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Método não permitido." });
  }

  const token = bearerToken(request);
  if (!token) {
    return response.status(401).json({ error: "Faça login para continuar." });
  }

  try {
    const uid = await verifyFirebaseToken(token);
    const body = bodyRecord(request.body);
    const action = typeof body.action === "string" ? body.action.trim() : "";

    if (action === "connect-token") {
      return response.status(200).json(await createToken(uid, body));
    }
    if (action === "save") {
      return response.status(200).json(await savePluggyItem(uid, body));
    }
    if (action === "sync") {
      return response.status(200).json(await syncPluggy(uid, body));
    }
    if (action === "recategorize") {
      return response.status(200).json(await recategorizeTransactions(uid));
    }
    if (action === "update") {
      return response.status(200).json(await updatePluggyItem(uid));
    }
    if (action === "status") {
      return response.status(200).json(await pluggyStatus(uid));
    }
    if (action === "disconnect") {
      return response.status(200).json(await disconnectPluggy(uid));
    }

    return response.status(400).json({ error: "Ação inválida." });
  } catch (error) {
    const status = errorStatus(error);
    console.error("Falha na API Pluggy", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return response.status(status).json({
      error:
        status >= 500
          ? "Não foi possível falar com o Pluggy agora."
          : error instanceof Error
            ? error.message
            : "Não foi possível falar com o Pluggy agora.",
    });
  }
}
