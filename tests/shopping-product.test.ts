import assert from "node:assert/strict";
import test from "node:test";
import { shoppingProductName, cosmosProductName, upcProductName, validBarcode, readableProductName, capitalizeProductName } from "../src/utils/shopping-product";

test("completa o arroz do exemplo com marca e peso informado", () => {
  assert.equal(shoppingProductName({ product_name: "Arroz", brands: "Tio lautério" }, "7896559100215"), "Arroz Tio lautério 5 kg");
});

test("combina nome, primeira marca e quantidade da base", () => {
  assert.equal(shoppingProductName({ product_name: "Leite", brands: "Marca A,Empresa", quantity: "1 L" }, "123"), "Leite Marca A 1 L");
});

test("não repete marca ou peso já presentes no nome", () => {
  assert.equal(shoppingProductName({ product_name: "Arroz Tio Lautério 5Kg", brands: "Tio lautério", quantity: "5 kg" }, "123"), "Arroz Tio Lautério 5Kg");
  assert.equal(shoppingProductName({ product_name: "Arroz 5kg", brands: "Marca", quantity: "5 kg" }, "123"), "Arroz Marca 5kg");
});

test("usa quantidade estruturada e não inventa campos ausentes", () => {
  assert.equal(shoppingProductName({ product_name: "Suco", product_quantity: 200, product_quantity_unit: "ml" }, "123"), "Suco 200 ml");
  assert.equal(shoppingProductName({ product_name: "Arroz" }, "123"), "Arroz");
  assert.equal(shoppingProductName(undefined, "123"), "");
});

test("Cosmos preserva medidas e converte peso líquido em gramas", () => {
  assert.equal(cosmosProductName({ description: "Arroz", brand: { name: "Marca" }, net_weight: 5000 }, "123"), "Arroz Marca 5 kg");
  assert.equal(cosmosProductName({ description: "Leite Marca 1L", brand: { name: "Marca" }, net_weight: 1030 }, "123"), "Leite Marca 1L");
});

test("valida dígito verificador antes de gastar uma consulta", () => {
  assert.equal(validBarcode("7896559100215"), true);
  assert.equal(validBarcode("7891910000197"), true);
  assert.equal(validBarcode("7896559100214"), false);
  assert.equal(validBarcode("78965591002"), false);
  assert.equal(validBarcode("abc"), false);
});

test("UPCitemdb exige o mesmo código e preserva medida da embalagem", () => {
  assert.equal(upcProductName({ items: [{ ean: "7891910000197", title: "Açúcar União 1kg", brand: "União", size: "1000 g" }] }, "7891910000197"), "Açúcar União 1kg");
  assert.equal(upcProductName({ items: [{ ean: "7891910000197", title: "Açúcar" }] }, "7896559100215"), "");
  assert.equal(upcProductName({ items: [] }, "7896559100215"), "");
  assert.equal(upcProductName({ items: [{ ean: "0012345678905", title: "Item", brand: "Marca" }] }, "012345678905"), "Item Marca");
});

test("formata nomes em caixa alta para o formato legível", () => {
  assert.equal(readableProductName("PASSATA RÚSTICA SALSARETTI 300G"), "Passata Rústica Salsaretti 300g");
  assert.equal(readableProductName("DETERGENTE LÍQUIDO 500ML"), "Detergente Líquido 500ml");
  assert.equal(readableProductName("PÃO DE QUEIJO 1KG"), "Pão de Queijo 1kg");
  assert.equal(readableProductName("PASSATA SALSARETTI 300 G"), "Passata Salsaretti 300 g");
});

test("não altera nomes que já possuem minúsculas", () => {
  assert.equal(readableProductName("Arroz Tio Lautério 5Kg"), "Arroz Tio Lautério 5Kg");
  assert.equal(readableProductName("Suco tang"), "Suco tang");
  assert.equal(readableProductName("300"), "300");
  assert.equal(readableProductName(""), "");
});

test("capitaliza cada palavra da descrição", () => {
  assert.equal(capitalizeProductName("hemmer ketchup tradicional heinz 1 kg"), "Hemmer Ketchup Tradicional Heinz 1 kg");
  assert.equal(capitalizeProductName("suco tang"), "Suco Tang");
  assert.equal(capitalizeProductName("leite integral 1l"), "Leite Integral 1l");
  assert.equal(capitalizeProductName("PASSATA RÚSTICA SALSARETTI 300G"), "Passata Rústica Salsaretti 300g");
  assert.equal(capitalizeProductName("pão de queijo 500g"), "Pão de Queijo 500g");
  assert.equal(capitalizeProductName("água com gás"), "Água com Gás");
  assert.equal(capitalizeProductName("300"), "300");
  assert.equal(capitalizeProductName(""), "");
});
