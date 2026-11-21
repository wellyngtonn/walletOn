import assert from "node:assert/strict";
import test from "node:test";
import handler, { mapPierreTransactions } from "../api/pierre";

process.env.FIREBASE_WEB_API_KEY = "test-firebase";

type Result = { status: number; payload: unknown };

async function call(
  fetchImpl: typeof fetch,
  options: { method?: string; authorization?: string; body?: unknown } = {},
): Promise<Result> {
  const originalFetch = global.fetch;
  let status = 200;
  let payload: unknown;
  const response = {
    setHeader() {},
    end() {},
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
    },
  } as unknown as Parameters<typeof handler>[1];
  const request = {
    method: options.method || "POST",
    headers: options.authorization ? { authorization: options.authorization } : {},
    body: options.body,
  } as unknown as Parameters<typeof handler>[0];
  try {
    global.fetch = fetchImpl as typeof fetch;
    await handler(request, response);
  } finally {
    global.fetch = originalFetch;
  }
  return { status, payload };
}

const accounts = [
  { id: "acc-1", name: "Carteira 1 - Itaú", balance: 100, aliases: ["Itaú", "itau"] },
  { id: "acc-2", name: "Carteira 2 - Nubank", balance: 200, aliases: ["Nubank"] },
];

test("API Pierre exige método POST", async () => {
  const result = await call(async () => Response.json({}), { method: "GET" });
  assert.equal(result.status, 405);
});

test("API Pierre responde OPTIONS sem autenticar", async () => {
  const result = await call(async () => Response.json({}), { method: "OPTIONS" });
  assert.equal(result.status, 204);
});

test("API Pierre exige login antes de qualquer ação", async () => {
  const result = await call(async () => Response.json({}), { body: { action: "sync" } });
  assert.equal(result.status, 401);
});

test("API Pierre rejeita token inválido", async () => {
  const fetchImpl = async (input: unknown) => {
    const url = String(input);
    if (url.includes("identitytoolkit")) return Response.json({}, { status: 401 });
    return Response.json({}, { status: 500 });
  };
  const result = await call(fetchImpl, {
    authorization: "Bearer token-invalido",
    body: { action: "sync" },
  });
  assert.equal(result.status, 401);
});

test("usa a carteira de fallback quando a transação não traz conta", () => {
  const items = mapPierreTransactions(
    [{ id: "t1", description: "Mercado", amount: 10, date: "2026-01-05" }],
    accounts,
    "acc-1",
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].accountId, "acc-1");
});

test("associa a carteira pelo nome da conta (alias)", () => {
  const items = mapPierreTransactions(
    [{ id: "t2", description: "Salário", amount: 5000, date: "2026-01-10", accountName: "Itaú" }],
    accounts,
    "acc-2",
  );
  assert.equal(items[0].accountId, "acc-1");
});

test("o id direto da transação tem precedência sobre o fallback", () => {
  const items = mapPierreTransactions(
    [{ id: "t3", description: "Pix", amount: 20, date: "2026-01-11", accountId: "acc-2", accountName: "Itaú" }],
    accounts,
    "acc-1",
  );
  assert.equal(items[0].accountId, "acc-2");
});

test("valor negativo vira despesa com valor absoluto", () => {
  const items = mapPierreTransactions(
    [{ id: "t4", description: "Compra", amount: -30, date: "2026-01-12" }],
    accounts,
    "acc-1",
  );
  assert.equal(items[0].type, "expense");
  assert.equal(items[0].amount, 30);
});

test("descarta transações sem data válida", () => {
  const items = mapPierreTransactions(
    [{ id: "t5", description: "X", amount: 10, date: "13/01/2026" }],
    accounts,
    "acc-1",
  );
  assert.equal(items.length, 0);
});
