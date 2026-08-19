import type { AIProvider } from "./AIProvider.js";
import { openrouterProvider } from "./openrouter/OpenRouterProvider.js";

let currentProvider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (!currentProvider) {
    currentProvider = openrouterProvider;
  }
  return currentProvider;
}

export function setProvider(provider: AIProvider): void {
  currentProvider = provider;
}
