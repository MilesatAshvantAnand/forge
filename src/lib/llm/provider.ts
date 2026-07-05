import OpenAI from "openai";

export interface ChatOptions {
  temperature?: number;
}

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

function resolveClient(): { client: OpenAI; chatModel: string; embedModel: string } {
  const provider = process.env.LLM_PROVIDER ?? "qwen";

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      chatModel: "gpt-4o-mini",
      embedModel: "text-embedding-3-small",
    };
  }

  return {
    client: new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY ?? "missing-key",
      baseURL:
        process.env.DASHSCOPE_BASE_URL ??
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    }),
    chatModel: process.env.QWEN_CHAT_MODEL ?? "qwen-plus",
    embedModel: process.env.QWEN_EMBED_MODEL ?? "text-embedding-v3",
  };
}

export async function* streamChat(
  messages: LlmMessage[],
  options: ChatOptions = {}
): AsyncIterable<string> {
  const { client, chatModel } = resolveClient();
  const stream = await client.chat.completions.create({
    model: chatModel,
    messages,
    stream: true,
    temperature: options.temperature ?? 0.3,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export async function chatCompletion(
  messages: LlmMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const { client, chatModel } = resolveClient();
  const res = await client.chat.completions.create({
    model: chatModel,
    messages,
    temperature: options.temperature ?? 0.3,
  });
  return res.choices[0]?.message?.content ?? "";
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { client, embedModel } = resolveClient();
  // DashScope caps embedding batches at 10 inputs per request
  const batchSize = 10;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await client.embeddings.create({
      model: embedModel,
      input: batch,
      encoding_format: "float",
    });
    for (const item of res.data) results.push(item.embedding);
  }
  return results;
}

export function hasLlmConfigured(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY);
}
