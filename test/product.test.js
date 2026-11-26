import assert from "node:assert/strict";
import test from "node:test";
import { getProduct, ProductQueryError, PRODUCT_QUERY } from "../src/gateway/product.ts";

function expectError(code) {
  return (error) => error instanceof ProductQueryError && error.code === code;
}

test("consults the contracted product fields without normalizing the SKU", async () => {
  const product = { sku: " SKU-1 ", name: "Item", stock: 3, threshold: 5 };
  const execute = async (query, variables) => {
    assert.equal(query, PRODUCT_QUERY);
    assert.deepEqual(variables, { sku: product.sku });
    return { data: { product } };
  };

  assert.deepEqual(await getProduct(execute, product.sku), product);
});

test("distinguishes missing product from errors", async () => {
  assert.equal(await getProduct(async () => ({ data: { product: null } }), "sku"), null);
  await assert.rejects(
    getProduct(async () => ({
      data: { product: null },
      errors: [{ extensions: { code: "UPSTREAM_UNAVAILABLE" } }],
    }), "sku"),
    expectError("UPSTREAM_UNAVAILABLE"),
  );
});

test("rejects invalid SKU before calling the Gateway", async () => {
  await assert.rejects(
    getProduct(async () => assert.fail("unexpected Gateway call"), "  "),
    expectError("INVALID_ARGUMENT"),
  );
});

test("preserves contracted GraphQL error codes and handles transport failure", async () => {
  await assert.rejects(
    getProduct(async () => ({ errors: [{ extensions: { code: "INVALID_ARGUMENT" } }] }), "sku"),
    expectError("INVALID_ARGUMENT"),
  );
  await assert.rejects(
    getProduct(async () => { throw new Error("transport detail"); }, "sku"),
    expectError("UPSTREAM_UNAVAILABLE"),
  );
});

test("does not trust partial or malformed responses", async () => {
  const cases = [
    {},
    { errors: [] },
    { data: { product: { sku: "other", name: "Item", stock: 1, threshold: 2 } } },
    { data: { product: { sku: "sku", name: "Item", stock: -1, threshold: 2 } } },
    { data: { product: { sku: "sku", name: "Item", stock: 2147483648, threshold: 2 } } },
    { data: { product: { sku: "sku", name: "Item", stock: 1.5, threshold: 2 } } },
  ];

  for (const response of cases) {
    await assert.rejects(getProduct(async () => response, "sku"), expectError("INVALID_RESPONSE"));
  }

  await assert.rejects(
    getProduct(async () => ({
      data: { product: { sku: "sku", name: "Item", stock: 1, threshold: 2 } },
      errors: [{ message: "partial response" }],
    }), "sku"),
    expectError("GRAPHQL_ERROR"),
  );
});
