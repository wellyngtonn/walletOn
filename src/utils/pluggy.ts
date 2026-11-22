import type { TransactionType } from "../types";
import { categorizeTransaction } from "./transaction-category.js";
import { cleanTransactionName } from "./transaction-name.js";

export interface PluggyAccountShape {
  id: string;
  name?: string | null;
  marketingName?: string | null;
  balance?: number | null;
  type?: string | null;
  subtype?: string | null;
  currencyCode?: string | null;
}

export interface PluggyTransactionShape {
  id: string;
  description?: string | null;
  descriptionRaw?: string | null;
  amount?: number | null;
  date?: string | null;
  type?: string | null;
  status?: string | null;
  category?: string | null;
  categoryId?: string | null;
  operationType?: string | null;
  accountId?: string | null;
  merchant?: { name?: string | null; category?: string | null } | null;
}

export interface MappedBankAccount {
  id: string;
  name: string;
  balance: number;
  type?: string;
  subtype?: string;
  currency?: string;
}

export interface MappedBankTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: Exclude<TransactionType, "investment">;
  category: string;
  accountId: string;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function accountLabel(account: PluggyAccountShape, index: number) {
  const label =
    textValue(account.name) ||
    textValue(account.marketingName) ||
    textValue(account.subtype) ||
    "Conta";
  return `Carteira ${index + 1} - ${label}`;
}

function directionValue(
  type: string,
  amount: number,
): Exclude<TransactionType, "investment"> {
  const normalized = type.toUpperCase();
  if (["DEBIT", "EXPENSE", "OUT", "SAIDA", "SAÍDA"].includes(normalized)) {
    return "expense";
  }
  if (["CREDIT", "INCOME", "IN", "ENTRADA"].includes(normalized)) {
    return "income";
  }
  return amount < 0 ? "expense" : "income";
}

export function mapPluggyAccounts(records: unknown[]): MappedBankAccount[] {
  return records
    .map((value) => recordOf(value))
    .filter((value): value is Record<string, unknown> => value !== null)
    .filter((account) => textValue(account.id).length > 0)
    .map((account, index) => {
      const shape: PluggyAccountShape = {
        id: textValue(account.id),
        name: textValue(account.name),
        marketingName: textValue(account.marketingName),
        balance: numberValue(account.balance),
        type: textValue(account.type).toUpperCase() || undefined,
        subtype: textValue(account.subtype).toUpperCase() || undefined,
        currencyCode: textValue(account.currencyCode) || undefined,
      };
      return {
        id: shape.id,
        name: accountLabel(shape, index),
        balance: shape.balance ?? 0,
        ...(shape.type ? { type: shape.type } : {}),
        ...(shape.subtype ? { subtype: shape.subtype } : {}),
        ...(shape.currencyCode ? { currency: shape.currencyCode } : {}),
      };
    });
}

export function mapPluggyTransactions(
  records: unknown[],
  fallbackAccountId?: string,
): MappedBankTransaction[] {
  return records
    .map((value) => recordOf(value))
    .filter((value): value is Record<string, unknown> => value !== null)
    .map((transaction) => {
      const merchant = recordOf(transaction.merchant);
      const shape: PluggyTransactionShape = {
        id: textValue(transaction.id),
        description: textValue(transaction.description),
        descriptionRaw: textValue(transaction.descriptionRaw),
        amount: numberValue(transaction.amount),
        date: textValue(transaction.date).slice(0, 10),
        type: textValue(transaction.type),
        status: textValue(transaction.status),
        category: textValue(transaction.category),
        categoryId: textValue(transaction.categoryId),
        operationType: textValue(transaction.operationType),
        accountId: textValue(transaction.accountId),
        merchant: merchant
          ? {
              name: textValue(merchant.name),
              category: textValue(merchant.category),
            }
          : null,
      };
      const amount = shape.amount ?? 0;
      const description =
        cleanTransactionName(
          shape.description ||
            shape.descriptionRaw ||
            textValue(shape.merchant?.name) ||
            "Pluggy",
        ).slice(0, 120) || "Pluggy";
      const mappedType = directionValue(shape.type ?? "", amount);

      return {
        id: shape.id,
        description,
        amount: Math.abs(amount),
        date: shape.date ?? "",
        type: mappedType,
        category: categorizeTransaction({
          description,
          category: shape.category,
          categoryId: shape.categoryId,
          merchantName: shape.merchant?.name,
          merchantCategory: shape.merchant?.category,
          operationType: shape.operationType,
          type: mappedType,
        }),
        accountId: shape.accountId || fallbackAccountId || "",
      };
    })
    .filter(
      (transaction) =>
        Boolean(transaction.id) &&
        transaction.amount > 0 &&
        Boolean(transaction.accountId) &&
        isIsoDate(transaction.date),
    );
}

/** Prefixes the document id so Pluggy and Pierre ids never collide. */
export function pluggyTransactionDocId(externalId: string) {
  return `pluggy-${externalId}`;
}
