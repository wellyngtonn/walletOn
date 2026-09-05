"use client";
import type { TransactionType } from "@/types";
import { useDashboard } from "./app-shell";
import { TransactionList } from "./transaction-list";
import { MonthPicker } from "./month-picker";

const meta = {
  income: ["Receitas", "Nenhuma receita neste mês."],
  expense: ["Despesas", "Nenhuma despesa neste mês."],
  investment: ["Investimentos", "Nenhum investimento neste mês."],
} as const;

export function TypePage({ type }: { type: TransactionType }) {
  const {
    month,
    year,
    setPeriod,
    transactions,
    loading,
    error,
    openEdit,
    openCreate,
  } = useDashboard();
  const [title, empty] = meta[type];
  const items = transactions.filter((x) => x.type === type);

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="sec-title">{title}</h2>
          <div className="mt-2 md:hidden">
            <MonthPicker month={month} year={year} onChange={setPeriod} />
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary mt-2 rounded-full px-5 py-3 text-lg font-bold md:mt-0 md:rounded-[10px] md:px-4 md:py-[9px] md:text-sm"
        >
          <span className="md:hidden">+</span>
          <span className="hidden md:inline">+ Lançamento</span>
        </button>
      </div>
      {error && <div className="msg-error mb-4">{error}</div>}
      {loading ? (
        <p className="text-[var(--text3)]">Carregando...</p>
      ) : (
        <TransactionList items={items} onEdit={openEdit} />
      )}
      {items.length === 0 && !loading && !error && (
        <p className="mt-4 text-center text-[var(--text3)]">{empty}</p>
      )}
    </>
  );
}
