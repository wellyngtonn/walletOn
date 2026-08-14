import type { Transaction } from "../types";

export interface StatementPeriod {
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
}

function periodValue(year: number, month: number) {
  return year * 12 + month;
}

function dateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month };
}

export function isValidStatementPeriod(period: StatementPeriod) {
  return (
    Number.isInteger(period.fromYear) &&
    Number.isInteger(period.toYear) &&
    Number.isInteger(period.fromMonth) &&
    Number.isInteger(period.toMonth) &&
    period.fromYear >= 1 &&
    period.toYear >= 1 &&
    period.fromMonth >= 1 &&
    period.fromMonth <= 12 &&
    period.toMonth >= 1 &&
    period.toMonth <= 12 &&
    periodValue(period.fromYear, period.fromMonth) <=
      periodValue(period.toYear, period.toMonth)
  );
}

export function statementPeriodBounds(period: StatementPeriod) {
  if (!isValidStatementPeriod(period)) {
    throw new Error("Período de extrato inválido.");
  }

  const lastDay = new Date(period.toYear, period.toMonth, 0).getDate();
  return {
    fromDate: `${period.fromYear}-${String(period.fromMonth).padStart(2, "0")}-01`,
    toDate: `${period.toYear}-${String(period.toMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function filterStatementTransactions(
  items: Transaction[],
  period: StatementPeriod,
) {
  const start = periodValue(period.fromYear, period.fromMonth);
  const end = periodValue(period.toYear, period.toMonth);
  return items.filter((item) => {
    const parts = dateParts(item.date);
    if (!parts) return false;
    const { year, month } = parts;
    const value = periodValue(year, month);
    return value >= start && value <= end;
  });
}

export function statementTotals(items: Transaction[]) {
  return items.reduce(
    (totals, item) => {
      if (item.type === "income") totals.income += item.amount;
      else if (item.type === "expense") totals.expense += item.amount;
      return totals;
    },
    { income: 0, expense: 0 },
  );
}
