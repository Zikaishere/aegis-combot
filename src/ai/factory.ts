import type { AIProvider } from "./AIProvider.js";
import { groqProvider } from "./groq/GroqProvider.js";

let currentProvider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (!currentProvider) {
    currentProvider = groqProvider;
  }
  return currentProvider;
}

export function setProvider(provider: AIProvider): void {
  currentProvider = provider;
}
