import type { Transaction } from "../types";

export interface PierreAccountSummary {
  id: string;
  name: string;
  balance: number;
}

/** Selects the account with the highest balance as the default account. */
export function selectDefaultPierreAccount<T extends PierreAccountSummary>(
  accounts: T[],
) {
  return accounts.reduce<T | undefined>(
    (highest, account) =>
      !highest || account.balance > highest.balance ? account : highest,
    undefined,
  );
}

/**
 * Returns only movements imported from Pierre for the selected account.
 * Planning entries and investment records are intentionally excluded.
 */
export function filterPierreMovements(
  items: Transaction[],
  accountId?: string | null,
) {
  return items.filter(
    (transaction) =>
      Boolean(transaction.pierreId) &&
      (!accountId || transaction.accountId === accountId) &&
      (transaction.type === "income" || transaction.type === "expense"),
  );
}
