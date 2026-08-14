"use client";

import type { Transaction } from "@/types";
import { currency } from "@/utils/format";

const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type ExpenseHeatmapProps = {
  items: Transaction[];
  month: number;
  year: number;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
  valuesHidden: boolean;
};

export function ExpenseHeatmap({
  items,
  month,
  year,
  selectedDay,
  onSelectDay,
  valuesHidden,
}: ExpenseHeatmapProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const dayTotals: Record<number, number> = {};

  items
    .filter((transaction) => transaction.type === "expense" && transaction.pierreId)
    .forEach((transaction) => {
      const date = new Date(`${transaction.date}T12:00:00`);
      if (date.getMonth() !== month - 1 || date.getFullYear() !== year) return;
      const day = date.getDate();
      dayTotals[day] = (dayTotals[day] || 0) + transaction.amount;
    });

  const values = Object.values(dayTotals);
  const maxValue = values.length ? Math.max(...values) : 1;
  const movementItems = items.filter((transaction) => transaction.pierreId);
  const incomeTotal = movementItems
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenseTotal = movementItems
    .filter((transaction) => transaction.type !== "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return (
    <div className="widget">
      <div className="heatmap-movement">
        <h3 className="heatmap-movement-title">Movimento Semanal</h3>
        <div className="heatmap-movement-grid">
          <div className="heatmap-movement-item">
            <span>Entradas</span>
            <strong className="heatmap-movement-income">
              {valuesHidden ? "••••••" : currency(incomeTotal)}
            </strong>
          </div>
          <div className="heatmap-movement-item">
            <span>Saídas</span>
            <strong className="heatmap-movement-expense">
              {valuesHidden ? "••••••" : currency(expenseTotal)}
            </strong>
          </div>
        </div>
      </div>

      <div className="heatmap-wrap" aria-label="Mapa de gastos do mês">
        <div className="hm-days">
          {WEEK_DAYS.map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>
        <div className="hm-grid">
          {Array.from({ length: totalCells }, (_, index) => {
            const day = index - firstDay + 1;
            if (day < 1 || day > daysInMonth) {
              return <div key={`empty-${index}`} className="hm-cell hm-cell--empty" />;
            }

            const value = dayTotals[day] || 0;
            const intensity = maxValue > 0 ? value / maxValue : 0;
            let background = "var(--border-soft)";
            let color = "var(--text3)";
            if (value > 0) {
              if (intensity < 0.3) {
                background = "#ffe0de";
                color = "#c0392b";
              } else if (intensity < 0.65) {
                background = "#ff8c85";
                color = "#fff";
              } else {
                background = "#ff3b30";
                color = "#fff";
              }
            }

            return (
              <button
                key={day}
                type="button"
                className={`hm-cell${day === selectedDay ? " hm-cell--selected" : ""}`}
                data-day={day}
                style={{ background, color }}
                aria-label={`${day}/${month}: ${currency(value)} em gastos`}
                title={`${day}/${month}: ${currency(value)} em gastos`}
                onClick={() => onSelectDay(day === selectedDay ? null : day)}
              >
                <span className="hm-cell-day">{day}</span>
                <span className="hm-cell-value">
                  {value > 0 ? compactCurrency.format(value) : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
