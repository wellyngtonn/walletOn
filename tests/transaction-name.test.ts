import assert from "node:assert/strict";
import test from "node:test";
import { cleanTransactionName } from "../src/utils/transaction-name";

test("remove enviado/recebido do nome da transação", () => {
  assert.equal(
    cleanTransactionName("Pix enviado - Fidc Multisegmentos Npl Ipanema Vi Responsabilidade Limitada"),
    "Pix - Fidc Multisegmentos Npl Ipanema Vi Responsabilidade Limitada",
  );
  assert.equal(
    cleanTransactionName("Pix recebido - Wellyngton Nunes Pereira"),
    "Pix - Wellyngton Nunes Pereira",
  );
});

test("ignora caixa e espaços ao redor das palavras", () => {
  assert.equal(cleanTransactionName("PIX ENVIADO - TESTE"), "PIX - TESTE");
  assert.equal(cleanTransactionName("Transferência recebido de João"), "Transferência de João");
});

test("mantém nomes sem as palavras intactos", () => {
  assert.equal(cleanTransactionName("Pix - Supermercado"), "Pix - Supermercado");
  assert.equal(cleanTransactionName("Compras do mês"), "Compras do mês");
  assert.equal(cleanTransactionName(""), "");
});
