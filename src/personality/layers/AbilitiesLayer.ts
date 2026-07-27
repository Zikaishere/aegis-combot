import type { PersonalityLayer } from "../../types/personality.js";

export function getAbilitiesLayer(abilityNames: string[]): PersonalityLayer | null {
  if (abilityNames.length === 0) return null;

  const content = `You can use: ${abilityNames.join(", ")}`;
  return {
    name: "abilities",
    priority: 50,
    tokens: Math.ceil(content.length / 4),
    content,
  };
}
