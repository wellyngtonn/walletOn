import assert from "node:assert/strict";
import test from "node:test";
import type { Transaction } from "../src/types";
import {
  filterStatementTransactions,
  isValidStatementPeriod,
  statementTotals,
} from "../src/utils/statement";

const items: Transaction[] = [
  {
    id: "1",
    userId: "u",
    type: "income",
    description: "Salário",
    amount: 3000,
    date: "2026-01-10",
    referenceMonth: 1,
    referenceYear: 2026,
  },
  {
    id: "2",
    userId: "u",
    type: "expense",
    description: "Aluguel",
    amount: 1200,
    date: "2026-02-10",
    referenceMonth: 2,
    referenceYear: 2026,
  },
];

test("filtra o extrato pelo período e calcula os totais", () => {
  const period = { fromMonth: 1, fromYear: 2026, toMonth: 1, toYear: 2026 };
  const filtered = filterStatementTransactions(items, period);

  assert.equal(isValidStatementPeriod(period), true);
  assert.deepEqual(statementTotals(filtered), { income: 3000, expense: 0 });
  assert.equal(filtered.length, 1);
});

test("rejeita período final anterior ao inicial", () => {
  assert.equal(
    isValidStatementPeriod({
      fromMonth: 3,
      fromYear: 2026,
      toMonth: 2,
      toYear: 2026,
    }),
    false,
  );
});
