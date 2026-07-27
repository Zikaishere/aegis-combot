import Groq from "groq-sdk";
import { env } from "../../config/index.js";
import { chatLimiter } from "./rate-limiters.js";
import type { AIProvider, ChatParams, ChatResponse } from "../AIProvider.js";

const groq = new Groq({ apiKey: env.groqApiKey });

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error.status === 429;
      const isServerError = error.status >= 500 && error.status < 600;
      if (!isRateLimit && !isServerError) throw error;
      if (attempt < retries) {
        const delay = isRateLimit ? 5000 * attempt : 2000 * attempt;
        console.error(`Groq API error (attempt ${attempt}/${retries}), retrying in ${delay}ms:`, error.message);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("withRetry: exceeded retries");
}

export const groqProvider: AIProvider = {
  async generateChat(params: ChatParams): Promise<ChatResponse> {
    const { systemPrompt, messages, model, maxTokens, temperature } = params;

    const payload = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const completion = await chatLimiter.schedule(() =>
      withRetry(() =>
        groq.chat.completions.create({
          model,
          messages: payload,
          max_tokens: maxTokens,
          temperature,
        }),
      ),
    );

    const content = completion.choices[0]?.message?.content?.trim() || "idk man";

    return {
      content,
      model: completion.model || model,
    };
  },
};
