import type {
  PlannedTransactionInput,
  RecurrenceInput,
  TransactionInput,
  TransactionType,
} from "../types";

type BackupRecord = Record<string, unknown>;

export type BackupData = {
  tx: unknown[];
  plan: unknown[];
  rec: unknown[];
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

function dateValue(value: unknown) {
  const text = stringValue(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const brazilian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function typeValue(
  value: unknown,
  fallback: TransactionType = "expense",
): TransactionType {
  const valueText = stringValue(value).toLowerCase();
  if (["receita", "income", "entrada"].includes(valueText)) return "income";
  if (["investimento", "investment"].includes(valueText)) return "investment";
  if (["despesa", "expense", "saída", "saida"].includes(valueText)) {
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
  if (Array.isArray(value)) return { tx: value, plan: [], rec: [] };
  const data = recordOf(value);
  if (!data || !Array.isArray(data.tx)) {
    throw new Error("O backup precisa conter uma lista de transações em tx.");
  }
  return {
    tx: data.tx,
    plan: Array.isArray(data.plan) ? data.plan : [],
    rec: Array.isArray(data.rec) ? data.rec : [],
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
  if (category) data.category = category;
  if (accountId) data.accountId = accountId;
  if (pierreId) data.pierreId = pierreId;
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
  return {
    oldId: stringValue(item.id),
    id: importId("rec", item.id),
    data,
  };
}
