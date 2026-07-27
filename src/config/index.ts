import type { EnvConfig } from "../types/config.js";
import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

if (!process.env.DISCORD_TOKEN) {
  const err = new Error("Missing DISCORD_TOKEN in environment");
  console.error(err.message);
}

export const env: EnvConfig = {
  discordToken: requireEnv("DISCORD_TOKEN"),
  mongoUri: requireEnv("MONGO_URI"),
  groqApiKey: requireEnv("GROQ_API_KEY"),
  ownerId: optionalEnv("OWNER_ID", "880070472434339880"),
  defaultPrefix: optionalEnv("DEFAULT_PREFIX", "b."),
  defaultModel: optionalEnv("DEFAULT_MODEL", "llama-3.3-70b-versatile"),
  maxHistory: parseInt(optionalEnv("MAX_HISTORY", "50"), 10),
  contextWindow: parseInt(optionalEnv("CONTEXT_WINDOW", "10"), 10),
  defaultCooldownMs: parseInt(optionalEnv("COOLDOWN_MS", "3000"), 10),
  guildId: process.env.GUILD_ID,
  nodeEnv: (process.env.NODE_ENV as EnvConfig["nodeEnv"]) || "development",
};
