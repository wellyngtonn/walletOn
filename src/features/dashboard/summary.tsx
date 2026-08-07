"use client";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
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
}: {
  items: Transaction[];
  month: number;
  year: number;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const totals = { income: 0, expense: 0, investment: 0 };
  items.forEach((t) => (totals[t.type] += t.amount));
  const balance = totals.income - totals.expense - totals.investment;
  const hasData = totals.income + totals.expense + totals.investment > 0;

  const chart = [
    { name: "Receitas", value: totals.income, color: "#34c759" },
    { name: "Despesas", value: totals.expense, color: "#ff3b30" },
    { name: "Investimentos", value: totals.investment, color: "#a64ce6" },
  ];

  const filteredItems = selectedDay
    ? items.filter(
        (transaction) =>
          transaction.pierreId &&
          transaction.date ===
            `${year}-${String(month).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`,
      )
    : items;
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
          <span className="saldo-mes-value">{currency(balance)}</span>
          <p className="saldo-mes-meta">
            {hasData ? "Carteira consolidada" : "Nenhum movimento no período"}
          </p>
        </div>

        <div className="saldo-mes-subgrid">
          <div className="saldo-mes-sub in">
            <span className="saldo-mes-sub-label">Entradas</span>
            <span className="saldo-mes-sub-value">
              {currency(totals.income)}
            </span>
          </div>
          <div className="saldo-mes-sub out">
            <span className="saldo-mes-sub-label">Saídas</span>
            <span className="saldo-mes-sub-value">
              {currency(totals.expense + totals.investment)}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <ExpenseHeatmap
          items={items}
          month={month}
          year={year}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      </div>

      {/* Grid */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {/* Graficos */}
        <div className="flex flex-col gap-4">
          <div className="widget">
            <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.5px] text-[var(--text3)]">
              Distribuição
            </h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {chart.map((x) => (
                      <Cell key={x.name} fill={x.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => currency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="widget">
            <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.5px] text-[var(--text3)]">
              Comparativo
            </h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v) => currency(Number(v))} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {chart.map((x) => (
                      <Cell key={x.name} fill={x.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
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
