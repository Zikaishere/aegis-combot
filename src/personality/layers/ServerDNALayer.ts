import type { PersonalityLayer } from "../../types/personality.js";
import type { DnaTrait } from "../../types/personality.js";
import { getTemplate, applyTemplate } from "../templates.js";
import { dnaEngine } from "../../dna/DNAEngine.js";

const MIN_CONFIDENCE = 50;

export interface DnaInput {
  traits: DnaTrait;
  confidence: number;
  topSlang?: string[];
}

export function getServerDNALayer(
  dna: DnaInput | null,
): PersonalityLayer | null {
  if (!dna || dna.confidence < MIN_CONFIDENCE) return null;

  const doc = { traits: dna.traits as any, topSlang: dna.topSlang };
  const vibe = dnaEngine.getVibeSummary(doc);
  const fallback = vibe || "neutral";
  const template = getTemplate("server-dna");

  const content = template
    ? applyTemplate(template, { VIBE_SUMMARY: fallback })
    : `This server's vibe: ${fallback}`;

  return {
    name: "server-dna",
    priority: 60,
    tokens: Math.ceil(content.length / 4),
    content,
  };
}

export { MIN_CONFIDENCE };
