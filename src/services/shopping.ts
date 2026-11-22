import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { todayISO } from "@/utils/format";
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
    !Number.isFinite(record.total) ||
    !Array.isArray(record.items)
  ) {
    return null;
  }

  const items = record.items.filter(
    (item): item is { name: string; qty: number; price?: number; barcode?: string } =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as { name?: unknown }).name === "string" &&
      typeof (item as { qty?: unknown }).qty === "number",
  ).map((item) => ({
    name: item.name,
    qty: item.qty,
    ...(typeof item.price === "number" ? { price: item.price } : {}),
    ...(typeof item.barcode === "string" && item.barcode ? { barcode: item.barcode } : {}),
  }));
  return {
    id: snapshotId,
    userId: record.userId,
    title: typeof record.title === "string" ? record.title : "",
    date: record.date,
    total: record.total,
    items,
    ...(typeof record.photoUrl === "string" && record.photoUrl
      ? { photoUrl: record.photoUrl }
      : {}),
  };
}

function createId() {
  return `shop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeQty(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function safePrice(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
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

export async function archiveShoppingItems(uid: string, items: ShoppingItem[]) {
  if (!items.length) return 0;
  let archived = 0;

  await runTransaction(db, async (transaction) => {
    const userReference = userPath(uid);
    const userSnapshot = await transaction.get(userReference);
    const currentItems = storedItems(userSnapshot.data()?.shopping);
    const itemIds = new Set(items.map((item) => item.id));
    const itemsToArchive = currentItems.filter(
      (item) => itemIds.has(item.id) && item.done,
    );
    archived = itemsToArchive.length;
    if (!itemsToArchive.length) return;
    const archiveIds = new Set(itemsToArchive.map((item) => item.id));

    const groups = new Map<string, ShoppingItem[]>();
    itemsToArchive.forEach((item) => {
      const date = item.completedDate || todayISO();
      groups.set(date, [...(groups.get(date) || []), item]);
    });

    const historyReferences = [...groups.keys()].map((date) =>
      doc(historyPath(uid), `shopping-history-${date}`),
    );
    const existingHistory = await Promise.all(
      historyReferences.map((reference) => transaction.get(reference)),
    );

    [...groups.entries()].forEach(([date, groupedItems], index) => {
      const reference = historyReferences[index];
      const snapshot = existingHistory[index];
      const existing = snapshot.exists()
        ? storedHistory(snapshot.id, snapshot.data())
        : null;
      const historyItems = [
        ...(existing?.items || []),
        ...groupedItems.map((item) => ({
          name: item.name,
          qty: safeQty(item.qty),
          price: safePrice(item.price),
          ...(item.barcode ? { barcode: item.barcode } : {}),
        })),
      ];
      const total =
        (existing?.total || 0) +
        groupedItems.reduce(
          (sum, item) => sum + safeQty(item.qty) * safePrice(item.price),
          0,
        );
      const historyData = {
        id: reference.id,
        userId: uid,
        date,
        total,
        items: historyItems,
      } as Record<string, unknown>;
      const createdAt = existing ? snapshot.data()?.createdAt : null;
      historyData.createdAt = createdAt || serverTimestamp();
      transaction.set(
        reference,
        historyData,
        { merge: true },
      );
    });

    transaction.set(
      userReference,
      {
        shopping: currentItems.filter((item) => !archiveIds.has(item.id)),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  return archived;
}

export async function finalizeShoppingItems(uid: string) {
  await runTransaction(db, async (transaction) => {
    const userReference = userPath(uid);
    const userSnapshot = await transaction.get(userReference);
    const currentItems = storedItems(userSnapshot.data()?.shopping);
    if (!currentItems.length) return;

    const today = todayISO();
    const groups = new Map<string, ShoppingItem[]>();
    currentItems.forEach((item) => {
      const date = item.done ? item.completedDate || today : today;
      groups.set(date, [...(groups.get(date) || []), item]);
    });

    const historyReferences = [...groups.keys()].map((date) =>
      doc(historyPath(uid), `shopping-history-${date}`),
    );
    const existingHistory = await Promise.all(
      historyReferences.map((reference) => transaction.get(reference)),
    );

    [...groups.entries()].forEach(([date, groupedItems], index) => {
      const reference = historyReferences[index];
      const snapshot = existingHistory[index];
      const existing = snapshot.exists()
        ? storedHistory(snapshot.id, snapshot.data())
        : null;
      const historyItems = [
        ...(existing?.items || []),
        ...groupedItems.map((item) => ({
          name: item.name,
          qty: safeQty(item.qty),
          price: safePrice(item.price),
          ...(item.barcode ? { barcode: item.barcode } : {}),
        })),
      ];
      const total =
        (existing?.total || 0) +
        groupedItems.reduce(
          (sum, item) => sum + safeQty(item.qty) * safePrice(item.price),
          0,
        );
      const historyData = {
        id: reference.id,
        userId: uid,
        date,
        total,
        items: historyItems,
      } as Record<string, unknown>;
      const createdAt = existing ? snapshot.data()?.createdAt : null;
      historyData.createdAt = createdAt || serverTimestamp();
      transaction.set(reference, historyData, { merge: true });
    });

    transaction.set(
      userReference,
      { shopping: [], updatedAt: serverTimestamp() },
      { merge: true },
    );
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

export async function updateShoppingHistoryTitle(uid: string, id: string, title: string) {
  await updateDoc(doc(historyPath(uid), id), { title: title.trim().slice(0, 120) });
}

export async function updateShoppingHistoryPhoto(uid: string, id: string, photoUrl: string) {
  await updateDoc(doc(historyPath(uid), id), { photoUrl });
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
  if (needsPriceImport) await updateDoc(reference, { items: data.items, total: data.total });
}
