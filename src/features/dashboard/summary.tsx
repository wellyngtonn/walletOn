"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import type { Transaction } from "@/types";
import { currency, dateBR } from "@/utils/format";
import { pierreCategoryIcon } from "@/utils/pierre-category";
import { ExpenseHeatmap } from "@/components/expense-heatmap";
import { usePierreSyncStatus } from "@/hooks/usePierreAutoSync";

const typeLabels: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
  investment: "Investimento",
};

export function Summary({
  items,
  month,
  year,
  pierreBalance,
  pierreAccountId,
  pierreAccountName,
  onEdit,
}: {
  items: Transaction[];
  month: number;
  year: number;
  pierreBalance: number | null;
  pierreAccountId: string | null;
  pierreAccountName: string | null;
  onEdit: (transaction: Transaction) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [valuesHidden, setValuesHidden] = useState(true);
  const pierreSynced = usePierreSyncStatus();
  const visibleItems = pierreAccountId
    ? items.filter(
        (transaction) =>
          transaction.pierreId && transaction.accountId === pierreAccountId,
      )
    : items;

  const filteredItems = selectedDay
    ? visibleItems.filter(
        (transaction) =>
          transaction.pierreId &&
          transaction.date ===
            `${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`,
      )
    : visibleItems;
  const recent = [...filteredItems]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const selectedDate = selectedDay
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        timeZone: "UTC",
      }).format(
        new Date(
          `${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}T12:00:00Z`,
        ),
      )
    : null;
  const accountLabel = (pierreAccountName || "Conta não importada")
    .replace(/^Carteira\s+\d+\s*-\s*/i, "")
    .toUpperCase();
  const displayedBalance = valuesHidden
    ? "••••••"
    : pierreBalance === null
      ? "—"
      : currency(pierreBalance);

  return (
    <>
      <div className="saldo-mes-card">
        <div className="saldo-mes-account">
          {pierreSynced && (
            <span
              className="pierre-sync-dot"
              title="Pierre Finance sincronizado"
              aria-label="Pierre Finance sincronizado"
            />
          )}
          <span className="saldo-mes-account-name">{accountLabel}</span>
          <span className="saldo-mes-account-label">SALDO</span>
        </div>
        <div className="saldo-mes-balance">
          <div className="saldo-mes-actions" aria-label="Controles do saldo">
            <button
              type="button"
              className="saldo-mes-action"
              title={valuesHidden ? "Mostrar valores" : "Ocultar valores"}
              aria-label={valuesHidden ? "Mostrar valores" : "Ocultar valores"}
              onClick={() => setValuesHidden((hidden) => !hidden)}
            >
              {valuesHidden ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          </div>
          <span className="saldo-mes-value">{displayedBalance}</span>
        </div>
      </div>

      <div className="dashboard-panel-grid">
        <ExpenseHeatmap
          items={visibleItems}
          month={month}
          year={year}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          valuesHidden={valuesHidden}
        />
        <div className="widget dashboard-transactions-widget flex max-h-[558px] flex-col overflow-hidden">
          <div className="mb-3 flex items-center justify-between">
            {selectedDay && (
              <button
                className="btn-link order-2"
                onClick={() => setSelectedDay(null)}
                title={
                  selectedDate
                    ? `Voltar ao mês (${selectedDate})`
                    : "Voltar ao mês"
                }
              >
                ×
              </button>
            )}
            <h2 className="order-1 text-[0.7rem] font-semibold uppercase tracking-[0.5px] text-[var(--text3)]">
              Últimos lançamentos
            </h2>
          </div>
          {recent.length === 0 ? (
            <p className="flex-1 py-8 text-center text-sm text-[var(--text3)]">
              Nenhum lançamento neste período.
            </p>
          ) : (
            <div className="tx-list flex-1">
              {recent.map((transaction) => (
                <div key={transaction.id} className="tx-item">
                  <div
                    className={`tx-icon ${transaction.type === "income" ? "in" : "out"}`}
                    title={transaction.category || "Outros"}
                    aria-label={`Categoria: ${transaction.category || "Outros"}`}
                  >
                    {pierreCategoryIcon(
                      transaction.category,
                      transaction.description,
                      transaction.type,
                    )}
                  </div>
                  <div className="tx-info">
                    <p className="tx-desc">{transaction.description}</p>
                    <p className="tx-meta">
                      {typeLabels[transaction.type]} · {dateBR(transaction.date)}
                    </p>
                  </div>
                  <p
                    className={`tx-val ${transaction.type === "income" ? "in" : "out"}`}
                  >
                    {valuesHidden
                      ? "••••••"
                      : `${transaction.type === "income" ? "+" : "−"} ${currency(transaction.amount)}`}
                  </p>
                  <button
                    type="button"
                    className="tx-action-btn"
                    onClick={() => onEdit(transaction)}
                    title={`Editar ${transaction.description}`}
                    aria-label={`Editar lançamento ${transaction.description}`}
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
