import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type {
  ShoppingHistory,
  ShoppingHistoryInput,
  ShoppingItem,
  ShoppingItemInput,
} from "@/types";

const userPath = (uid: string) => doc(db, "users", uid);
const historyPath = (uid: string) => collection(db, "users", uid, "shoppingHistory");

function storedItems(value: unknown): ShoppingItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ShoppingItem =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as ShoppingItem).id === "string" &&
      typeof (item as ShoppingItem).name === "string",
  );
}

function storedHistory(snapshotId: string, value: unknown): ShoppingHistory | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<ShoppingHistory>;
  if (
    typeof record.userId !== "string" ||
    typeof record.date !== "string" ||
    typeof record.total !== "number" ||
    !Array.isArray(record.items)
  ) {
    return null;
  }

  const items = record.items.filter(
    (item): item is { name: string; qty: number; price?: number } =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as { name?: unknown }).name === "string" &&
      typeof (item as { qty?: unknown }).qty === "number",
  );
  return {
    id: snapshotId,
    userId: record.userId,
    date: record.date,
    total: record.total,
    items,
  };
}

function createId() {
  return `shop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function subscribeShoppingItems(
  uid: string,
  onData: (items: ShoppingItem[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    userPath(uid),
    (snapshot) => onData(storedItems(snapshot.data()?.shopping)),
    onError,
  );
}

export async function listShoppingItems(uid: string) {
  const snapshot = await getDoc(userPath(uid));
  return storedItems(snapshot.data()?.shopping);
}

export async function createShoppingItem(uid: string, data: ShoppingItemInput) {
  const item: ShoppingItem = { id: createId(), userId: uid, ...data };
  await runTransaction(db, async (transaction) => {
    const reference = userPath(uid);
    const snapshot = await transaction.get(reference);
    const current = storedItems(snapshot.data()?.shopping);
    transaction.set(
      reference,
      { shopping: [...current, item], updatedAt: serverTimestamp() },
      { merge: true },
    );
  });
}

export async function createShoppingItemsBatch(
  uid: string,
  items: { id?: string; data: ShoppingItemInput }[],
) {
  if (!items.length) return 0;
  let created = 0;
  await runTransaction(db, async (transaction) => {
    const reference = userPath(uid);
    const snapshot = await transaction.get(reference);
    const current = storedItems(snapshot.data()?.shopping);
    const existingIds = new Set(current.map((item) => item.id));
    const next = [...current];
    items.forEach(({ id, data }) => {
      const itemId = id || createId();
      if (existingIds.has(itemId)) return;
      next.push({ id: itemId, userId: uid, ...data });
      existingIds.add(itemId);
      created++;
    });
    if (created) {
      transaction.set(
        reference,
        { shopping: next, updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
  });
  return created;
}

export async function updateShoppingItem(
  uid: string,
  id: string,
  data: ShoppingItemInput,
) {
  await runTransaction(db, async (transaction) => {
    const reference = userPath(uid);
    const snapshot = await transaction.get(reference);
    const current = storedItems(snapshot.data()?.shopping);
    const next = current.map((item) =>
      item.id === id ? { id, userId: uid, ...data } : item,
    );
    transaction.set(reference, { shopping: next, updatedAt: serverTimestamp() }, { merge: true });
  });
}

export async function deleteShoppingItem(uid: string, id: string) {
  await deleteShoppingItemsBatch(uid, [id]);
}

export async function deleteShoppingItemsBatch(uid: string, ids: string[]) {
  if (!ids.length) return;
  await runTransaction(db, async (transaction) => {
    const reference = userPath(uid);
    const snapshot = await transaction.get(reference);
    const current = storedItems(snapshot.data()?.shopping);
    const next = current.filter((item) => !ids.includes(item.id));
    transaction.set(reference, { shopping: next, updatedAt: serverTimestamp() }, { merge: true });
  });
}

export function subscribeShoppingHistory(
  uid: string,
  onData: (items: ShoppingHistory[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    historyPath(uid),
    (snapshot) => {
      const history = snapshot.docs
        .map((item) => storedHistory(item.id, item.data()))
        .filter((item): item is ShoppingHistory => Boolean(item))
        .sort((a, b) => b.date.localeCompare(a.date));
      onData(history);
    },
    onError,
  );
}

export async function listShoppingHistory(uid: string) {
  const snapshot = await getDocs(historyPath(uid));
  return snapshot.docs
    .map((item) => storedHistory(item.id, item.data()))
    .filter((item): item is ShoppingHistory => Boolean(item))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function createShoppingHistory(
  uid: string,
  data: ShoppingHistoryInput,
  id?: string,
) {
  const reference = id ? doc(historyPath(uid), id) : doc(historyPath(uid));
  await setDoc(reference, {
    id: reference.id,
    userId: uid,
    ...data,
    createdAt: serverTimestamp(),
  });
  return reference.id;
}

export async function ensureShoppingHistory(
  uid: string,
  data: ShoppingHistoryInput,
) {
  const id = `shopping-history-${data.date}`;
  const reference = doc(historyPath(uid), id);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    await createShoppingHistory(uid, data, id);
    return;
  }

  const existing = storedHistory(snapshot.id, snapshot.data());
  const needsPriceImport =
    existing &&
    existing.items.length > 0 &&
    existing.items.some((item) => typeof item.price !== "number");
  if (needsPriceImport) await createShoppingHistory(uid, data, id);
}
