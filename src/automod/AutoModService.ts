import type { Message } from "discord.js";
import AutoModConfig from "../models/AutoModConfig.js";
import Warning from "../models/Warning.js";
import { logModAction } from "../commands/mod/ModLogService.js";
import { aiModerate } from "./AIAutoMod.js";

const messageTimestamps = new Map<string, number[]>();

const SEVERE_WORDS = [
  "nigger", "nigga", "faggot", "kike", "spic", "chink",
  "tranny", "dyke", "coon", "wetback", "beaner",
  "gringo", "gook", "darkie", "jap",
];

const MEDIUM_WORDS = [
  "fuck", "fucking", "fucked", "fucker", "motherfucker", "mf",
  "shit", "shitty", "bullshit",
  "cunt", "twat",
  "bitch", "bitches", "bitchass",
  "bastard",
  "dick", "dickhead", "asshole",
];

const MILD_WORDS = [
  "damn", "dammit", "damnit", "goddamn",
  "hell", "hella",
  "ass", "asses", "arse",
  "crap", "crappy",
  "piss", "pissed",
  "bloody",
  "dumb", "idiot", "stupid",
  "kys", "kill yourself", "go die",
];

const LINK_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

export type ProfanityTier = "mild" | "medium" | "severe";

function isExempt(message: Message, exemptChannels: string[]): boolean {
  return exemptChannels.includes(message.channel.id);
}

export async function handleAutoMod(message: Message): Promise<boolean> {
  if (message.author.bot) return false;
  if (!message.guild) return false;

  const config = await AutoModConfig.findOne({ guildId: message.guild.id });
  if (!config || !config.enabled) return false;

  if (isExempt(message, config.exemptChannels)) return false;

  let actionTaken = false;

  if (config.antiSpam.enabled && !actionTaken) {
    const spamResult = await checkSpam(message, config);
    if (spamResult) actionTaken = true;
  }

  if (config.linkFilter.enabled && !actionTaken) {
    const linkResult = await checkLinks(message, config);
    if (linkResult) actionTaken = true;
  }

  if (config.profanityFilter.enabled && !actionTaken) {
    const profanityResult = await checkProfanity(message, config);
    if (profanityResult) actionTaken = true;
  }

  if (!actionTaken && config.aiModeration?.enabled) {
    const aiResult = await aiModerate(message);
    if (aiResult) {
      await takeAction(message, aiResult.action, aiResult.reason);
      actionTaken = true;
    }
  }

  return actionTaken;
}

async function checkSpam(message: Message, config: any): Promise<boolean> {
  const key = `${message.guild!.id}:${message.author.id}`;
  const now = Date.now();
  const windowMs = config.antiSpam.timeWindowMs;
  const maxMessages = config.antiSpam.maxMessages;

  const timestamps = messageTimestamps.get(key) || [];
  const recent = timestamps.filter(t => now - t < windowMs);
  recent.push(now);
  messageTimestamps.set(key, recent);

  if (recent.length > maxMessages) {
    messageTimestamps.delete(key);
    await takeAction(message, config.antiSpam.action, "Auto-mod: spam detected");
    return true;
  }

  return false;
}

async function checkLinks(message: Message, config: any): Promise<boolean> {
  const content = message.content;
  if (!LINK_REGEX.test(content)) return false;

  LINK_REGEX.lastIndex = 0;
  const links = content.match(LINK_REGEX) || [];
  const whitelisted = config.linkFilter.whitelist as string[];

  for (const link of links) {
    try {
      const domain = new URL(link.startsWith("http") ? link : `https://${link}`).hostname.replace("www.", "");
      const isWhitelisted = whitelisted.some((w: string) => domain.includes(w));
      if (!isWhitelisted) {
        await message.delete().catch(() => {});
        await takeAction(message, config.linkFilter.action, `Auto-mod: non-whitelisted link (${domain})`);
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

function classifyProfanity(content: string, config: any): ProfanityTier | null {
  const lower = content.toLowerCase();
  const words = lower.split(/\s+/);

  const customSevere = (config.profanityFilter.customSevere as string[]).map((w: string) => w.toLowerCase());
  const customMedium = (config.profanityFilter.customMedium as string[]).map((w: string) => w.toLowerCase());
  const customMild = (config.profanityFilter.customMild as string[]).map((w: string) => w.toLowerCase());

  for (const word of words) {
    if (SEVERE_WORDS.includes(word) || customSevere.includes(word)) return "severe";
  }

  for (const word of words) {
    if (MEDIUM_WORDS.includes(word) || customMedium.includes(word)) return "medium";
  }

  for (const word of words) {
    if (MILD_WORDS.includes(word) || customMild.includes(word)) return "mild";
  }

  if (SEVERE_WORDS.some(w => lower.includes(w))) return "severe";
  if (MEDIUM_WORDS.some(w => lower.includes(w))) return "medium";
  if (MILD_WORDS.some(w => lower.includes(w))) return "mild";

  return null;
}

async function checkProfanity(message: Message, config: any): Promise<boolean> {
  const tier = classifyProfanity(message.content, config);
  if (!tier) return false;

  let action: string;
  let reason: string;

  switch (tier) {
    case "severe":
      action = config.profanityFilter.severeAction;
      reason = "Auto-mod: severe language (slur/hate speech)";
      break;
    case "medium":
      action = config.profanityFilter.mediumAction;
      reason = "Auto-mod: profanity";
      break;
    case "mild":
      action = config.profanityFilter.mildAction;
      reason = "Auto-mod: mild language";
      break;
  }

  if (action === "allow") return false;

  if (action === "delete" || action === "warn" || action === "mute" || action === "kick" || action === "ban") {
    if (tier !== "severe") {
      await message.delete().catch(() => {});
    }
    await takeAction(message, action, reason);
    return true;
  }

  return false;
}

async function takeAction(message: Message, action: string, reason: string): Promise<void> {
  const guild = message.guild!;
  const member = await guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return;

  switch (action) {
    case "warn":
      await Warning.create({
        guildId: guild.id,
        userId: message.author.id,
        moderatorId: guild.members.me?.id || "automod",
        reason,
      });
      if ("send" in message.channel) {
        await message.channel.send({ content: `<@${message.author.id}> — ${reason}` }).catch(() => {});
      }
      break;

    case "mute":
      if (member.moderatable) {
        await member.timeout(10 * 60 * 1000, reason);
        if ("send" in message.channel) {
          await message.channel.send({ content: `<@${message.author.id}> has been muted for 10 minutes. ${reason}` }).catch(() => {});
        }
      }
      break;

    case "kick":
      if (member.kickable) {
        await member.kick(reason);
      }
      break;

    case "ban":
      if (member.bannable) {
        await member.ban({ reason });
      }
      break;

    default:
      if ("send" in message.channel) {
        await message.channel.send({ content: `<@${message.author.id}> — ${reason}` }).catch(() => {});
      }
  }

  await logModAction(guild.id, {
    action: "automod",
    targetId: message.author.id,
    moderatorId: guild.members.me?.id || "automod",
    reason,
    timestamp: new Date(),
    extra: `Triggered by: ${action}`,
  });
}
