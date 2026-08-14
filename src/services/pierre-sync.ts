import {
  createTransactionsBatch,
  listTransactions,
} from "@/services/transactions";
import type { TransactionInput } from "@/types";
import {
  fetchPierreAccounts,
  fetchPierreTransactions,
  triggerPierreUpdate,
  validatePierreKey,
} from "@/services/pierre";
import { savePierreAccounts } from "@/services/profile";
import { selectDefaultPierreAccount } from "@/utils/pierre";

export async function syncPierreData(
  uid: string,
  apiKey: string,
  preferredAccountId?: string | null,
) {
  const validation = await validatePierreKey(apiKey);
  if (!validation.ok) throw new Error(validation.message);
  await triggerPierreUpdate(apiKey);

  const accounts = await fetchPierreAccounts(apiKey);
  const selectedAccount =
    accounts.find((account) => account.id === preferredAccountId) ||
    selectDefaultPierreAccount(accounts);
  if (!selectedAccount) {
    throw new Error("Nenhuma carteira encontrada no Pierre.");
  }
  await savePierreAccounts(uid, accounts, selectedAccount);

  const today = new Date();
  const ago = new Date();
  ago.setFullYear(today.getFullYear() - 1);
  const [existingTransactions, items] = await Promise.all([
    listTransactions(uid),
    fetchPierreTransactions(
      apiKey,
      ago.toISOString().slice(0, 10),
      today.toISOString().slice(0, 10),
    ),
  ]);
  const existingIds = new Set(
    existingTransactions
      .map((transaction) => transaction.pierreId)
      .filter((id): id is string => Boolean(id)),
  );

  const newTransactions: TransactionInput[] = items
    .filter((item) => {
      const [year, month, day] = item.date.split("-").map(Number);
      return (
        Boolean(item.id) &&
        !existingIds.has(item.id) &&
        Number.isInteger(year) &&
        Number.isInteger(month) &&
        Number.isInteger(day) &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31
      );
    })
    .map((item) => {
      const [referenceYear, referenceMonth] = item.date.split("-").map(Number);
      return {
        type: item.type === "receita" ? "income" : "expense",
        description: item.description,
        amount: item.amount,
        date: item.date,
        referenceMonth,
        referenceYear,
        pierreId: item.id,
        category: item.category,
        accountId: item.accountId,
      };
    });

  if (newTransactions.length) {
    await createTransactionsBatch(
      uid,
      newTransactions.map((data) => ({ data })),
    );
  }

  return { imported: newTransactions.length };
}
