import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeBackup,
  normalizePlan,
  normalizeRecurrence,
  normalizeTransaction,
} from "../src/utils/backup";

test("normaliza backup completo e mantém as três coleções", () => {
  const backup = normalizeBackup({ tx: [1], plan: [2], rec: [3] });
  assert.deepEqual(backup, { tx: [1], plan: [2], rec: [3] });
});

test("normaliza transação brasileira com valor e data", () => {
  const item = normalizeTransaction({
    id: "abc/1",
    tipo: "despesa",
    desc: "Mercado",
    val: "R$ 1.234,56",
    date: "31/01/2026",
  });
  assert.equal(item?.id, "carteira-tx-abc-1");
  assert.equal(item?.data.amount, 1234.56);
  assert.equal(item?.data.date, "2026-01-31");
  assert.equal(item?.data.referenceMonth, 1);
});

test("normaliza plano e recorrência", () => {
  const plan = normalizePlan({ id: "p1", type: "receita", amount: 50, date: "2026-02-01" });
  const rec = normalizeRecurrence({
    id: "r1",
    type: "despesa",
    amount: 75,
    startDate: "2026-02-01",
    period: "trimestral",
  });
  assert.equal(plan?.data.type, "income");
  assert.equal(rec?.id, "carteira-rec-r1");
  assert.equal(rec?.data.period, "quarterly");
  assert.equal(rec?.data.originalDay, 1);
});

test("descarta dados financeiros inválidos", () => {
  assert.equal(normalizeTransaction({ amount: 0, date: "2026-01-01" }), null);
  assert.equal(normalizePlan({ amount: 10, date: "invalida" }), null);
  assert.equal(normalizeRecurrence({ amount: 10, startDate: "2026-01-01" }), null);
  assert.throws(() => normalizeBackup({ plan: [] }), /tx/);
});
