import assert from "node:assert/strict";
import test from "node:test";
import { parseReceiptText } from "../src/utils/receipt-parser";

test("extrai item com quantidade fracionária em kg e usa o preço total", () => {
  const [item] = parseReceiptText("010 0000000013031 Bacon Seara Manta 0,606 Ka 19,99 16,11");
  assert.ok(item);
  assert.equal(item.name, "Bacon Seara Manta");
  assert.equal(item.qty, 1);
  assert.equal(item.price, 16.11);
});

test("extrai produto com peso no nome e preço total como preço", () => {
  const [item] = parseReceiptText("014 7896423701005 Macarrao Espec 50 1 Un 2,69 2,62");
  assert.ok(item);
  assert.equal(item.name, "Macarrao Espec");
  assert.equal(item.price, 2.62);
});

test("remove restos de código de barras misturados com letras", () => {
  const [item] = parseReceiptText("015 7894S04009862 Ling Calabresa 40 1 Un 9,49 9,49");
  assert.ok(item);
  assert.equal(item.name, "Ling Calabresa");
  assert.equal(item.price, 9.49);
});

test("remove tokens alfanuméricos tipo 12en e unidade mal lida dn", () => {
  const [item] = parseReceiptText("016 7897042008121 Cr Skala ka 12en 1 dn 9,80 9,80");
  assert.ok(item);
  assert.equal(item.name, "Cr Skala");
  assert.equal(item.price, 9.8);
});

test("item a granel por kg com total de 7,9", () => {
  const [item] = parseReceiptText("019 0000000000147 Alho Granel Ka — 0,275 Kg 28,98 7,9%");
  assert.ok(item);
  assert.equal(item.name, "Alho Granel");
  assert.equal(item.price, 7.9);
});

test("remove números antes da descrição", () => {
  const [item] = parseReceiptText("d! 16556136 Sao Plastica Mist | 5,99 5,99");
  assert.ok(item);
  assert.equal(item.name, "Sao Plastica Mist");
  assert.equal(item.price, 5.99);
});

test("remove classificação numérica do fim do nome", () => {
  const [item] = parseReceiptText("018 0000000001373 Maca Fugi Tipo 1 0,633 Ka 4,95 3,14");
  assert.ok(item);
  assert.equal(item.name, "Maca Fugi Tipo");
  assert.equal(item.price, 3.14);
});

test("eAN colado no início da linha é removido", () => {
  const [item] = parseReceiptText("8641027040, Filezinho Bello Un 12/99 12,99");
  assert.ok(item);
  assert.equal(item.name, "Filezinho Bello");
  assert.equal(item.price, 12.99);
});

test("dois pontos como separador decimal vira vírgula", () => {
  const [item] = parseReceiptText("022 789605115717A Reg Cren Itanbe 2 1 Un 6,99 6:93");
  assert.ok(item);
  assert.equal(item.name, "Reg Cren Itanbe");
  assert.equal(item.price, 6.93);
});

test("unidade lida como Uh ainda é reconhecida", () => {
  const [item] = parseReceiptText("020 7896098900208 Det Lia Ye Neutr 1 Uh 218 2,19");
  assert.ok(item);
  assert.equal(item.name, "Det Lia Ye Neutr");
  assert.equal(item.price, 2.19);
});

test("ignora linhas de totais, pagamento e desconto", () => {
  const result = parseReceiptText([
    "SUBTOTAL R$ Ú 10,25",
    "Desconto Subtote) f$ 0,15",
    "Valor Tete) 310,10",
    "FuRNA DE PAGAMENTO VALOR PÁGO",
    "Cartao Cred 280,00",
    "DESC. ATACAREJO ITEM 047 APLICADO NO SUBTOTAL 0,05",
  ].join("\n"));
  assert.equal(result.length, 0);
});

test("cupom completo produz vários itens sem lixo de rodapé", () => {
  const result = parseReceiptText([
    "SUS",
    "0: CONTRO",
    "| Bella 8 | 17,9",
    "8641027040, Filezinho Bello Un 12/99 12,99",
    "010 0000000013031 Bacon Seara Manta 0,606 Ka 19,99 16,11",
    "014 7896423701005 Macarrao Espec 50 1 Un 2,69 2,62",
    "015 7894S04009862 Ling Calabresa 40 1 Un 9,49 9,49",
    "018 0000000001373 Maca Fugi Tipo 1 0,633 Ka 4,95 3,14",
    "044 7696045112418 Refr Frisco S.Fru dl Um 0,986 0:95",
    "DESC. ATACAREJO YEN 044 APLICADO NO SUBTOTAL -0,05",
    "048 Oogo0no0n0451+ Lheiro Verde Coen 1 Un k) 3,9",
    "SUBTOTAL R$ Ú 10,25",
    "Desconto Subtote) f$ 0,15",
    "0tde,tota) de têns 48",
    "Valor Tete) 310,10",
    "FuRNA DE PAGAMENTO VALOR PÁGO",
    "Cartao Cred 280,00",
  ].join("\n"));

  const names = result.map((item) => item.name);
  assert.ok(names.includes("Bacon Seara Manta"));
  assert.ok(names.includes("Macarrao Espec"));
  assert.ok(names.includes("Filezinho Bello"));
  assert.ok(names.includes("Lheiro Verde Coen"));
  assert.ok(!names.includes("Valor Tete"));
  assert.ok(!names.includes("Cartao Cred"));
  assert.ok(!result.some((item) => item.price <= 0));
});
