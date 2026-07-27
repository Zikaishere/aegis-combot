import type { Message } from "discord.js";
import { dnaEngine } from "./DNAEngine.js";
import { MIN_CONFIDENCE } from "./trait-definitions.js";

export function observe(message: Message): void {
  if (message.author.bot) return;
  if (!message.guildId) return;
  if (message.content.length === 0) return;

  dnaEngine.observeMessage({
    guildId: message.guildId,
    text: message.content,
    timestamp: Date.now(),
  }).catch(() => {});
}

export async function getDNA(guildId: string) {
  return dnaEngine.getDNA(guildId);
}

export async function resetDNA(guildId: string): Promise<void> {
  await dnaEngine.resetDNA(guildId);
}

export function buildVibeSummary(dna: any): string | null {
  return dnaEngine.getVibeSummary(dna);
}

export async function updateDNA(
  guildId: string,
  overrides: Record<string, number>,
): Promise<void> {
  await dnaEngine.updateDNA(guildId, overrides);
}

export { MIN_CONFIDENCE };
