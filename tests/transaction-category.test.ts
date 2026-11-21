import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalCategory,
  categorizeTransaction,
  isKnownCategory,
} from "../src/utils/transaction-category";

test("mapeia categorias em inglês do Pluggy", () => {
  assert.equal(categorizeTransaction({ category: "Groceries" }), "Supermercado");
  assert.equal(categorizeTransaction({ category: "Food delivery" }), "Restaurantes");
  assert.equal(categorizeTransaction({ category: "Transfer - TED" }), "Transferências");
  assert.equal(categorizeTransaction({ category: "Video streaming" }), "Assinaturas");
  assert.equal(categorizeTransaction({ category: "Pharmacy" }), "Farmácia");
  assert.equal(categorizeTransaction({ category: "Gas stations" }), "Combustível");
  assert.equal(categorizeTransaction({ category: "Salary" }), "Salário");
});

test("usa palavras-chave da descrição quando não há categoria", () => {
  assert.equal(
    categorizeTransaction({ description: "IFOOD *RESTAURANTE", type: "expense" }),
    "Restaurantes",
  );
  assert.equal(
    categorizeTransaction({ description: "UBER *TRIP", type: "expense" }),
    "Transporte",
  );
  assert.equal(
    categorizeTransaction({ description: "POSTO SHELL", type: "expense" }),
    "Combustível",
  );
  assert.equal(
    categorizeTransaction({ description: "NETFLIX.COM", type: "expense" }),
    "Assinaturas",
  );
  assert.equal(
    categorizeTransaction({ description: "PIX RECEBIDO", type: "income" }),
    "Transferências",
  );
  assert.equal(
    categorizeTransaction({ description: "SUPERMERCADO CARREFOUR", type: "expense" }),
    "Supermercado",
  );
  assert.equal(
    categorizeTransaction({ description: "PIX MERCADO LIVRE", type: "expense" }),
    "Compras",
  );
});

test("preserva categorias do app e melhora apenas Outros", () => {
  assert.equal(
    categorizeTransaction({ category: "Lazer", description: "PIX", type: "expense" }),
    "Lazer",
  );
  assert.equal(
    categorizeTransaction({ category: "Outros", description: "IFOOD", type: "expense" }),
    "Restaurantes",
  );
  assert.equal(canonicalCategory("Groceries"), "Supermercado");
  assert.equal(isKnownCategory("Supermercado"), true);
  assert.equal(isKnownCategory("Outros"), false);
});

test("usa tipo de operação e fallback por tipo", () => {
  assert.equal(
    categorizeTransaction({
      description: "PAGAMENTO RECEBIDO",
      operationType: "FOLHA_PAGAMENTO",
      type: "income",
    }),
    "Salário",
  );
  assert.equal(
    categorizeTransaction({ description: "DESCONHECIDO", type: "income" }),
    "Receitas",
  );
  assert.equal(
    categorizeTransaction({ description: "DESCONHECIDO", type: "expense" }),
    "Outros",
  );
});
