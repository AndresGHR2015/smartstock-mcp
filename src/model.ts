import OpenAI from "openai";
import type { Model, ModelReply } from "./orchestrator.js";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export class OpenAIModel implements Model {
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 0 });
  }

  async respond(messages: ChatCompletionMessageParam[], tools: ChatCompletionTool[]): Promise<ModelReply> {
    const result = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
    });
    const message = result.choices[0]?.message;
    if (!message) throw new Error("MODEL_EMPTY_RESPONSE");
    return {
      text: message.content,
      calls: (message.tool_calls ?? []).filter((call) => call.type === "function").map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      })),
    };
  }
}
