"use client";

import { useMemo } from "react";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_BACKLOG = 10;

const monthNames = Array.from({ length: 12 }, (_, i) => {
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(CURRENT_YEAR, i, 1),
  );
  return {
    value: i + 1,
    label: name.charAt(0).toUpperCase() + name.slice(1),
  };
});

export function MonthPicker({
  month,
  year,
  onChange,
}: {
  month: number;
  year: number;
  onChange: (m: number, y: number) => void;
}) {
  const years = useMemo(() => {
    const min = Math.min(year, CURRENT_YEAR - YEAR_BACKLOG);
    const max = Math.max(year, CURRENT_YEAR + 1);
    const list: number[] = [];
    for (let y = max; y >= min; y -= 1) list.push(y);
    return list;
  }, [year]);

  return (
    <div className="month-nav" aria-label="Seleção de mês e ano">
      <select
        className="month-select"
        aria-label="Mês"
        value={month}
        onChange={(event) => onChange(Number(event.target.value), year)}
      >
        {monthNames.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <select
        className="month-select month-select-year"
        aria-label="Ano"
        value={year}
        onChange={(event) => onChange(month, Number(event.target.value))}
      >
        {years.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}
