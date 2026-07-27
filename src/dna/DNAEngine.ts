import ServerDNA from "../models/ServerDNA.js";
import type { IServerDNATraits } from "../models/ServerDNA.js";
import {
  DEFAULT_TRAITS,
  KNOWN_SLANG,
  TOXIC_PATTERNS,
  FORMAL_INDICATORS,
  CASUAL_INDICATORS,
  JOKE_PATTERNS,
  EMOJI_RANGE,
  CUSTOM_EMOJI,
  MAX_LEARNING_RATE,
  UPDATE_INTERVAL,
  MAX_COMMON_EMOJIS,
  MAX_TOP_SLANG,
  MAX_COMMON_TOPICS,
  RESPONSE_LENGTH_SHORT,
  RESPONSE_LENGTH_LONG,
  MIN_CONFIDENCE,
} from "./trait-definitions.js";

const WORD_SPLIT = /[^\w]+/g;
const URL_PATTERN = /https?:\/\/\S+/g;
const MENTION_PATTERN = /<@!?\d+>/g;
const CHANNEL_PATTERN = /<#\d+>/g;

function cleanText(text: string): string {
  return text
    .replace(URL_PATTERN, "")
    .replace(MENTION_PATTERN, "")
    .replace(CHANNEL_PATTERN, "")
    .trim();
}

function extractEmojis(text: string): string[] {
  const unicode = [...text.matchAll(EMOJI_RANGE)].map((m) => m[0]);
  const custom = [...text.matchAll(CUSTOM_EMOJI)].map((m) => m[0]);
  return [...unicode, ...custom];
}

function extractSlang(words: string[]): string[] {
  return words.filter((w) => KNOWN_SLANG.has(w.toLowerCase()));
}

function hasFormalIndicators(text: string): number {
  let count = 0;
  for (const p of FORMAL_INDICATORS) {
    const matches = text.match(p);
    if (matches) count += matches.length;
  }
  return count;
}

function hasCasualIndicators(text: string): number {
  let count = 0;
  for (const p of CASUAL_INDICATORS) {
    const matches = text.match(p);
    if (matches) count += matches.length;
  }
  return count;
}

function hasJokeIndicators(text: string): number {
  let count = 0;
  for (const p of JOKE_PATTERNS) {
    const matches = text.match(p);
    if (matches) count += matches.length;
  }
  return count;
}

function isToxic(text: string): boolean {
  return TOXIC_PATTERNS.some((p) => p.test(text));
}

function getPunctuationScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(Boolean).length;
  if (sentences === 0) return 0.5;
  const properEndings = (text.match(/[.!?]/g) || []).length;
  return Math.min(properEndings / sentences, 1);
}

type FrequencyMap = Map<string, number>;

function updateFrequencyMap(
  map: FrequencyMap,
  items: string[],
  maxSize: number,
): FrequencyMap {
  const updated = new Map(map);
  for (const item of items) {
    updated.set(item, (updated.get(item) || 0) + 1);
  }

  if (updated.size > maxSize) {
    const sorted = [...updated.entries()].sort((a, b) => b[1] - a[1]);
    updated.clear();
    for (const [key, val] of sorted.slice(0, maxSize)) {
      updated.set(key, val);
    }
  }

  return updated;
}

interface Observation {
  guildId: string;
  text: string;
  timestamp: number;
}

class DNAEngine {
  private emojiFreq = new Map<string, FrequencyMap>();
  private slangFreq = new Map<string, FrequencyMap>();
  private topicFreq = new Map<string, FrequencyMap>();
  private lastMessageTime = new Map<string, number>();
  private pacingBuffer = new Map<string, number[]>();

