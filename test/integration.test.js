import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../dist/app.js";

const token = "test-only-token-12345678901234567890";
const sku = "SKU-1";
const offers = [
  { supplierId: "A", price: 10, currency: "USD", leadTimeDays: 2, minimumQuantity: 5 },
  { supplierId: "B", price: 9, currency: "USD", leadTimeDays: 4, minimumQuantity: 10 },
];

function gateway(overrides = {}) {
  return {
    async getStock() { return { stock: 2, threshold: 5 }; },
    async getSalesHistory() { return [{ quantity: 3 }]; },
    async getNeed() { return { quantity: 10 }; },
    async listOffers() { return offers; },
    ...overrides,
  };
}

function model() {
  let calls = 0;
  return {
    async respond(_messages, tools) {
      calls++;
      assert.ok(tools.some((tool) => tool.function.name === "get_stock"));
      if (calls === 1) {
        return {
          text: null,
          calls: ["get_stock", "get_sales_history", "get_replenishment_need", "list_supplier_offers"].map((name) => ({
            id: name, name, arguments: JSON.stringify({ sku }),
          })),
        };
      }
      return { text: "B costs 9 USD, takes 4 days and requires 10; A costs 10 USD, takes 2 days and requires 5.", calls: [] };
    },
  };
}

async function start(t, overrides = {}) {
  let port;
  const app = createApp({
    token,
    gateway: gateway(),
    model: model(),
    mcpUrl: () => new URL(`http://127.0.0.1:${port}/mcp`),
    ...overrides,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  port = server.address().port;
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  return `http://127.0.0.1:${port}`;
}

async function runAnalysis(base) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const startResponse = await fetch(`${base}/analyses`, {
    method: "POST", headers, body: JSON.stringify({ sku }),
  });
  assert.equal(startResponse.status, 202);
  const started = await startResponse.json();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/analyses/${started.id}`, { headers });
    const run = await response.json();
    if (run.status !== "PENDING") return run;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("analysis did not finish");
}

test("analysis invokes tools through real Streamable HTTP and records simulated data", async (t) => {
  const base = await start(t);
  assert.equal((await fetch(`${base}/analyses/not-found`)).status, 401);
  const run = await runAnalysis(base);
  assert.equal(run.status, "COMPLETED");
  assert.equal(run.evidence.length, 4);
  assert.deepEqual(run.evidence.find((item) => item.name === "list_supplier_offers").result, offers);
  assert.match(run.recommendation, /9 USD/);
});

test("partial Gateway data fails without fabricating offers", async (t) => {
  const base = await start(t, { gateway: gateway({ async listOffers() { return [offers[0]]; } }) });
  const run = await runAnalysis(base);
  assert.equal(run.status, "FAILED");
  assert.equal(run.error, "INSUFFICIENT_OFFERS");
  assert.equal(run.evidence.length, 4);
});

test("offers missing comparison fields cannot complete an analysis", async (t) => {
  const incompleteOffers = [offers[0], { supplierId: "B", price: 9 }];
  const base = await start(t, {
    gateway: gateway({ async listOffers() { return incompleteOffers; } }),
  });
  const run = await runAnalysis(base);
  assert.equal(run.status, "FAILED");
  assert.equal(run.error, "INSUFFICIENT_OFFERS");
});

test("a model response without tool calls cannot complete an analysis", async (t) => {
  const base = await start(t, {
    model: { async respond() { return { text: "Invented recommendation", calls: [] }; } },
  });
  const run = await runAnalysis(base);
  assert.equal(run.status, "FAILED");
  assert.equal(run.error, "INCOMPLETE_ANALYSIS");
  assert.deepEqual(run.evidence, []);
});

test("unavailable Gateway data is exposed as an error", async (t) => {
  const base = await start(t, { gateway: gateway({ async getStock() { throw new Error("private details"); } }) });
  const run = await runAnalysis(base);
  assert.equal(run.status, "FAILED");
  assert.equal(run.error, "INCOMPLETE_ANALYSIS");
  assert.equal(run.evidence[0].result, "GATEWAY_DATA_UNAVAILABLE");
});

test("model failure is reported without leaking provider details", async (t) => {
  const base = await start(t, { model: { async respond() { throw new Error("secret detail"); } } });
  const run = await runAnalysis(base);
  assert.equal(run.status, "FAILED");
  assert.equal(run.error, "MODEL_UNAVAILABLE");
});

test("MCP draft tool is disabled regardless of input", async (t) => {
  const base = await start(t);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  }));
  t.after(() => client.close());
  const result = await client.callTool({
    name: "request_purchase_draft",
    arguments: { sku, supplierId: "A", quantity: 5, idempotencyKey: "draft-1" },
  });
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, "DRAFT_REQUEST_DISABLED");
  const retry = await client.callTool({
    name: "request_purchase_draft",
    arguments: { sku, supplierId: "A", quantity: 5, idempotencyKey: "draft-1" },
  });
  assert.equal(retry.isError, true);
  assert.equal(retry.content[0].text, "DRAFT_REQUEST_DISABLED");
});
