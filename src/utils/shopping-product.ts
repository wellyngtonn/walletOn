type BarcodeProduct = {
  product_name?: string;
  product_name_pt?: string;
  abbreviated_product_name?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
};

// Complemento informado pelo usuário para o cadastro sem peso na base.
const quantityByBarcode: Record<string, string> = { "7896559100215": "5 kg" };

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/(\d)\s+(?=\d)/g, "$1").replace(/[^a-z0-9]/g, "");
}

export function shoppingProductName(product: BarcodeProduct | undefined, barcode: string) {
  if (!product) return "";
  let name = (product.product_name_pt || product.product_name || product.abbreviated_product_name || "").trim();
  if (!name) return "";

  const brand = (product.brands || "").split(",")[0].trim();
  const quantity = (product.quantity || "").trim() ||
    (product.product_quantity && product.product_quantity_unit
      ? `${product.product_quantity} ${product.product_quantity_unit}`
      : quantityByBarcode[barcode] || "");

  // Coloca a marca antes do peso quando o nome já termina com a quantidade.
  if (brand && !normalized(name).includes(normalized(brand))) {
    const weightSuffix = name.match(/\s+\d+(?:[.,]\d+)?\s*(?:kg|g|mg|ml|cl|l)\s*$/i);
    name = weightSuffix
      ? `${name.slice(0, weightSuffix.index).trim()} ${brand}${weightSuffix[0]}`
      : `${name} ${brand}`;
  }
  if (quantity && !normalized(name).includes(normalized(quantity))) name += ` ${quantity}`;
  return name;
}

export function cosmosProductName(product: { description?: string; brand?: { name?: string }; net_weight?: number }, barcode: string) {
  const description = product.description || "";
  // Cosmos informa peso líquido em gramas. Preserve a medida da descrição,
  // especialmente em líquidos, para não acrescentar peso a um volume em litros.
  const hasMeasure = /\d\s*(?:kg|g|mg|ml|cl|l)\b/i.test(description);
  const grams = Number(product.net_weight);
  const quantity = !hasMeasure && Number.isFinite(grams) && grams > 0
    ? (grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`) : "";
  return shoppingProductName({ product_name: description, brands: product.brand?.name, quantity }, hasMeasure ? "" : barcode);
}

export function validBarcode(code: string) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}

export function upcProductName(data: { items?: Array<{ ean?: string; upc?: string; gtin?: string; title?: string; brand?: string; size?: string }> }, code: string) {
  const item = data.items?.find((entry) => [entry.ean, entry.upc, entry.gtin]
    .some((id) => typeof id === "string" && /^\d+$/.test(id) && id.padStart(14, "0") === code.padStart(14, "0")));
  if (!item || typeof item.title !== "string") return "";
  // O campo weight pode ser peso de transporte. Use apenas a medida do produto.
  const size = typeof item.size === "string" && /^\d+(?:[.,]\d+)?\s*(?:kg|g|mg|ml|cl|l|oz|fl oz|lb)$/i.test(item.size.trim()) ? item.size.trim() : "";
  const hasMeasure = /\d\s*(?:kg|g|mg|ml|cl|l|oz|lb)\b/i.test(item.title);
  return shoppingProductName({ product_name: item.title, brands: item.brand, quantity: hasMeasure ? "" : size }, hasMeasure ? "" : code);
}
