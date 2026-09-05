import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/barcode";

test("API exige login, protege a chave e trata limite de consultas", async () => {
  const originalFetch = global.fetch;
  const oldKey = process.env.FIREBASE_WEB_API_KEY;
  const oldToken = process.env.COSMOS_API_TOKEN;
  const oldAgent = process.env.COSMOS_USER_AGENT;
  process.env.FIREBASE_WEB_API_KEY = "test-firebase";
  process.env.COSMOS_API_TOKEN = "test-secret";
  process.env.COSMOS_USER_AGENT = "test-agent";
  let upstreamCalls = 0;
  let status = 200;
  let payload: unknown;
  const response = {
    setHeader() {}, end() {},
    status(code: number) { status = code; return this; },
    json(value: unknown) { payload = value; },
  } as unknown as Parameters<typeof handler>[1];
  const request = (authorization?: string) => ({ method: "POST", headers: { authorization }, body: { barcode: "7896559100215" } }) as Parameters<typeof handler>[0];
  try {
    global.fetch = async (input, options) => {
      if (String(input).includes("identitytoolkit")) return Response.json({ users: [{ localId: "test-user" }] });
      if (String(input).includes("upcitemdb")) return Response.json({ items: [] });
      upstreamCalls++;
      assert.equal(new Headers(options?.headers).get("X-Cosmos-Token"), "test-secret");
      return Response.json({}, { status: 429 });
    };
    await handler(request(), response);
    assert.equal(status, 401);
    assert.equal(upstreamCalls, 0);
    await handler(request("Bearer test-id-token"), response);
    assert.equal(status, 429);
    assert.equal(upstreamCalls, 1);
    assert.ok(!JSON.stringify(payload).includes("test-secret"));
    global.fetch = async (input) => String(input).includes("identitytoolkit")
      ? Response.json({ users: [{ localId: "test-user" }] })
      : String(input).includes("upcitemdb") ? Response.json({ items: [] })
      : Response.json({ description: "Arroz", brand: { name: "Tio Lautério" }, net_weight: 5000 });
    await handler(request("Bearer test-id-token"), response);
    assert.equal(status, 200);
    assert.deepEqual(payload, { name: "Arroz Tio Lautério 5 kg", source: "cosmos" });
    delete process.env.COSMOS_API_TOKEN;
    delete process.env.COSMOS_USER_AGENT;
    global.fetch = async (input) => String(input).includes("identitytoolkit")
      ? Response.json({ users: [{ localId: "test-user" }] })
      : Response.json({ items: [{ ean: "7891910000197", title: "Açúcar", brand: "União", size: "1 kg" }] });
    const upcRequest = request("Bearer test-id-token");
    upcRequest.body = { barcode: "7891910000197" };
    await handler(upcRequest, response);
    assert.equal(status, 200);
    assert.deepEqual(payload, { name: "Açúcar União 1 kg", source: "upcitemdb" });
    global.fetch = async (input) => {
      assert.ok(String(input).includes("identitytoolkit"), "não repete consulta de produto em cache");
      return Response.json({ users: [{ localId: "test-user" }] });
    };
    await handler(upcRequest, response);
    assert.equal(status, 200);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries({ FIREBASE_WEB_API_KEY: oldKey, COSMOS_API_TOKEN: oldToken, COSMOS_USER_AGENT: oldAgent })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
