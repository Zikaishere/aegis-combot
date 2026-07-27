import type { BaseAbility } from "./BaseAbility.js";

const registry: BaseAbility[] = [];

export function register(ability: BaseAbility): void {
  registry.push(ability);
}

export async function tryAbilities(
  input: string,
  guildId: string | null,
): Promise<string | null> {
  for (const ability of registry) {
    if (!ability.canHandle(input)) continue;
    const result = await ability.execute(input, guildId);
    if (result !== null) return result;
  }
  return null;
}

export function getRegisteredAbilities(): BaseAbility[] {
  return [...registry];
}
