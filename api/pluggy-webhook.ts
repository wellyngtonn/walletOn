import { FieldValue } from "firebase-admin/firestore";
import {
  bodyRecord,
  errorStatus,
  firestore,
  userReference,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/shared.js";

const CONNECTION_FIELDS = [
  "pluggyConnected",
  "pluggyItemId",
  "pluggyItemStatus",
  "pluggyExecutionStatus",
  "pluggyConnectorId",
  "pluggyConnectorName",
  "pluggyAccounts",
  "pluggyAccountId",
  "pluggyAccountName",
  "pluggyBalance",
  "pluggyBalanceUpdatedAt",
];

function providedSecret(request: ApiRequest) {
  const header = request.headers["x-pluggy-webhook-secret"];
  if (typeof header === "string" && header) return header;
  try {
    const url = new URL(request.url || "", "https://localhost");
    return url.searchParams.get("secret") || "";
  } catch {
    return "";
  }
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index++) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

async function findUid(payload: Record<string, unknown>, itemId: string) {
  const rawClientUserId =
    typeof payload.clientUserId === "string" ? payload.clientUserId : "";
  const clientUserId = /^[A-Za-z0-9_-]{1,128}$/.test(rawClientUserId)
    ? rawClientUserId
    : "";
  if (clientUserId) {
    const document = await userReference(clientUserId).get();
    if (document.exists) return clientUserId;
  }
  if (itemId) {
    const snapshot = await firestore()
      .collection("users")
      .where("pluggyItemId", "==", itemId)
      .limit(1)
      .get();
    if (!snapshot.empty) return snapshot.docs[0].id;
  }
  return "";
}

async function clearConnection(uid: string) {
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

  await userReference(uid).collection("private").doc("pluggy").delete();

  const update: Record<string, unknown> = {
    bankProvider: hasPierre ? "pierre" : FieldValue.delete(),
  };
  CONNECTION_FIELDS.forEach((field) => {
    update[field] = FieldValue.delete();
  });
  await userReference(uid).set(update, { merge: true });
}

export default async function handler(
  request: ApiRequest,
  response: ApiResponse,
) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Método não permitido." });
  }

  const expectedSecret = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("PLUGGY_WEBHOOK_SECRET não configurado na Vercel.");
    return response.status(503).json({ error: "Webhook não configurado." });
  }
  if (!safeEqual(providedSecret(request), expectedSecret)) {
    return response.status(401).json({ error: "Assinatura inválida." });
  }

  try {
    const payload = bodyRecord(request.body);
    const event = typeof payload.event === "string" ? payload.event : "";
    const itemId = typeof payload.itemId === "string" ? payload.itemId : "";
    if (!event || !itemId) {
      return response.status(200).json({ ok: true, ignored: true });
    }

    const uid = await findUid(payload, itemId);
    if (!uid) {
      return response.status(200).json({ ok: true, ignored: true });
    }

    if (event === "item/deleted") {
      await clearConnection(uid);
      return response.status(200).json({ ok: true });
    }

    await userReference(uid).set(
      {
        pluggySyncRequestedAt: FieldValue.serverTimestamp(),
        pluggyLastWebhookEvent: event,
      },
      { merge: true },
    );

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("Falha no webhook do Pluggy", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return response.status(errorStatus(error)).json({
      error: "Não foi possível processar o webhook.",
    });
  }
}
