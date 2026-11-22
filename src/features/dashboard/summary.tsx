"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Transaction } from "@/types";
import { currency, dateBR, typeLabels } from "@/utils/format";
import { isImportedTransaction } from "@/utils/bank";
import { categoryIcon } from "@/utils/pierre-category";
import { cleanTransactionName } from "@/utils/transaction-name";
import { displayCategory } from "@/utils/transaction-category";
import { ExpenseHeatmap } from "@/components/expense-heatmap";
import { useBankSyncStatus } from "@/hooks/useBankAutoSync";

export function Summary({
  items,
  month,
  year,
  accountBalance,
  accountId,
  accountName,
}: {
  items: Transaction[];
  month: number;
  year: number;
  accountBalance: number | null;
  accountId: string | null;
  accountName: string | null;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [valuesHidden, setValuesHidden] = useState(true);
  const bankSynced = useBankSyncStatus();

  useEffect(() => {
    setSelectedDay(null);
  }, [month, year]);
  const visibleItems = accountId
    ? items.filter(
        (transaction) =>
          isImportedTransaction(transaction) &&
          transaction.accountId === accountId,
      )
    : items;

  const filteredItems = selectedDay
    ? visibleItems.filter(
        (transaction) =>
          isImportedTransaction(transaction) &&
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
  const accountLabel = (accountName || "Conta não importada")
    .replace(/^Carteira\s+\d+\s*-\s*/i, "")
    .toUpperCase();
  const displayedBalance = valuesHidden
    ? "••••••"
    : accountBalance === null
      ? "—"
      : currency(accountBalance);

  return (
    <>
      <div className="saldo-mes-card">
        <div className="saldo-mes-main">
          <span className="saldo-mes-title">Saldo da conta</span>
          <div className="saldo-mes-account">
            {bankSynced && (
              <span
                className="pierre-sync-dot"
                title="Dados bancários sincronizados"
                aria-label="Dados bancários sincronizados"
              />
            )}
            <span className="saldo-mes-account-name">{accountLabel}</span>
          </div>
          <span className="saldo-mes-value">{displayedBalance}</span>
        </div>
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
        <div className="widget dashboard-transactions-widget flex flex-col">
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
              {recent.map((transaction) => {
                const category = displayCategory(transaction.category);
                return (
                <div key={transaction.id} className="tx-item">
                  <div
                    className={`tx-icon ${transaction.type === "income" ? "in" : "out"}`}
                    title={category}
                    aria-label={`Categoria: ${category}`}
                  >
                    {categoryIcon(
                      category,
                      transaction.description,
                      transaction.type,
                    )}
                  </div>
                  <div className="tx-info">
                    <p className="tx-desc">
                      {cleanTransactionName(transaction.description)}
                    </p>
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
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
