export interface OcrItem {
  name: string;
  qty: number;
  price: number;
}

const IGNORED_LINE =
  /(total|subtotal|troco|desconto|aplicado no|dinheiro|cart[aã]o|carta[õo]|pix|d[ée]bito|cr[ée]dito|cpf|cnpj|nfe|fiscal|cupom|obrigad|volte|sempre|documento|operador|caixa|\bqtd\b|chave de acesso|consulte|forma de pagamento|valor pago|valor a pagar|\bvalor\b|autentic|termica)/i;

const PRICE_RE = /\d+[.,]\d{1,2}(?![.,\d])/g;

function parsePrice(text: string): number {
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 && value < 100000
    ? Math.round(value * 100) / 100
    : 0;
}

function parseQty(text: string): number {
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
}

function cleanName(text: string): string {
  let name = text
    .replace(/[|;:\[\]{}()!"“”‘’«»'’.,/—–_+\-=*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  name = name.replace(/^\d+(?:\s+\d+)*\s*/, " ");
  name = name.replace(/^\d{4,16}\s*/, " ");
  name = name.replace(/\b(?=[A-Za-z]*\d)[A-Za-z\d]+\b/g, " ");
  name = name.replace(/\b\d{2,}\b/g, " ");
  name = name.replace(/\b(un|und|unid|uh|dn|kg|ka|dz|pc|pct|cx|ml|gr|g|lt|l)\b/gi, " ");
  name = name.replace(/\b\p{L}\b/gu, " ");
  name = name.replace(/\s+\d+(?:[.,]\d+)?\s*$/g, " ");
  name = name.replace(/\s+\d+(?:[.,]\d+)?\s*$/g, " ");
  return name.replace(/\s+/g, " ").trim();
}

function isValidName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  return /[a-zA-ZÀ-ú]/.test(trimmed);
}

function pickPrice(prices: string[]): number {
  if (!prices.length) return 0;
  const last = prices[prices.length - 1];
  const prev = prices[prices.length - 2];
  const lastValue = parsePrice(last);
  if (!lastValue) return parsePrice(prev || "") || 0;
  if (!prev) return lastValue;
  const prevValue = parsePrice(prev);
  if (!prevValue) return lastValue;
  const lastHasTwo = /\d[.,]\d{2}$/.test(last);
  const prevHasTwo = /\d[.,]\d{2}$/.test(prev);
  if (lastHasTwo || !prevHasTwo) return lastValue;
  return prevValue / lastValue <= 2 ? prevValue : lastValue;
}

export function parseReceiptText(text: string): OcrItem[] {
  const items: OcrItem[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line || line.length < 4) continue;
    if (IGNORED_LINE.test(line)) continue;

    const normalized = line.replace(/:/g, ",").replace(/[%»«]/g, " ");

    const priceMatches = [...normalized.matchAll(PRICE_RE)].map((match) => match[0]);
    if (!priceMatches.length) continue;

    const price = pickPrice(priceMatches);
    if (!price) continue;

    let rest = normalized.replace(PRICE_RE, " ");
    rest = rest.replace(/^\d{1,4}\s+/, " ");
    rest = rest.replace(/^\d{4,16}\s*/, " ");

    const qtyMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*(un|uh|um|dn|kg|ka|dz|unid|cx|pc|pct)\b/i);
    let qty = 1;
    if (qtyMatch) {
      qty = parseQty(qtyMatch[1]);
      rest = rest.replace(qtyMatch[0], " ");
    }

    const name = cleanName(rest);
    if (!isValidName(name)) continue;

    items.push({ name, qty, price });
  }

  return items;
}
