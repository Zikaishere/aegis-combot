import { env } from "../../config/index.js";
import { chatLimiter } from "../rate-limiters.js";
import type { AIProvider, ChatParams, ChatResponse } from "../AIProvider.js";

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      if (attempt === retries) throw err;
      if (status === 429 || (status >= 500 && status < 600)) {
        const delay = Math.min(2000 * (attempt + 1), 10000);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("withRetry exhausted");
}

export const openrouterProvider: AIProvider = {
  async generateChat(params: ChatParams): Promise<ChatResponse> {
    const { systemPrompt, messages, model, maxTokens, temperature } = params;
    const payload = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const completion = await chatLimiter.schedule(() =>
      withRetry(async () => {
        const res = await fetch(BASE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.apiKey}`,
            "HTTP-Referer": "https://github.com/Zikaishere/aegis-combot",
            "X-Title": "Aegis",
          },
          body: JSON.stringify({
            model,
            messages: payload,
            max_tokens: maxTokens,
            temperature,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          const error: any = new Error(`OpenRouter API error: ${res.status}`);
          error.status = res.status;
          error.body = body;
          throw error;
        }

        return res.json() as Promise<any>;
      }),
    );

    const content = completion.choices?.[0]?.message?.content?.trim() || "idk man";
    return { content, model: completion.model || model };
  },
};
