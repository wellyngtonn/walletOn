import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { validBarcode } from "@/utils/shopping-product";

type Entry = { name: string; savedAt: number };
const MAX_PRODUCTS = 300;

function entries(value: unknown): Record<string, Entry> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([code, entry]) =>
    validBarcode(code) && entry && typeof entry.name === "string" && entry.name.trim() && typeof entry.savedAt === "number",
  ));
}

export async function catalogProduct(uid: string, code: string) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return entries(snapshot.data()?.barcodeCatalog)[code]?.name || "";
}

export async function saveCatalogProduct(uid: string, code: string, name: string) {
  if (!validBarcode(code) || !name.trim()) return;
  const reference = doc(db, "users", uid);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const catalog = entries(snapshot.data()?.barcodeCatalog);
    catalog[code] = { name: name.trim().slice(0, 300), savedAt: Date.now() };
    const limited = Object.fromEntries(Object.entries(catalog)
      .sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, MAX_PRODUCTS));
    transaction.set(reference, { barcodeCatalog: limited }, { mergeFields: ["barcodeCatalog"] });
  });
}
