import type { PersonalityLayer } from "../../types/personality.js";

export function getRecentContextLayer(
  additions: string[],
  guildAdditions: string[],
): PersonalityLayer | null {
  const parts: string[] = [];

  if (additions.length > 0) {
    parts.push(`Additional context:\n${additions.join("\n")}`);
  }

  if (guildAdditions.length > 0) {
    parts.push(`Server-specific context:\n${guildAdditions.join("\n")}`);
  }

  if (parts.length === 0) return null;

  const content = parts.join("\n\n");
  return {
    name: "recent-context",
    priority: 10,
    tokens: Math.ceil(content.length / 4),
    content,
  };
}
