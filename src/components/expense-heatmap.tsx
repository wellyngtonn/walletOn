"use client";

import type { Transaction } from "@/types";
import { isImportedTransaction } from "@/utils/bank";
import { currency } from "@/utils/format";

const WEEK_DAYS = [
  { label: "D", full: "Domingo" },
  { label: "S", full: "Segunda-feira" },
  { label: "T", full: "Terça-feira" },
  { label: "Q", full: "Quarta-feira" },
  { label: "Q", full: "Quinta-feira" },
  { label: "S", full: "Sexta-feira" },
  { label: "S", full: "Sábado" },
];

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
  const movedDays = new Set<number>();

  const movementItems = items.filter(isImportedTransaction);
  movementItems.forEach((transaction) => {
    const date = new Date(`${transaction.date}T12:00:00`);
    if (date.getMonth() !== month - 1 || date.getFullYear() !== year) return;
    const day = date.getDate();
    const sign =
      transaction.type === "income" ? 1 : transaction.type === "expense" ? -1 : 0;
    dayTotals[day] = (dayTotals[day] || 0) + sign * transaction.amount;
    movedDays.add(day);
  });

  const magnitudes = Object.values(dayTotals)
    .map((value) => Math.abs(value))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const quantile = (q: number) => {
    if (magnitudes.length === 0) return 0;
    const position = (magnitudes.length - 1) * q;
    const low = Math.floor(position);
    const high = Math.ceil(position);
    return magnitudes[low] + (magnitudes[high] - magnitudes[low]) * (position - low);
  };
  const distinctMagnitudes = new Set(magnitudes).size;
  const useTiers = distinctMagnitudes >= 3;
  const lightLimit = useTiers ? quantile(0.33) : Number.POSITIVE_INFINITY;
  const mediumLimit = useTiers ? quantile(0.66) : Number.POSITIVE_INFINITY;

  const incomeTotal = movementItems
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenseTotal = movementItems
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return (
    <div className="widget heatmap-widget">
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

      <div className="heatmap-wrap" aria-label="Mapa de movimento do mês">
        <div className="hm-days">
          {WEEK_DAYS.map((day, index) => (
            <span key={index} title={day.full}>
              {day.label}
            </span>
          ))}
        </div>
        <div className="hm-grid">
          {Array.from({ length: totalCells }, (_, index) => {
            const day = index - firstDay + 1;
            if (day < 1 || day > daysInMonth) {
              return <div key={`empty-${index}`} className="hm-cell hm-cell--empty" />;
            }

            const value = dayTotals[day] || 0;
            const abs = Math.abs(value);
            const moved = movedDays.has(day);
            const displayValue = valuesHidden
              ? "••••••"
              : value > 0
                ? `+ ${currency(abs)}`
                : value < 0
                  ? `− ${currency(abs)}`
                  : moved
                    ? "0"
                    : "—";
            const tier = abs >= mediumLimit ? 2 : abs >= lightLimit ? 1 : 0;
            const tone =
              value > 0 ? "income" : value < 0 ? "expense" : moved ? "moved" : "neutral";

            return (
              <button
                key={day}
                type="button"
                className={`hm-cell hm-cell--${tone}${tone === "income" || tone === "expense" ? `-${tier}` : ""}${day === selectedDay ? " hm-cell--selected" : ""}`}
                data-day={day}
                aria-label={`${day}/${month}: ${displayValue} de saldo do dia`}
                aria-pressed={day === selectedDay}
                title={`${day}/${month}: ${displayValue} de saldo do dia`}
                onClick={() => onSelectDay(day === selectedDay ? null : day)}
              >
                <span className="hm-cell-day">{day}</span>
                {valuesHidden || moved ? (
                  <span className="hm-cell-value">{displayValue}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="hm-legend" aria-hidden="true">
          <div className="hm-legend-group">
            <span className="hm-legend-label">Entradas</span>
            <span className="hm-swatch hm-cell--income-0" />
            <span className="hm-swatch hm-cell--income-1" />
            <span className="hm-swatch hm-cell--income-2" />
          </div>
          <div className="hm-legend-group">
            <span className="hm-legend-label">Saídas</span>
            <span className="hm-swatch hm-cell--expense-0" />
            <span className="hm-swatch hm-cell--expense-1" />
            <span className="hm-swatch hm-cell--expense-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
