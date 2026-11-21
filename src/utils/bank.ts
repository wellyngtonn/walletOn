import type { Transaction } from "../types";

export type BankProvider = "pluggy" | "pierre";

export interface BankAccountSummary {
  id: string;
  name: string;
  balance: number;
  type?: string;
  subtype?: string;
}

/**
 * Selects the default account, preferring bank accounts over credit accounts
 * and then the highest balance. The type check keeps legacy providers (which
 * do not send `type`) behaving exactly as before.
 */
export function selectDefaultAccount<T extends BankAccountSummary>(
  accounts: T[],
) {
  if (!accounts.length) return undefined;
  const bankAccounts = accounts.filter(
    (account) => !account.type || account.type.toUpperCase() === "BANK",
  );
  const candidates = bankAccounts.length ? bankAccounts : accounts;
  return candidates.reduce<T | undefined>(
    (highest, account) =>
      !highest || account.balance > highest.balance ? account : highest,
    undefined,
  );
}

export function isImportedTransaction(transaction: Transaction) {
  return Boolean(transaction.pierreId || transaction.externalId);
}

/**
 * Returns only movements imported from a bank provider for the selected
 * account. Planning entries and investment records are intentionally excluded.
 */
export function filterImportedMovements(
  items: Transaction[],
  accountId?: string | null,
) {
  return items.filter(
    (transaction) =>
      isImportedTransaction(transaction) &&
      (!accountId || transaction.accountId === accountId) &&
      (transaction.type === "income" || transaction.type === "expense"),
  );
}
