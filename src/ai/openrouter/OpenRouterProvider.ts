import { env } from "../../config/index.js";
import { chatLimiter } from "../rate-limiters.js";
import type { AIProvider, ChatParams, ChatResponse } from "../AIProvider.js";

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      if (attempt === retries) throw err;
      if (status === 429 || (status >= 500 && status < 600)) {
        const retryAfterMs = Number(err?.headers?.get?.("retry-after")) * 1000;
        const delay =
          Number.isFinite(retryAfterMs) && retryAfterMs > 0
            ? Math.min(retryAfterMs, 8000)
            : Math.min(2000 * 2 ** attempt, 8000);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("withRetry exhausted");
}

function buildBody(params: ChatParams, stream: boolean): Record<string, unknown> {
  const { systemPrompt, messages, model, maxTokens, temperature } = params;
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: maxTokens,
    temperature,
    stream,
  };
  const fallbacks = env.fallbackModels.filter((m) => m !== model);
  if (fallbacks.length > 0) {
    body.models = [model, ...fallbacks];
  }
  return body;
}

async function readStream(res: Response, onDelta: (delta: string) => void): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        // Ignore malformed keep-alive/comment frames.
      }
    }
  }

  return full;
}

export const openrouterProvider: AIProvider = {
  async generateChat(params: ChatParams): Promise<ChatResponse> {
    const streaming = typeof params.onDelta === "function";

    const completion: any = await chatLimiter.schedule(() =>
      withRetry(async () => {
        const res = await fetch(BASE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.apiKey}`,
            "HTTP-Referer": "https://github.com/Zikaishere/aegis-combot",
            "X-Title": "Aegis",
          },
          body: JSON.stringify(buildBody(params, streaming)),
        });

        if (!res.ok) {
          const body = await res.text();
          const error: any = new Error(`OpenRouter API error: ${res.status}`);
          error.status = res.status;
          error.body = body;
          throw error;
        }

        if (streaming) {
          return { streamed: true, content: await readStream(res, params.onDelta!) };
        }

        return res.json();
      }),
    );

    if (completion.streamed) {
      const content = completion.content.trim() || "idk man";
      return { content, model: params.model };
    }

    const content = completion.choices?.[0]?.message?.content?.trim() || "idk man";
    return { content, model: completion.model || params.model };
  },
};
