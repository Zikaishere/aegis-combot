import type { PersonalityLayer } from "../../types/personality.js";

export function getMemoryLayer(
  memories: string[] | undefined,
): PersonalityLayer | null {
  if (!memories || memories.length === 0) return null;

  const content = `Things I remember about this server:\n- ${memories.join("\n- ")}`;
  return {
    name: "guild-memories",
    priority: 35,
    tokens: Math.ceil(content.length / 4),
    content,
  };
}
