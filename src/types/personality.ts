export interface PersonalityLayer {
  name: string;
  priority: number;
  tokens: number;
  content: string;
}

export type DnaTrait = {
  formality: number;
  humorLevel: number;
  emojiFrequency: number;
  responseLength: number;
  pacing: number;
  slangUsage: number;
  punctuationStyle: number;
  toxicity: number;
};

export interface ServerDnaData {
  guildId: string;
  traits: DnaTrait;
  confidence: number;
}
