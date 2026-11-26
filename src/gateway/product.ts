export const PRODUCT_QUERY = `
  query Product($sku: String!) {
    product(sku: $sku) {
      sku
      name
      stock
      threshold
    }
  }
`;

type Product = {
  sku: string;
  name: string;
  stock: number;
  threshold: number;
};

type GraphQLResponse = {
  data?: unknown;
  errors?: unknown;
};

export type GraphQLExecutor = (
  query: string,
  variables: { sku: string },
) => Promise<GraphQLResponse>;

export class ProductQueryError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Product query failed: ${code}`);
    this.name = "ProductQueryError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStockValue(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 2147483647;
}

export async function getProduct(
  execute: GraphQLExecutor,
  sku: string,
): Promise<Product | null> {
  if (typeof sku !== "string" || sku.trim().length === 0) {
    throw new ProductQueryError("INVALID_ARGUMENT");
  }

  let response: GraphQLResponse;
  try {
    response = await execute(PRODUCT_QUERY, { sku });
  } catch {
    throw new ProductQueryError("UPSTREAM_UNAVAILABLE");
  }

  if (!isRecord(response)) {
    throw new ProductQueryError("INVALID_RESPONSE");
  }

  if (response.errors !== undefined) {
    if (!Array.isArray(response.errors) || response.errors.length === 0) {
      throw new ProductQueryError("INVALID_RESPONSE");
    }

    const firstError = response.errors[0];
    const extensions = isRecord(firstError) ? firstError.extensions : undefined;
    const code = isRecord(extensions) ? extensions.code : undefined;
    if (response.errors.length === 1 && (code === "INVALID_ARGUMENT" || code === "UPSTREAM_UNAVAILABLE")) {
      throw new ProductQueryError(code);
    }
    throw new ProductQueryError("GRAPHQL_ERROR");
  }

  if (!isRecord(response.data) || !("product" in response.data)) {
    throw new ProductQueryError("INVALID_RESPONSE");
  }

  const product = response.data.product;
  if (product === null) {
    return null;
  }

  if (
    !isRecord(product) ||
    product.sku !== sku ||
    typeof product.name !== "string" ||
    !isStockValue(product.stock) ||
    !isStockValue(product.threshold)
  ) {
    throw new ProductQueryError("INVALID_RESPONSE");
  }

  return {
    sku,
    name: product.name,
    stock: product.stock,
    threshold: product.threshold,
  };
}
