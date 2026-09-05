import { auth } from "@/lib/firebase/config";
import { shoppingProductName } from "@/utils/shopping-product";
import { catalogProduct, saveCatalogProduct } from "@/services/product-catalog";

export async function lookupBarcode(code: string, signal: AbortSignal) {
  const user = auth.currentUser;
  if (!user) throw new Error("Faça login para consultar produtos.");
  const saved = await catalogProduct(user.uid, code).catch(() => "");
  signal.throwIfAborted();
  if (saved) return { name: saved, notice: "" };
  async function remember(name: string, notice: string) {
    signal.throwIfAborted();
    if (name) {
      try { await saveCatalogProduct(user!.uid, code, name); }
      catch { notice = `${notice} Não foi possível guardar o produto para próximas consultas.`.trim(); }
    }
    return { name, notice };
  }
  let notice = "";
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Faça login para consultar produtos.");
    const response = await fetch(process.env.NEXT_PUBLIC_BARCODE_API_URL || "/api/barcode", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: code }), signal,
    });
    const data = await response.json().catch(() => null);
    if (response.ok && typeof data?.name === "string" && data.name.trim()) return remember(data.name, "");
    if (response.status === 404) return remember("", "");
    notice = data?.error || "Consulta de produtos indisponível.";
  } catch (error) {
    if (signal.aborted) throw error;
    notice = "Consulta de produtos indisponível.";
  }
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_pt,abbreviated_product_name,brands,quantity,product_quantity,product_quantity_unit`, { signal });
  if (!response.ok) throw new Error("Não foi possível consultar o produto. Tente novamente ou digite o nome.");
  const data = await response.json();
  return remember(shoppingProductName(data.product, code), notice ? `${notice} Usando a base alternativa.` : "");
}
