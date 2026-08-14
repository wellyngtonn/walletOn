import assert from "node:assert/strict";
import test from "node:test";
import type { Transaction } from "../src/types";
import {
  createStatementPdf,
  statementPdfFilename,
} from "../src/utils/statement-pdf";

const period = { fromMonth: 1, fromYear: 2026, toMonth: 2, toYear: 2026 };
const items: Transaction[] = [
  {
    id: "income-1",
    userId: "user-1",
    type: "income",
    description: "Salario",
    amount: 3000,
    date: "2026-01-10",
    referenceMonth: 1,
    referenceYear: 2026,
    pierreId: "pierre-1",
    accountId: "inter",
  },
  {
    id: "expense-1",
    userId: "user-1",
    type: "expense",
    description: "Aluguel",
    amount: 1200,
    date: "2026-02-10",
    referenceMonth: 2,
    referenceYear: 2026,
    pierreId: "pierre-2",
    accountId: "inter",
  },
];

test("gera um PDF real com o resumo e as movimentacoes", () => {
  const pdf = createStatementPdf(items, period, "Inter");
  const bytes = pdf.output("arraybuffer");

  assert.equal(new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5)), "%PDF-");
  assert.ok(bytes.byteLength > 1000);
  assert.match(statementPdfFilename(period), /^wallet-on-extrato-pierre-2026-01-2026-02\.pdf$/);

});
