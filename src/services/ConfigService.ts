import GuildConfig from "../models/GuildConfig.js";
import UserConfig from "../models/UserConfig.js";
import { env } from "../config/index.js";

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const guildCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 60_000;

export interface EffectiveConfig {
  prefix: string;
  model: string;
  maxTokens: number;
  temperature: number;
  cooldownMs: number;
  aiEnabled: boolean;
  allowedChannels: string[];
  guildPromptAdditions: string[];
  style: string;
  memoryEnabled: boolean;
  customFacts: string[];
  telemetryEnabled: boolean;
}

export async function getGuildConfig(guildId: string | null) {
  if (!guildId) return null;

  const cached = guildCache.get(guildId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  let config = await GuildConfig.findOne({ guildId });
  if (!config) {
    config = await GuildConfig.create({ guildId });
  }

  guildCache.set(guildId, { data: config, ts: Date.now() });
  return config;
}

export async function getUserConfig(userId: string) {
  let config = await UserConfig.findOne({ userId });
  if (!config) {
    config = await UserConfig.create({ userId });
  }
  return config;
}

export async function getPrefix(guildId: string | null): Promise<string> {
  if (!guildId) return env.defaultPrefix;
  const guild = await getGuildConfig(guildId);
  return guild?.prefix || env.defaultPrefix;
}

export async function getEffectiveConfig(
  guildId: string | null,
  userId: string,
): Promise<EffectiveConfig> {
  const [guildCfg, userCfg] = await Promise.all([
    getGuildConfig(guildId),
    getUserConfig(userId),
  ]);

  return {
    prefix: guildCfg?.prefix || env.defaultPrefix,
    model: guildCfg?.aiModel || env.defaultModel,
    maxTokens: guildCfg?.maxTokens || 500,
    temperature: guildCfg?.temperature ?? 0.9,
    cooldownMs: guildCfg?.cooldownMs || env.defaultCooldownMs,
    aiEnabled: guildCfg?.aiEnabled !== false,
    allowedChannels: guildCfg?.allowedChannels || [],
    guildPromptAdditions: guildCfg?.promptAdditions || [],
    style: userCfg.style || "default",
    memoryEnabled: userCfg.memoryEnabled !== false,
    customFacts: userCfg.customFacts || [],
    telemetryEnabled: guildCfg?.telemetryEnabled === true,
  };
}

export async function updateGuildConfig(
  guildId: string,
  updates: Record<string, unknown>,
) {
  const config = await GuildConfig.findOneAndUpdate(
    { guildId },
    { $set: updates },
    { upsert: true, new: true },
  );
  guildCache.set(guildId, { data: config, ts: Date.now() });
  return config;
}

export async function updateUserConfig(
  userId: string,
  updates: Record<string, unknown>,
) {
  return UserConfig.findOneAndUpdate(
    { userId },
    { $set: updates },
    { upsert: true, new: true },
  );
}

export async function addGuildPrompt(guildId: string, text: string) {
  const config = await getGuildConfig(guildId);
  if (config) {
    config.promptAdditions.push(text);
    await config.save();
    guildCache.set(guildId, { data: config, ts: Date.now() });
  }
}

export async function addCustomFact(userId: string, text: string) {
  const config = await getUserConfig(userId);
  config.customFacts.push(text);
  await config.save();
}

export async function removeCustomFact(userId: string, index: number) {
  const config = await getUserConfig(userId);
  if (index >= 0 && index < config.customFacts.length) {
    config.customFacts.splice(index, 1);
    await config.save();
  }
}

export function invalidateGuildCache(guildId: string) {
  guildCache.delete(guildId);
}
