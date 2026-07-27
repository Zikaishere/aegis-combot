import type { PersonalityLayer } from "../types/personality.js";
import type { DnaTrait } from "../types/personality.js";
import { getCoreIdentityLayer } from "./layers/CoreIdentity.js";
import { getSpeechStyleLayer } from "./layers/SpeechStyle.js";
import { getBehaviorRulesLayer } from "./layers/BehaviorRules.js";
import { getServerDNALayer } from "./layers/ServerDNALayer.js";
import { getUserProfileLayer } from "./layers/UserProfileLayer.js";
import { getAbilitiesLayer } from "./layers/AbilitiesLayer.js";
import { getRecentContextLayer } from "./layers/RecentContextLayer.js";
import { getMemoryLayer } from "./layers/MemoryLayer.js";
import { loadTemplates, getLoadedCount } from "./templates.js";
import { buildSystemPrompt } from "../ai/PromptBuilder.js";

export interface PersonalityInput {
  userName: string;
  style?: string;
  additions: string[];
  guildAdditions: string[];
  guildMemories?: string[];
  dna: { traits: DnaTrait; confidence: number; topSlang?: string[] } | null;
  userProfile?: string;
  facts?: string[];
  interests?: string[];
  customFacts?: string[];
  memoryEnabled: boolean;
  abilityNames: string[];
}

export class PersonalityEngine {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await loadTemplates();
    this.initialized = true;
    console.log(`PersonalityEngine ready (${getLoadedCount()} templates)`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  assemble(input: PersonalityInput): PersonalityLayer[] {
    const layers: PersonalityLayer[] = [];

    const core = getCoreIdentityLayer();
    if (core) layers.push(core);

    const rules = getBehaviorRulesLayer();
    if (rules) layers.push(rules);

    const style = getSpeechStyleLayer(input.style);
    if (style) layers.push(style);

    const dna = getServerDNALayer(input.dna);
    if (dna) layers.push(dna);

    const abilities = getAbilitiesLayer(input.abilityNames);
    if (abilities) layers.push(abilities);

    const profile = getUserProfileLayer({
      userName: input.userName,
      userProfile: input.userProfile,
      facts: input.facts,
      interests: input.interests,
      customFacts: input.customFacts,
      memoryEnabled: input.memoryEnabled,
    });
    if (profile) layers.push(profile);

    const context = getRecentContextLayer(input.additions, input.guildAdditions);
    if (context) layers.push(context);

    const memories = getMemoryLayer(input.guildMemories);
    if (memories) layers.push(memories);

    return layers;
  }

  build(input: PersonalityInput): string {
    const layers = this.assemble(input);
    return buildSystemPrompt(layers);
  }
}

export const engine = new PersonalityEngine();
