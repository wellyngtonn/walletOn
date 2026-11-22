import type { TransactionType } from "../types";

export const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

export const dateBR = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
};

export function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayISO() {
  return isoDate(new Date());
}

export const typeLabels: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  investment: "Investimento",
};
