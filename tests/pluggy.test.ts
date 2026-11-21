import assert from "node:assert/strict";
import test from "node:test";
import {
  mapPluggyAccounts,
  mapPluggyTransactions,
  pluggyTransactionDocId,
} from "../src/utils/pluggy";

test("mapeia contas do Pluggy mantendo tipo e saldo", () => {
  const accounts = mapPluggyAccounts([
    {
      id: "acc-1",
      name: "Conta Corrente",
      marketingName: "Gold",
      balance: 120.5,
      type: "BANK",
      subtype: "CHECKING_ACCOUNT",
      currencyCode: "BRL",
    },
    {
      id: "acc-2",
      name: "Cartão",
      balance: 300,
      type: "CREDIT",
      subtype: "CREDIT_CARD",
    },
    { id: "" },
  ]);

  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].id, "acc-1");
  assert.equal(accounts[0].name, "Carteira 1 - Conta Corrente");
  assert.equal(accounts[0].balance, 120.5);
  assert.equal(accounts[0].type, "BANK");
  assert.equal(accounts[0].currency, "BRL");
  assert.equal(accounts[1].type, "CREDIT");
});

test("converte DEBIT em despesa e CREDIT em receita", () => {
  const items = mapPluggyTransactions(
    [
      {
        id: "t1",
        description: "Mercado",
        amount: 50,
        date: "2026-01-05T00:00:00.000Z",
        type: "DEBIT",
        accountId: "acc-1",
        category: "Groceries",
      },
      {
        id: "t2",
        description: "Salario",
        amount: 5000,
        date: "2026-01-10T00:00:00.000Z",
        type: "CREDIT",
        accountId: "acc-1",
      },
    ],
    "acc-1",
  );

  assert.equal(items.length, 2);
  assert.equal(items[0].type, "expense");
  assert.equal(items[0].amount, 50);
  assert.equal(items[0].category, "Alimentação");
  assert.equal(items[1].type, "income");
  assert.equal(items[1].category, "Outros");
});

test("usa o sinal do valor quando o tipo nao vem no payload", () => {
  const items = mapPluggyTransactions(
    [
      {
        id: "t3",
        description: "Compra",
        amount: -30,
        date: "2026-01-12",
        accountId: "acc-1",
      },
    ],
    undefined,
  );

  assert.equal(items[0].type, "expense");
  assert.equal(items[0].amount, 30);
  assert.equal(items[0].accountId, "acc-1");
});

test("descarta transacoes invalidas", () => {
  const items = mapPluggyTransactions([
    { id: "sem-data", description: "X", amount: 10, accountId: "acc-1" },
    { id: "data-ruim", description: "X", amount: 10, date: "13/01/2026", accountId: "acc-1" },
    { id: "sem-valor", description: "X", amount: 0, date: "2026-01-05", accountId: "acc-1" },
    { id: "sem-conta", description: "X", amount: 10, date: "2026-01-05" },
  ]);

  assert.equal(items.length, 0);
});

test("prefixa o id do documento para nao colidir com o Pierre", () => {
  assert.equal(pluggyTransactionDocId("abc"), "pluggy-abc");
});