  async observeMessage(input: Observation): Promise<void> {
    const { guildId, text, timestamp } = input;
    const cleaned = cleanText(text);
    if (cleaned.length === 0) return;

    const words = cleaned.split(WORD_SPLIT).filter(Boolean);
    const wordCount = words.length;
    if (wordCount === 0) return;

    let doc = await ServerDNA.findOne({ guildId });
    if (!doc) {
      doc = new ServerDNA({
        guildId,
        traits: { ...DEFAULT_TRAITS },
        commonEmojis: [],
        commonTopics: [],
        topSlang: [],
        messageCount: 0,
        isReady: false,
        updatedAt: new Date(),
      });
    }

    const traits = doc.traits as IServerDNATraits;
    const messageCount = (doc.messageCount || 0) + 1;
    doc.messageCount = messageCount;

    const lr = 1 / Math.min(messageCount, MAX_LEARNING_RATE);

    const emojis = extractEmojis(cleaned);
    const emojiCount = emojis.length;
    const obsEmojiFreq = wordCount > 0 ? Math.min(emojiCount / wordCount, 1) : 0;
    traits.emojiFrequency = traits.emojiFrequency * (1 - lr) + obsEmojiFreq * lr;

    const charCount = cleaned.length;
    const normLength = Math.min(Math.max((charCount - RESPONSE_LENGTH_SHORT) / (RESPONSE_LENGTH_LONG - RESPONSE_LENGTH_SHORT), 0), 1);
    traits.responseLength = traits.responseLength * (1 - lr) + normLength * lr;

    const slangWords = extractSlang(words);
    const slangRatio = wordCount > 0 ? slangWords.length / wordCount : 0;
    traits.slangUsage = traits.slangUsage * (1 - lr) + slangRatio * lr;

    const formalScore = hasFormalIndicators(cleaned);
    const casualScore = hasCasualIndicators(cleaned);
    const total = formalScore + casualScore;
    const obsFormality = total > 0 ? formalScore / total : 0.5;
    traits.formality = traits.formality * (1 - lr) + obsFormality * lr;

    const jokeScore = Math.min(hasJokeIndicators(cleaned) / Math.max(wordCount, 1), 1);
    traits.humorLevel = traits.humorLevel * (1 - lr) + jokeScore * lr;

    const punctScore = getPunctuationScore(cleaned);
    traits.punctuationStyle = traits.punctuationStyle * (1 - lr) + punctScore * lr;

    if (isToxic(cleaned)) {
      traits.toxicity = Math.min(traits.toxicity + 0.1 * lr, 1);
    } else {
      traits.toxicity = traits.toxicity * (1 - lr);
    }

    const prevTime = this.lastMessageTime.get(guildId);
    if (prevTime) {
      const gap = (timestamp - prevTime) / 1000;
      if (gap > 0 && gap < 3600) {
        const msgsPerMin = 60 / gap;
        const normPace = Math.min(msgsPerMin / 30, 1);
        traits.pacing = traits.pacing * (1 - lr) + normPace * lr;
      }
    }
    this.lastMessageTime.set(guildId, timestamp);

    const emojiMap = this.emojiFreq.get(guildId) || new Map();
    for (const e of emojis) {
      emojiMap.set(e, (emojiMap.get(e) || 0) + 1);
    }
    this.emojiFreq.set(guildId, emojiMap);

    const slangMap = this.slangFreq.get(guildId) || new Map();
    for (const s of slangWords) {
      slangMap.set(s, (slangMap.get(s) || 0) + 1);
    }
    this.slangFreq.set(guildId, slangMap);

    const contentWords = cleaned
      .toLowerCase()
      .split(WORD_SPLIT)
      .filter((w) => w.length > 3 && !KNOWN_SLANG.has(w) && !/^\d+$/.test(w));

    const topicMap = this.topicFreq.get(guildId) || new Map();
    const stopWords = new Set([
      "this", "that", "with", "from", "have", "been", "were", "they",
      "what", "when", "where", "which", "their", "there", "about",
      "would", "could", "should", "than", "then", "just", "like",
      "also", "some", "them", "your", "said", "does", "doing",
    ]);
    for (const w of contentWords) {
      if (w.length > 3 && !stopWords.has(w)) {
        topicMap.set(w, (topicMap.get(w) || 0) + 1);
      }
    }
    this.topicFreq.set(guildId, topicMap);

    doc.updatedAt = new Date();
    doc.isReady = messageCount >= MIN_CONFIDENCE;

    if (messageCount % UPDATE_INTERVAL === 0) {
      const sortedEmojis = [...emojiMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_COMMON_EMOJIS)
        .map(([e]) => e);
      doc.commonEmojis = sortedEmojis;

      const sortedSlang = [...slangMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_TOP_SLANG)
        .map(([s]) => s);
      doc.topSlang = sortedSlang;

      const sortedTopics = [...topicMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_COMMON_TOPICS)
        .map(([t]) => t);
      doc.commonTopics = sortedTopics;

      await doc.save();
    } else {
      await doc.save();
    }
  }

  async getDNA(guildId: string) {
    return ServerDNA.findOne({ guildId });
  }

  async resetDNA(guildId: string): Promise<void> {
    this.emojiFreq.delete(guildId);
    this.slangFreq.delete(guildId);
    this.topicFreq.delete(guildId);
    this.lastMessageTime.delete(guildId);
    this.pacingBuffer.delete(guildId);
    await ServerDNA.deleteOne({ guildId });
  }

  async updateDNA(guildId: string, overrides: Record<string, number>): Promise<void> {
    const update: Record<string, number> = {};
    for (const [key, val] of Object.entries(overrides)) {
      if (key.startsWith("traits.")) {
        update[key] = Math.max(0, Math.min(1, val));
      }
    }
    if (Object.keys(update).length > 0) {
      await ServerDNA.findOneAndUpdate(
        { guildId },
        { $set: { ...update, isReady: true, messageCount: Math.max(25, await this.getDNA(guildId).then(d => d?.messageCount || 0)) } },
        { upsert: true },
      );
    }
  }

  getVibeSummary(dna: { traits: IServerDNATraits; topSlang?: string[] } | null): string | null {
    if (!dna || !dna.traits) return null;
    const t = dna.traits;
    const parts: string[] = [];

    if (t.formality < 0.3) parts.push("casual");
    else if (t.formality > 0.7) parts.push("formal");

    if (t.humorLevel > 0.6) parts.push("high humor");
    else if (t.humorLevel < 0.3) parts.push("serious");

    if (t.emojiFrequency > 0.4) parts.push("emoji heavy");

    if (t.responseLength > 0.6) parts.push("long messages");
    else if (t.responseLength < 0.3) parts.push("short messages");

    if (dna.topSlang?.length) {
      parts.push(`slang like "${dna.topSlang.slice(0, 3).join(", ")}"`);
    }

    return parts.length > 0 ? parts.join(", ") : null;
  }
}

export const dnaEngine = new DNAEngine();
