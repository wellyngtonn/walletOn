import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalCategory,
  categorizeTransaction,
  displayCategory,
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
    categorizeTransaction({ description: "MERCADO SAO JOSE", type: "expense" }),
    "Supermercado",
  );
  assert.equal(
    categorizeTransaction({ description: "PIX MERCADO LIVRE", type: "expense" }),
    "Compras",
  );
  assert.equal(
    categorizeTransaction({ description: "CCD", type: "expense" }),
    "Compras",
  );
  assert.equal(
    categorizeTransaction({ description: "CCC", type: "expense" }),
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

test("evita falsos positivos em nomes genéricos", () => {
  assert.equal(
    categorizeTransaction({ description: "MERCADO PAGO", type: "expense" }),
    "Outros",
  );
  assert.equal(
    categorizeTransaction({ description: "PARCELA 99/120", type: "expense" }),
    "Outros",
  );
  assert.equal(
    categorizeTransaction({ description: "PAGAMENTO EXTRA", type: "expense" }),
    "Outros",
  );
});

test("normaliza Food & Drinks do provedor", () => {
  assert.equal(displayCategory("Food & Drinks"), "Alimentação");
});

test("traduz rótulos em inglês do provedor para exibição", () => {
  assert.equal(displayCategory("Eating out"), "Restaurantes");
  assert.equal(displayCategory("Food delivery"), "Restaurantes");
  assert.equal(displayCategory("Electricity"), "Moradia");
  assert.equal(displayCategory("Gas stations"), "Combustível");
  assert.equal(displayCategory("Telecommunications"), "Serviços");
  assert.equal(displayCategory("Mutual funds"), "Investimento");
  assert.equal(displayCategory("Automatic investment"), "Investimento");
  assert.equal(displayCategory("Transfer - PIX"), "Transferências");
  assert.equal(displayCategory("Same person transfer"), "Transferências");
  assert.equal(displayCategory("Categoria Personalizada"), "Categoria Personalizada");
  assert.equal(displayCategory(null), "Outros");
});

test("regras locais específicas vencem a categoria do provedor", () => {
  assert.equal(
    categorizeTransaction({
      description: "UBER *TRIP",
      category: "Shopping",
      type: "expense",
    }),
    "Transporte",
  );
  assert.equal(
    categorizeTransaction({
      description: "COMPRA CARTAO 123",
      category: "Eating out",
      type: "expense",
    }),
    "Restaurantes",
  );
  assert.equal(
    categorizeTransaction({
      description: "PAGAMENTO GENERICO",
      category: "Pharmacy",
      type: "expense",
    }),
    "Farmácia",
  );
});

test("termos genéricos não sobrescrevem a categoria do provedor", () => {
  assert.equal(
    categorizeTransaction({
      description: "PIX RECEBIDO",
      category: "Salary",
      type: "income",
    }),
    "Salário",
  );
  assert.equal(
    categorizeTransaction({
      description: "PAGAMENTO GENERICO",
      category: "Transfer - TED",
      type: "expense",
    }),
    "Transferências",
  );
});

test("categoria manual nunca é recalculada", () => {
  assert.equal(
    categorizeTransaction({
      description: "UBER *TRIP",
      category: "Lazer",
      categoryIsManual: true,
      type: "expense",
    }),
    "Lazer",
  );
  assert.equal(
    categorizeTransaction({
      description: "UBER *TRIP",
      category: "Lazer",
      type: "expense",
    }),
    "Transporte",
  );
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
