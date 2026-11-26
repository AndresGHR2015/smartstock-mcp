import { createApp } from "./app.js";
import { UnavailableGateway } from "./gateway/port.js";
import { OpenAIModel } from "./model.js";

const token = process.env.INTERNAL_TOKEN;
const apiKey = process.env.OPENAI_API_KEY;
const modelName = process.env.OPENAI_MODEL;
const port = Number(process.env.PORT ?? "3000");

if (!token || !apiKey || !modelName) {
  throw new Error("INTERNAL_TOKEN, OPENAI_API_KEY and OPENAI_MODEL are required");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const app = createApp({
  token,
  gateway: new UnavailableGateway(),
  model: new OpenAIModel(apiKey, modelName),
  mcpUrl: () => new URL(`http://127.0.0.1:${port}/mcp`),
});

app.listen(port, process.env.HOST ?? "127.0.0.1", () => {
  console.log(`SmartStock MCP listening on port ${port}`);
});
