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
  assert.equal(cleanTransactionName("PIX ENVIADO - TESTE"), "Pix - Teste");
  assert.equal(cleanTransactionName("Transferência recebido de João"), "Transferência de João");
});

test("converte descrições em maiúsculas para caixa de exibição", () => {
  assert.equal(
    cleanTransactionName("PIX RECEBIDO - JOAO DA SILVA"),
    "Pix - Joao da Silva",
  );
  assert.equal(
    cleanTransactionName("COMPRA CARTAO DEBITO"),
    "CCD",
  );
  assert.equal(
    cleanTransactionName("PAGAMENTO CPF 123"),
    "Pagamento CPF 123",
  );
  assert.equal(
    cleanTransactionName("Pix - Supermercado"),
    "Pix - Supermercado",
  );
});

test("abrevia compra no cartão de débito e crédito", () => {
  assert.equal(cleanTransactionName("COMPRA CARTAO DE DEB"), "CCD");
  assert.equal(cleanTransactionName("compra cartão de deb"), "CCD");
  assert.equal(cleanTransactionName("COMPRA CARTAO DE DEBITO"), "CCD");
  assert.equal(cleanTransactionName("COMPRA CARTAO DE CRED"), "CCC");
  assert.equal(cleanTransactionName("compra cartão de cred"), "CCC");
  assert.equal(cleanTransactionName("COMPRA CARTAO DE CREDITO - MERCADO"), "CCC - Mercado");
});

test("remove MC com data da descrição", () => {
  assert.equal(cleanTransactionName("MERCADO MC 12/03"), "Mercado");
  assert.equal(cleanTransactionName("MC 05/11 Loja Centro"), "Loja Centro");
  assert.equal(cleanTransactionName("FARMACIA MC12/03"), "Farmacia");
  assert.equal(cleanTransactionName("LOJA MC 12/03/2026"), "Loja");
  assert.equal(cleanTransactionName("MCDONALDS"), "Mcdonalds");
});

test("formata palavras em maiúsculas mesmo em nomes mistos", () => {
  assert.equal(
    cleanTransactionName("DEBITO TITULO DE CAPITALIZACAO Proposta:0331391197088"),
    "Debito Titulo de Capitalizacao Proposta:0331391197088",
  );
  assert.equal(
    cleanTransactionName("PAGAMENTO FATURA Cartao Nubank"),
    "Pagamento Fatura Cartao Nubank",
  );
});

test("não remove trechos de palavras nem recebido de estabelecimentos", () => {
  assert.equal(cleanTransactionName("PIX REENVIADO"), "Pix Reenviado");
  assert.equal(cleanTransactionName("PIX RECEBIDOS"), "Pix");
  assert.equal(
    cleanTransactionName("RECEBIDO PELO COMERCIO"),
    "Recebido Pelo Comercio",
  );
});

test("mantém nomes sem as palavras intactos", () => {
  assert.equal(cleanTransactionName("Pix - Supermercado"), "Pix - Supermercado");
  assert.equal(cleanTransactionName("Compras do mês"), "Compras do mês");
  assert.equal(cleanTransactionName(""), "");
});
