import type { PersonalityLayer } from "../types/personality.js";

const SYSTEM_TOKEN_BUDGET = 1500;
const USER_PROFILE_TOKEN_CAP = 400;

const GUARANTEED_LAYERS = new Set(["core-identity", "behavior-rules"]);

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function buildSystemPrompt(layers: PersonalityLayer[]): string {
  const sorted = [...layers].sort((a, b) => b.priority - a.priority);

  let guaranteed = "";
  let remaining: PersonalityLayer[] = [];

  for (const layer of sorted) {
    if (GUARANTEED_LAYERS.has(layer.name)) {
      if (guaranteed) guaranteed += "\n\n";
      guaranteed += layer.content;
    } else {
      remaining.push(layer);
    }
  }

  let included: string[] = [];
  let budget = estimateTokens(guaranteed);

  for (const layer of remaining) {
    if (layer.tokens <= 0) continue;

    const isProfileLayer =
      layer.name.toLowerCase().includes("profile") ||
      layer.name.toLowerCase().includes("fact");

    if (isProfileLayer) {
      const textTokens = estimateTokens(layer.content);
      if (textTokens > USER_PROFILE_TOKEN_CAP) {
        const truncated = layer.content
          .split("\n")
          .slice(0, Math.ceil(USER_PROFILE_TOKEN_CAP / 4))
          .join("\n");
        if (budget + USER_PROFILE_TOKEN_CAP <= SYSTEM_TOKEN_BUDGET) {
          included.push(truncated);
          budget += USER_PROFILE_TOKEN_CAP;
        }
        continue;
      }
    }

    if (budget + layer.tokens <= SYSTEM_TOKEN_BUDGET) {
      included.push(layer.content);
      budget += layer.tokens;
    }
  }

  if (guaranteed && included.length > 0) {
    return guaranteed + "\n\n" + included.join("\n\n");
  }

  return guaranteed || included.join("\n\n");
}

export function buildMessages(
  systemPrompt: string,
  history: { role: string; content: string }[],
  userMessage: string,
): { role: string; content: string }[] {
  return [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];
}
