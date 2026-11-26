import { randomUUID, timingSafeEqual } from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Gateway } from "./gateway/port.js";
import { createMcpServer } from "./mcp/server.js";
import { analyze, AnalysisError, type Model, type ToolEvidence } from "./orchestrator.js";

type Run = {
  id: string;
  sku: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  evidence: ToolEvidence[];
  recommendation?: string;
  error?: string;
};

export function createApp(options: {
  token: string;
  gateway: Gateway;
  model: Model;
  mcpUrl: () => URL;
}) {
  if (options.token.length < 32) throw new Error("INTERNAL_TOKEN must be at least 32 characters");
  const app = express();
  const runs = new Map<string, Run>();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    const actual = Buffer.from(req.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${options.token}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    next();
  });

  app.post("/mcp", async (req, res) => {
    const server = createMcpServer(options.gateway);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({ error: "MCP_ERROR" });
    }
  });

  app.post("/analyses", (req, res) => {
    const sku: unknown = req.body?.sku;
    if (typeof sku !== "string" || sku.trim().length === 0) {
      res.status(400).json({ error: "INVALID_SKU" });
      return;
    }
    if (runs.size >= 100) {
      res.status(503).json({ error: "RUN_CAPACITY_REACHED" });
      return;
    }
    const run: Run = { id: randomUUID(), sku, status: "PENDING", evidence: [] };
    runs.set(run.id, run);
    res.status(202).json({ id: run.id, status: run.status });
    void analyze(sku, options.model, options.mcpUrl(), options.token).then((result) => {
      Object.assign(run, result, { status: "COMPLETED" });
    }).catch((error: unknown) => {
      run.status = "FAILED";
      run.error = "ANALYSIS_FAILED";
      if (error instanceof AnalysisError) {
        const safeErrors = [
          "INCOMPLETE_ANALYSIS",
          "INSUFFICIENT_OFFERS",
          "MODEL_STEP_LIMIT",
          "MODEL_UNAVAILABLE",
          "INVALID_MODEL_TOOL_ARGUMENTS",
        ];
        if (safeErrors.includes(error.message)) run.error = error.message;
        run.evidence = error.evidence;
      }
    });
  });

  app.get("/analyses/:id", (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(run);
  });

  return app;
}
