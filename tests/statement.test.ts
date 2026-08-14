import assert from "node:assert/strict";
import test from "node:test";
import type { Transaction } from "../src/types";
import {
  filterStatementTransactions,
  isValidStatementPeriod,
  statementPeriodBounds,
  statementTotals,
} from "../src/utils/statement";
import {
  filterPierreMovements,
  selectDefaultPierreAccount,
} from "../src/utils/pierre";

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

test("calcula os limites exatos do período para a consulta", () => {
  assert.deepEqual(
    statementPeriodBounds({
      fromMonth: 1,
      fromYear: 2026,
      toMonth: 2,
      toYear: 2026,
    }),
    { fromDate: "2026-01-01", toDate: "2026-02-28" },
  );
});

test("rejeita datas inválidas ao filtrar o extrato", () => {
  const period = { fromMonth: 1, fromYear: 2026, toMonth: 3, toYear: 2026 };
  const filtered = filterStatementTransactions(
    [
      { ...items[0], id: "valid", date: "2026-02-10" },
      { ...items[0], id: "invalid-day", date: "2026-02-31" },
      { ...items[0], id: "invalid-format", date: "10/02/2026" },
    ],
    period,
  );

  assert.deepEqual(filtered.map((item) => item.id), ["valid"]);
});

test("rejeita ano inválido no período", () => {
  assert.equal(
    isValidStatementPeriod({
      fromMonth: 1,
      fromYear: 0,
      toMonth: 1,
      toYear: 2026,
    }),
    false,
  );
});

test("mantem somente entradas e saidas Pierre da conta selecionada", () => {
  const pierreItems: Transaction[] = [
    { ...items[0], id: "pierre-income", pierreId: "p1", accountId: "inter" },
    { ...items[1], id: "pierre-expense", pierreId: "p2", accountId: "nubank" },
    { ...items[1], id: "manual", accountId: "inter" },
    { ...items[1], id: "investment", pierreId: "p3", accountId: "inter", type: "investment" },
  ];

  assert.deepEqual(
    filterPierreMovements(pierreItems, "inter").map((item) => item.id),
    ["pierre-income"],
  );
});

test("nao soma investimentos nos totais do extrato", () => {
  const investment = { ...items[0], id: "investment", type: "investment" as const };
  assert.deepEqual(statementTotals([items[0], investment]), { income: 3000, expense: 0 });
});

test("seleciona por padrao a carteira com maior saldo", () => {
  const selected = selectDefaultPierreAccount([
    { id: "nubank", name: "Nubank", balance: 800 },
    { id: "inter", name: "Inter", balance: 2400 },
    { id: "itau", name: "Itaú", balance: 1200 },
  ]);

  assert.equal(selected?.id, "inter");
});
