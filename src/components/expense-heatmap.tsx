"use client";

import type { Transaction } from "@/types";
import { currency } from "@/utils/format";

const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

type ExpenseHeatmapProps = {
  items: Transaction[];
  month: number;
  year: number;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
};

export function ExpenseHeatmap({
  items,
  month,
  year,
  selectedDay,
  onSelectDay,
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
  const total = values.reduce((sum, value) => sum + value, 0);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return (
    <div className="widget">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.5px] text-[var(--text3)]">
          Mapa de Gastos
        </h2>
        <span className="heatmap-total">
          {total > 0 ? `Total: ${currency(total)}` : ""}
        </span>
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
                title={`${day}/${month}: ${currency(value)}`}
                onClick={() => onSelectDay(day === selectedDay ? null : day)}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
