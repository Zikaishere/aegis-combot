import { PermissionFlagsBits } from "discord.js";
import type { Guild, GuildMember } from "discord.js";

export interface ConfigOverrides {
  memoryEnabled?: boolean;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export function parseFlags(
  text: string,
  userId: string,
  ownerId: string,
  guild: Guild | null,
  member: GuildMember | null,
): { clean: string; overrides: ConfigOverrides } {
  const overrides: ConfigOverrides = {};
  const isDev = userId === ownerId;
  const isAdmin = isDev || (guild && member?.permissions.has(PermissionFlagsBits.Administrator)) || false;

  let clean = text;

  clean = clean.replace(/--no-memory\b/gi, () => {
    if (isAdmin) overrides.memoryEnabled = false;
    return "";
  });

  clean = clean.replace(/--long\b/gi, () => {
    if (isAdmin) overrides.maxTokens = 1000;
    return "";
  });

  clean = clean.replace(/--short\b/gi, () => {
    if (isAdmin) overrides.maxTokens = 150;
    return "";
  });

  clean = clean.replace(/--exact\b/gi, () => {
    if (isAdmin) overrides.temperature = 0.3;
    return "";
  });

  clean = clean.replace(/--creative\b/gi, () => {
    if (isAdmin) overrides.temperature = 1.2;
    return "";
  });

  clean = clean.replace(/--model\s+(\S+)/gi, (_match: string, m: string) => {
    if (isDev) overrides.model = m;
    return "";
  });

  clean = clean.replace(/--temp\s+([\d.]+)/gi, (_match: string, v: string) => {
    if (isDev) overrides.temperature = parseFloat(v);
    return "";
  });

  clean = clean.replace(/--tokens\s+(\d+)/gi, (_match: string, n: string) => {
    if (isDev) overrides.maxTokens = parseInt(n, 10);
    return "";
  });

  return { clean: clean.replace(/\s+/g, " ").trim(), overrides };
}
