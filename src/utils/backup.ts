import type {
  PlannedTransactionInput,
  RecurrenceInput,
  ShoppingHistoryInput,
  ShoppingItemInput,
  TransactionInput,
  TransactionType,
} from "../types";
import { displayCategory } from "./transaction-category";

type BackupRecord = Record<string, unknown>;

export type BackupData = {
  tx: unknown[];
  plan: unknown[];
  rec: unknown[];
  shop: unknown[];
  history: unknown[];
};

export type NormalizedTransaction = {
  id?: string;
  data: TransactionInput;
};

export type NormalizedPlan = {
  id?: string;
  data: PlannedTransactionInput;
};

export type NormalizedRecurrence = {
  oldId: string;
  id?: string;
  data: RecurrenceInput;
};

export type NormalizedShoppingItem = {
  oldId: string;
  id?: string;
  data: ShoppingItemInput;
};

export type NormalizedShoppingHistory = {
  id?: string;
  data: ShoppingHistoryInput;
};

function recordOf(value: unknown): BackupRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as BackupRecord)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function amountValue(value: unknown) {
  if (typeof value === "number") return Math.abs(value);
  const text = stringValue(value).replace(/\s/g, "").replace(/^R\$/i, "");
  if (!text) return 0;
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : "";
}

function localIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateValue(value: unknown) {
  const text = stringValue(value);
  const leading = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (leading) return validIsoDate(leading[0]);
  const brazilian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilian) {
    return validIsoDate(`${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : validIsoDate(localIsoDate(parsed));
}

function typeValue(
  value: unknown,
  fallback: TransactionType = "expense",
): TransactionType {
  const valueText = stringValue(value).toLowerCase();
  if (["receita", "receitas", "income", "entrada", "entradas"].includes(valueText)) {
    return "income";
  }
  if (["investimento", "investimentos", "investment"].includes(valueText)) {
    return "investment";
  }
  if (
    ["despesa", "despesas", "expense", "saída", "saidas"].includes(valueText)
  ) {
    return "expense";
  }
  return fallback;
}

function planTypeValue(value: unknown): "income" | "expense" {
  return typeValue(value) === "income" ? "income" : "expense";
}

function importId(kind: string, value: unknown) {
  const text = stringValue(value);
  return text
    ? `carteira-${kind}-${text.replace(/[^a-zA-Z0-9_-]/g, "-")}`
    : undefined;
}

export function normalizeBackup(value: unknown): BackupData {
  if (Array.isArray(value)) return { tx: value, plan: [], rec: [], shop: [], history: [] };
  const data = recordOf(value);
  if (
    !data ||
    (!Array.isArray(data.tx) &&
      !Array.isArray(data.plan) &&
      !Array.isArray(data.rec) &&
      !Array.isArray(data.shop) &&
      !Array.isArray(data.history))
  ) {
    throw new Error("O backup não contém dados financeiros reconhecíveis.");
  }
  return {
    tx: Array.isArray(data.tx) ? data.tx : [],
    plan: Array.isArray(data.plan) ? data.plan : [],
    rec: Array.isArray(data.rec) ? data.rec : [],
    shop: Array.isArray(data.shop) ? data.shop : [],
    history: Array.isArray(data.history) ? data.history : [],
  };
}

export function normalizeTransaction(
  value: unknown,
): NormalizedTransaction | null {
  const item = recordOf(value);
  if (!item) return null;
  const date = dateValue(item.date ?? item.data);
  const amount = amountValue(item.amount ?? item.val);
  if (!date || amount <= 0) return null;
  const parsedDate = new Date(`${date}T12:00:00`);
  const recurrenceId = item.recurrenceId ?? item.recId;
  const data: TransactionInput = {
    type: typeValue(item.type ?? item.tipo),
    description: (stringValue(item.description ?? item.desc) || "Importado da Carteira").slice(0, 120),
    amount,
    date,
    referenceMonth: parsedDate.getMonth() + 1,
    referenceYear: parsedDate.getFullYear(),
  };
  const category = stringValue(item.category ?? item.cat);
  const accountId = stringValue(item.accountId ?? item.accId);
  const pierreId = stringValue(item.pierreId);
  const externalId = stringValue(item.externalId);
  const provider = stringValue(item.provider);
  const categorySource = stringValue(item.categorySource);
  if (category) data.category = displayCategory(category);
  if (categorySource === "manual" || categorySource === "auto") {
    data.categorySource = categorySource;
  }
  if (accountId) data.accountId = accountId;
  if (pierreId) data.pierreId = pierreId;
  if (externalId) data.externalId = externalId;
  if (provider === "pluggy" || provider === "pierre") data.provider = provider;
  if (recurrenceId != null) data.recurrenceId = stringValue(recurrenceId);
  return { id: importId("tx", item.id), data };
}

export function normalizePlan(value: unknown): NormalizedPlan | null {
  const item = recordOf(value);
  if (!item) return null;
  const date = dateValue(item.date ?? item.data);
  const amount = amountValue(item.amount ?? item.val);
  if (!date || amount <= 0) return null;
  return {
    id: importId("plan", item.id),
    data: {
      type: planTypeValue(item.type ?? item.tipo),
      description: (stringValue(item.description ?? item.desc) || "Lançamento planejado").slice(0, 120),
      amount,
      date,
      category: stringValue(item.category ?? item.cat) || "Outros",
      paid: item.paid === true || item.pago === true,
    },
  };
}

export function normalizeRecurrence(
  value: unknown,
): NormalizedRecurrence | null {
  const item = recordOf(value);
  if (!item || item.id == null) return null;
  const startDate = dateValue(item.startDate);
  const amount = amountValue(item.amount ?? item.val);
  if (!startDate || amount <= 0) return null;
  const start = new Date(`${startDate}T12:00:00`);
  const periodText = stringValue(item.period).toLowerCase();
  const period =
    periodText === "trimestral" || periodText === "quarterly"
      ? "quarterly"
      : periodText === "anual" || periodText === "yearly"
        ? "yearly"
        : "monthly";
  const originalDay = Math.min(
    31,
    Math.max(1, Math.trunc(Number(item.originalDay ?? item.origDay) || start.getDate())),
  );
  const limitNumber = Math.trunc(Number(item.limit));
  const data: RecurrenceInput = {
    type: planTypeValue(item.type ?? item.tipo),
    description: (stringValue(item.description ?? item.desc) || "Recorrência").slice(0, 120),
    amount,
    startDate,
    originalDay,
    category: stringValue(item.category ?? item.cat) || "Outros",
    period,
    paid: item.paid === true,
  };
  if (limitNumber > 0) data.limit = limitNumber;
  const rawPaidMonths = recordOf(item.paidMonths);
  if (rawPaidMonths) {
    const paidMonths: Record<string, boolean> = {};
    Object.keys(rawPaidMonths).forEach((key) => {
      if (rawPaidMonths[key] === true) paidMonths[key] = true;
    });
    if (Object.keys(paidMonths).length) data.paidMonths = paidMonths;
  }
  return {
    oldId: stringValue(item.id),
    id: importId("rec", item.id),
    data,
  };
}

export function normalizeShoppingItem(
  value: unknown,
): NormalizedShoppingItem | null {
  const item = recordOf(value);
  if (!item || item.id == null) return null;
  const name = stringValue(item.name ?? item.description ?? item.desc);
  const createdDate = dateValue(item.createdDate ?? item.data ?? item.date);
  if (!name || !createdDate) return null;
  const quantity = Math.max(
    1,
    Math.trunc(Number(item.qty ?? item.quantity ?? item.qtd) || 1),
  );
  const price = amountValue(item.price ?? item.preco ?? item.amount);
  const completedDate = dateValue(item.completedDate ?? item.dataConclusao);
  const barcode = stringValue(item.barcode ?? item.code);
  const data: ShoppingItemInput = {
    name: name.slice(0, 120),
    qty: quantity,
    price,
    done: item.done === true || item.completed === true,
    createdDate,
    completedDate: completedDate || null,
    order: Math.max(0, Math.trunc(Number(item.order) || 0)),
    ...(barcode ? { barcode } : {}),
  };
  return {
    oldId: stringValue(item.id),
    id: importId("shop", item.id),
    data,
  };
}

export function normalizeShoppingHistory(
  value: unknown,
): NormalizedShoppingHistory | null {
  const item = recordOf(value);
  if (!item || item.id == null) return null;
  const date = dateValue(item.date);
  const rawItems = Array.isArray(item.items) ? item.items : [];
  if (!date || !rawItems.length) return null;
  const items = rawItems
    .map((rawItem) => {
      const historyItem = recordOf(rawItem);
      const name = stringValue(historyItem?.name);
      const qty = Math.max(1, Math.trunc(Number(historyItem?.qty) || 1));
      if (!name) return null;
      const price = amountValue(historyItem?.price);
      const barcode = stringValue(historyItem?.barcode ?? historyItem?.code);
      return {
        name: name.slice(0, 120),
        qty,
        price,
        ...(barcode ? { barcode } : {}),
      };
    })
    .filter(
      (historyItem): historyItem is { name: string; qty: number; price: number; barcode?: string } =>
        historyItem !== null,
    );
  if (!items.length) return null;
  const title = stringValue(item.title).slice(0, 120);
  const photoUrl = stringValue(item.photoUrl).slice(0, 500);
  return {
    id: importId("history", item.id),
    data: {
      date,
      total: amountValue(item.total),
      items,
      ...(title ? { title } : {}),
      ...(photoUrl ? { photoUrl } : {}),
    },
  };
}
