"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
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
  function changeMonth(offset: number) {
    const date = new Date(year, month - 1 + offset, 1);
    onChange(date.getMonth() + 1, date.getFullYear());
  }

  const label = monthFormatter.format(new Date(year, month - 1, 1));

  return (
    <div className="month-nav" aria-label="Navegação de mês">
      <button
        type="button"
        className="month-btn"
        aria-label="Mês anterior"
        title="Mês anterior"
        onClick={() => changeMonth(-1)}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <span className="month-label" aria-live="polite">
        {label}
      </span>
      <button
        type="button"
        className="month-btn"
        aria-label="Próximo mês"
        title="Próximo mês"
        onClick={() => changeMonth(1)}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
