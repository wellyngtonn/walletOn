"use client";
import type { Transaction } from "@/types";
import { currency, dateBR } from "@/utils/format";
import { useState } from "react";
import { ExpenseHeatmap } from "@/components/expense-heatmap";

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
}: {
  items: Transaction[];
  month: number;
  year: number;
  pierreBalance: number | null;
  pierreAccountId: string | null;
  pierreAccountName: string | null;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const visibleItems = pierreAccountId
    ? items.filter(
        (transaction) =>
          transaction.pierreId && transaction.accountId === pierreAccountId,
      )
    : items;
  const totals = { income: 0, expense: 0, investment: 0 };
  visibleItems.forEach((t) => (totals[t.type] += t.amount));

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

  return (
    <>
      {/* Hero Card */}
      <div className="saldo-mes-card">
        <div className="saldo-mes-main">
          <span className="saldo-mes-label">Saldo do mês</span>
          <span className="saldo-mes-value">
            {pierreBalance === null ? "—" : currency(pierreBalance)}
          </span>
          <p className="saldo-mes-meta">
            {pierreBalance === null
              ? "Sincronize sua conta no Pierre Finance"
              : `Saldo de ${pierreAccountName || "carteira selecionada"}`}
          </p>
        </div>

        <div className="saldo-mes-subgrid">
          <div className="saldo-mes-sub in">
            <div className="saldo-mes-sub-head">
              <span className="saldo-mes-sub-icon" aria-hidden="true">↗</span>
              <span className="saldo-mes-sub-label">Entradas</span>
            </div>
            <span className="saldo-mes-sub-value">
              + {currency(totals.income)}
            </span>
            <span className="saldo-mes-sub-meta">Total recebido no período</span>
          </div>
          <div className="saldo-mes-sub out">
            <div className="saldo-mes-sub-head">
              <span className="saldo-mes-sub-icon" aria-hidden="true">↘</span>
              <span className="saldo-mes-sub-label">Saídas</span>
            </div>
            <span className="saldo-mes-sub-value">
              − {currency(totals.expense + totals.investment)}
            </span>
            <span className="saldo-mes-sub-meta">Despesas e investimentos</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <ExpenseHeatmap
          items={visibleItems}
          month={month}
          year={year}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      </div>

      {/* Recent Transactions */}
      <div className="mb-4">
        <div className="widget flex max-h-[558px] flex-col overflow-hidden">
          <div className="mb-3 flex items-center justify-between">
            {selectedDay && (
              <button
                className="btn-link order-2"
                onClick={() => setSelectedDay(null)}
                title={selectedDate ? `Voltar ao mês (${selectedDate})` : "Voltar ao mês"}
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
              {recent.map((t) => (
                <div key={t.id} className="tx-item">
                  <div
                    className={`tx-icon ${t.type === "income" ? "in" : "out"}`}
                  >
                    {t.type === "income" ? "+" : "−"}
                  </div>
                  <div className="tx-info">
                    <p className="tx-desc">{t.description}</p>
                    <p className="tx-meta">
                      {typeLabels[t.type]} · {dateBR(t.date)}
                    </p>
                  </div>
                  <p
                    className={`tx-val ${t.type === "income" ? "in" : "out"}`}
                  >
                    {t.type === "income" ? "+" : "−"} {currency(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
