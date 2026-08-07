import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  type DocumentReference,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type {
  PlannedTransaction,
  PlannedTransactionInput,
  Recurrence,
  RecurrenceInput,
  Transaction,
  TransactionInput,
} from "@/types";
const path = (uid: string) => collection(db, "users", uid, "transactions");
const plansPath = (uid: string) => collection(db, "users", uid, "plans");
const recurrencesPath = (uid: string) =>
  collection(db, "users", uid, "recurrences");
export function subscribeTransactions(
  uid: string,
  month: number,
  year: number,
  onData: (items: Transaction[]) => void,
  onError: (error: Error) => void,
) {
  const q = query(
    path(uid),
    where("referenceYear", "==", year),
    where("referenceMonth", "==", month),
    orderBy("date", "desc"),
  );
  return onSnapshot(
    q,
    (s) =>
      onData(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction)),
    onError,
  );
}

export function subscribeAllTransactions(
  uid: string,
  onData: (items: Transaction[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    path(uid),
    (snapshot) =>
      onData(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction),
      ),
    onError,
  );
}
export const createTransaction = (uid: string, data: TransactionInput) =>
  addDoc(path(uid), {
    ...data,
    userId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

export async function listTransactions(uid: string): Promise<Transaction[]> {
  const snapshot = await getDocs(path(uid));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
}

export async function listPlans(uid: string): Promise<PlannedTransaction[]> {
  const snapshot = await getDocs(plansPath(uid));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PlannedTransaction);
}

export async function listRecurrences(uid: string): Promise<Recurrence[]> {
  const snapshot = await getDocs(recurrencesPath(uid));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Recurrence);
}

type BatchItem<T> = { id?: string; data: T };

async function deleteDocumentsInBatches(references: DocumentReference[]) {
  for (let start = 0; start < references.length; start += 450) {
    const batch = writeBatch(db);
    references.slice(start, start + 450).forEach((reference) => {
      batch.delete(reference);
    });
    await batch.commit();
  }
}

export async function createTransactionsBatch(
  uid: string,
  items: BatchItem<TransactionInput>[],
) {
  for (let start = 0; start < items.length; start += 450) {
    const batch = writeBatch(db);
    items.slice(start, start + 450).forEach((item) => {
      batch.set(item.id ? doc(path(uid), item.id) : doc(path(uid)), {
        ...item.data,
        userId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

export const updateTransaction = (
  uid: string,
  id: string,
  data: TransactionInput,
) =>
  updateDoc(doc(db, "users", uid, "transactions", id), {
    ...data,
    userId: uid,
    updatedAt: serverTimestamp(),
  });
export const deleteTransaction = (uid: string, id: string) =>
  deleteDoc(doc(db, "users", uid, "transactions", id));

export const deleteTransactionsBatch = (uid: string, ids: string[]) =>
  deleteDocumentsInBatches(ids.map((id) => doc(path(uid), id)));

function subscribeCollection<T>(
  source: ReturnType<typeof collection>,
  onData: (items: T[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    source,
    (snapshot) =>
      onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T)),
    onError,
  );
}

export const subscribePlans = (
  uid: string,
  onData: (items: PlannedTransaction[]) => void,
  onError: (error: Error) => void,
) => subscribeCollection(plansPath(uid), onData, onError);

export const subscribeRecurrences = (
  uid: string,
  onData: (items: Recurrence[]) => void,
  onError: (error: Error) => void,
) => subscribeCollection(recurrencesPath(uid), onData, onError);

export const createPlan = (uid: string, data: PlannedTransactionInput) =>
  addDoc(plansPath(uid), {
    ...data,
    userId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

export async function createPlansBatch(
  uid: string,
  items: BatchItem<PlannedTransactionInput>[],
) {
  const ids: string[] = [];
  for (let start = 0; start < items.length; start += 450) {
    const batch = writeBatch(db);
    items.slice(start, start + 450).forEach((item) => {
      const reference = item.id ? doc(plansPath(uid), item.id) : doc(plansPath(uid));
      ids.push(reference.id);
      batch.set(reference, {
        ...item.data,
        userId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
  return ids;
}

export const updatePlan = (
  uid: string,
  id: string,
  data: PlannedTransactionInput,
) =>
  updateDoc(doc(db, "users", uid, "plans", id), {
    ...data,
    userId: uid,
    updatedAt: serverTimestamp(),
  });

export const deletePlan = (uid: string, id: string) =>
  deleteDoc(doc(db, "users", uid, "plans", id));

export const deletePlansBatch = (uid: string, ids: string[]) =>
  deleteDocumentsInBatches(ids.map((id) => doc(plansPath(uid), id)));

export const createRecurrence = (uid: string, data: RecurrenceInput) =>
  addDoc(recurrencesPath(uid), {
    ...data,
    userId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

export async function createRecurrencesBatch(
  uid: string,
  items: BatchItem<RecurrenceInput>[],
) {
  const ids: string[] = [];
  for (let start = 0; start < items.length; start += 450) {
    const batch = writeBatch(db);
    items.slice(start, start + 450).forEach((item) => {
      const reference = item.id ? doc(recurrencesPath(uid), item.id) : doc(recurrencesPath(uid));
      ids.push(reference.id);
      batch.set(reference, {
        ...item.data,
        userId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
  return ids;
}

export const updateRecurrence = (
  uid: string,
  id: string,
  data: RecurrenceInput,
) =>
  updateDoc(doc(db, "users", uid, "recurrences", id), {
    ...data,
    userId: uid,
    updatedAt: serverTimestamp(),
  });

export const deleteRecurrence = (uid: string, id: string) =>
  deleteDoc(doc(db, "users", uid, "recurrences", id));

export const deleteRecurrencesBatch = (uid: string, ids: string[]) =>
  deleteDocumentsInBatches(ids.map((id) => doc(recurrencesPath(uid), id)));
