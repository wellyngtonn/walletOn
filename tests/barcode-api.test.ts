import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/barcode";

const savedEnv: Record<string, string | undefined> = {
  COSMOS_API_TOKEN: process.env.COSMOS_API_TOKEN,
  COSMOS_USER_AGENT: process.env.COSMOS_USER_AGENT,
};
process.env.FIREBASE_WEB_API_KEY = "test-firebase";

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

type Routes = {
  off?: "found" | "empty" | "missing";
  cosmosStatus?: number;
  upcCode?: string;
};

function makeFetch(routes: Routes, counts: { off: number; cosmos: number; upc: number; cosmosHeaders: string[] }) {
  return async (input: unknown, options?: { headers?: unknown }) => {
    const url = String(input);
    const headers = new Headers((options?.headers || {}) as Record<string, string>);
    if (url.includes("identitytoolkit")) return Response.json({ users: [{ localId: "test-user" }] });
    if (url.includes("openfoodfacts")) {
      counts.off += 1;
      if (routes.off === "found") {
        return Response.json({ product: { product_name_pt: "Arroz", brands: "Tio Lautério" } });
      }
      if (routes.off === "empty") return Response.json({ product: null });
      return Response.json({}, { status: 404 });
    }
    if (url.includes("api.cosmos.bluesoft.com.br")) {
      counts.cosmos += 1;
      counts.cosmosHeaders.push(String(headers.get("X-Cosmos-Token") || ""));
      if (routes.cosmosStatus) return Response.json({}, { status: routes.cosmosStatus });
      return Response.json({ description: "Arroz", brand: { name: "Marca" }, net_weight: 5000 });
    }
    if (url.includes("upcitemdb")) {
      counts.upc += 1;
      if (!routes.upcCode) return Response.json({ items: [] });
      return Response.json({
        items: [{ ean: routes.upcCode, upc: routes.upcCode, title: "Arroz Prato Fino", brand: "Prato Fino", size: "5 kg" }],
      });
    }
    return Response.json({}, { status: 500 });
  };
}

type Result = { status: number; payload: unknown };

async function call(fetchImpl: typeof fetch, barcode: string, authorization?: string): Promise<Result> {
  const originalFetch = global.fetch;
  let status = 200;
  let payload: unknown;
  const response = {
    setHeader() {}, end() {},
    status(code: number) { status = code; return this; },
    json(value: unknown) { payload = value; },
  } as unknown as Parameters<typeof handler>[1];
  const request = {
    method: "POST",
    headers: authorization ? { authorization } : {},
    body: { barcode },
  } as unknown as Parameters<typeof handler>[0];
  try {
    global.fetch = fetchImpl as typeof fetch;
    await handler(request, response);
  } finally {
    global.fetch = originalFetch;
  }
  return { status, payload };
}

function newCounts() {
  return { off: 0, cosmos: 0, upc: 0, cosmosHeaders: [] as string[] };
}

test("API exige login antes de consultar provedores", async () => {
  const counts = newCounts();
  const result = await call(makeFetch({}, counts), "7896559100215");
  assert.equal(result.status, 401);
  assert.equal(counts.off + counts.cosmos + counts.upc, 0);
});

test("Open Food Facts resolve sem gastar Cosmos nem UPCitemdb", async () => {
  process.env.COSMOS_API_TOKEN = "test-secret";
  process.env.COSMOS_USER_AGENT = "test-agent";
  const counts = newCounts();
  try {
    const result = await call(makeFetch({ off: "found" }, counts), "7896559100215", "Bearer t");
    assert.equal(result.status, 200);
    assert.deepEqual(result.payload, { name: "Arroz Tio Lautério 5 kg", source: "openfoodfacts" });
    assert.equal(counts.cosmos, 0);
    assert.equal(counts.upc, 0);
  } finally {
    restoreEnv();
  }
});

test("Cosmos é consultado quando o OFF não encontra", async () => {
  process.env.COSMOS_API_TOKEN = "test-secret";
  process.env.COSMOS_USER_AGENT = "test-agent";
  const counts = newCounts();
  try {
    const result = await call(makeFetch({ off: "empty" }, counts), "7891000100202", "Bearer t");
    assert.equal(result.status, 200);
    assert.deepEqual(result.payload, { name: "Arroz Marca 5 kg", source: "cosmos" });
    assert.equal(counts.upc, 0);
  } finally {
    restoreEnv();
  }
});

test("UPCitemdb é o último recurso e exige o mesmo código", async () => {
  const counts = newCounts();
  const found = await call(makeFetch({ off: "empty", upcCode: "7894900011517" }, counts), "7894900011517", "Bearer t");
  assert.equal(found.status, 200);
  assert.deepEqual(found.payload, { name: "Arroz Prato Fino 5 kg", source: "upcitemdb" });

  const mismatch = await call(makeFetch({ off: "empty", upcCode: "7894900011517" }, counts), "7891910000197", "Bearer t");
  assert.equal(mismatch.status, 404);
  assert.ok(JSON.stringify(mismatch.payload).includes("Produto não encontrado"));
});

test("Limite do Cosmos protege a chave e ainda tenta a base gratuita", async () => {
  process.env.COSMOS_API_TOKEN = "test-secret";
  process.env.COSMOS_USER_AGENT = "test-agent";
  const counts = newCounts();
  try {
    const limited = await call(makeFetch({ off: "empty", cosmosStatus: 429 }, counts), "7891910000197", "Bearer t");
    assert.equal(limited.status, 429);
    assert.ok(!JSON.stringify(limited.payload).includes("test-secret"));
    assert.equal(counts.cosmosHeaders[0], "test-secret");

    const fallback = await call(
      makeFetch({ off: "empty", cosmosStatus: 429, upcCode: "7891910000197" }, counts),
      "7891910000197",
      "Bearer t",
    );
    assert.equal(fallback.status, 200);
    assert.deepEqual(fallback.payload, { name: "Arroz Prato Fino 5 kg", source: "upcitemdb" });
  } finally {
    restoreEnv();
  }
});

test("cache evita nova consulta ao provedor", async () => {
  const counts = newCounts();
  const first = await call(makeFetch({ off: "found" }, counts), "036000291452", "Bearer t");
  assert.equal(first.status, 200);
  assert.deepEqual(first.payload, { name: "Arroz Tio Lautério", source: "openfoodfacts" });
  const second = await call(makeFetch({ off: "found" }, counts), "036000291452", "Bearer t");
  assert.equal(second.status, 200);
  assert.deepEqual(second.payload, first.payload);
  assert.equal(counts.off, 1);
});
