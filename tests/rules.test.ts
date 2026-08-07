import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");

test("regras exigem propriedade do usuário e campos permitidos", () => {
  assert.match(rules, /function isOwner\(uid\)[\s\S]*request\.auth\.uid == uid/);
  assert.match(rules, /validTransaction[\s\S]*keys\(\)\.hasOnly/);
  assert.match(rules, /validPlan[\s\S]*keys\(\)\.hasOnly/);
  assert.match(rules, /validRecurrence[\s\S]*keys\(\)\.hasOnly/);
  assert.match(rules, /request\.resource\.data\.userId == uid/);
});

test("regras validam campos opcionais e limites básicos", () => {
  assert.match(rules, /pierreId.*is string/);
  assert.match(rules, /paid.*is bool/);
  assert.match(rules, /limit.*is int/);
  assert.match(rules, /category\.size\(\) <= 60/);
});
