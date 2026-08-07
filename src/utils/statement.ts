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

export function isValidStatementPeriod(period: StatementPeriod) {
  return (
    period.fromMonth >= 1 &&
    period.fromMonth <= 12 &&
    period.toMonth >= 1 &&
    period.toMonth <= 12 &&
    periodValue(period.fromYear, period.fromMonth) <=
      periodValue(period.toYear, period.toMonth)
  );
}

export function filterStatementTransactions(
  items: Transaction[],
  period: StatementPeriod,
) {
  const start = periodValue(period.fromYear, period.fromMonth);
  const end = periodValue(period.toYear, period.toMonth);
  return items.filter((item) => {
    const [year, month] = item.date.split("-").map(Number);
    const value = periodValue(year, month);
    return value >= start && value <= end;
  });
}

export function statementTotals(items: Transaction[]) {
  return items.reduce(
    (totals, item) => {
      if (item.type === "income") totals.income += item.amount;
      else totals.expense += item.amount;
      return totals;
    },
    { income: 0, expense: 0 },
  );
}
