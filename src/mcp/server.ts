import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Gateway } from "../gateway/port.js";

export function createMcpServer(gateway: Gateway): McpServer {
  const server = new McpServer({ name: "smartstock", version: "0.1.0" });
  const sku = z.string().refine((value) => value.trim().length > 0, "SKU required");

  const tools = [
    { name: "get_stock", description: "Get current stock and threshold.", call: (id: string) => gateway.getStock(id) },
    { name: "get_sales_history", description: "Get recent sales history.", call: (id: string) => gateway.getSalesHistory(id) },
    { name: "get_replenishment_need", description: "Get the replenishment need.", call: (id: string) => gateway.getNeed(id) },
    { name: "list_supplier_offers", description: "List supplier offers with price, lead time and minimum quantity.", call: (id: string) => gateway.listOffers(id) },
  ];

  for (const tool of tools) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: { sku },
    }, async ({ sku: requestedSku }) => {
      try {
        const data = await tool.call(requestedSku);
        if (data === undefined || data === null) {
          throw new Error("DATA_UNAVAILABLE");
        }
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch {
        return {
          isError: true,
          content: [{ type: "text", text: "GATEWAY_DATA_UNAVAILABLE" }],
        };
      }
    });
  }

  server.registerTool("request_purchase_draft", {
    description: "Request a purchase draft. Disabled until the Gateway and Purchases contract is agreed.",
    inputSchema: {
      sku,
      supplierId: z.string().min(1),
      quantity: z.number().int().positive(),
      idempotencyKey: z.string().min(1),
    },
  }, async () => ({
    isError: true,
    content: [{ type: "text", text: "DRAFT_REQUEST_DISABLED" }],
  }));

  return server;
}
