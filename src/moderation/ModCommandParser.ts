import type { Message } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { stripBotMention } from "../utils/messageRouting.js";
import { checkPermission } from "../auth/AuthService.js";
import { PermissionLevel } from "../auth/PermissionLevel.js";
import { logModAction } from "../commands/mod/ModLogService.js";
import Warning from "../models/Warning.js";

export interface ParsedModCommand {
  action: "ban" | "kick" | "mute" | "warn" | "warnings" | "purge" | "modlog" | null;
  targetId: string | null;
  reason: string;
  duration: string | null;
  count: number | null;
  channelId: string | null;
}

function extractUserId(content: string, mentionedUser: string | null): string | null {
  if (mentionedUser) return mentionedUser;

  const userMention = content.match(/<@!?(\d+)>/);
  if (userMention) return userMention[1];

  return null;
}

function extractReason(content: string, action: string): string {
  const patterns = [
    new RegExp(`(?:for|reason:?)\\s+["""](.+?)["""]`, "i"),
    new RegExp(`(?:for|reason:?)\\s+(.+?)(?:\\s+\\d+[mhd]|$)`, "i"),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1].trim();
  }

  const forIndex = content.toLowerCase().indexOf("for ");
  if (forIndex !== -1) {
    return content.slice(forIndex + 4).trim();
  }

  return "No reason provided";
}

function extractDuration(content: string): string | null {
  const match = content.match(/\b(\d+[mhd])\b/i);
  return match ? match[1].toLowerCase() : null;
}

function extractCount(content: string): number | null {
  const match = content.match(/\b(\d+)\b/);
  return match ? parseInt(match[1]) : null;
}

export function parseModCommand(content: string, botUserId: string): ParsedModCommand {
  const cleaned = stripBotMention(content, botUserId).trim().toLowerCase();

  let action: ParsedModCommand["action"] = null;
  let targetId: string | null = null;
  let reason = "No reason provided";
  let duration: string | null = null;
  let count: number | null = null;
  let channelId: string | null = null;

  const fullContent = content;
  const userMatch = fullContent.match(/<@!?(\d+)>/g);
  const botMention = `<@${botUserId}>`;
  const botMentionNick = `<@!${botUserId}>`;
  const mentionedUsers = (userMatch || []).filter(id => id !== botMention && id !== botMentionNick);
  targetId = mentionedUsers[0]?.match(/<@!?(\d+)>/)?.[1] ?? null;

  if (/\b(ban|remove|yeet)\b/.test(cleaned)) {
    action = "ban";
  } else if (/\b(kick|eject|boot)\b/.test(cleaned)) {
    action = "kick";
  } else if (/\b(mute|timeout|silence|shut)\b/.test(cleaned)) {
    action = "mute";
    duration = extractDuration(cleaned);
    if (!duration) duration = "10m";
  } else if (/\b(warn|warning|strike)\b/.test(cleaned)) {
    action = "warn";
  } else if (/\b(warnings?|history|infractions?|strikes?|record)\b/.test(cleaned)) {
    action = "warnings";
  } else if (/\b(purge|clear|clean|delete messages|bulk)\b/.test(cleaned)) {
    action = "purge";
    count = extractCount(cleaned) || 10;
  } else if (/\b(modlog|log channel|set log)\b/.test(cleaned)) {
    action = "modlog";
    const channelMention = fullContent.match(/<#(\d+)>/);
    channelId = channelMention?.[1] ?? null;
  }

  if (action && action !== "warnings" && action !== "purge" && action !== "modlog") {
    reason = extractReason(fullContent, action);
  }

  return { action, targetId, reason, duration, count, channelId };
}

export async function handleModMention(message: Message, botUserId: string): Promise<boolean> {
  const content = message.content;
  const mentioned = new RegExp(`<@!?${botUserId}>`).test(content);
  if (!mentioned) return false;

  const parsed = parseModCommand(content, botUserId);
  if (!parsed.action) return false;

  const senderId = message.author.id;
  const guildId = message.guild?.id;
  if (!guildId) return false;

  const hasModPerms = message.member?.permissions.has(PermissionFlagsBits.BanMembers) ||
    message.member?.permissions.has(PermissionFlagsBits.KickMembers) ||
    message.member?.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    message.member?.permissions.has(PermissionFlagsBits.ManageMessages);

  const hasDBPerm = await checkPermission(senderId, PermissionLevel.Moderator);
  if (!hasModPerms && !hasDBPerm) {
    await message.reply("You don't have permission to use moderation commands.");
    return true;
  }

  switch (parsed.action) {
    case "ban": return executeBan(message, parsed, guildId);
    case "kick": return executeKick(message, parsed, guildId);
    case "mute": return executeMute(message, parsed, guildId);
    case "warn": return executeWarn(message, parsed, guildId);
    case "warnings": return executeWarnings(message, parsed, guildId);
    case "purge": return executePurge(message, parsed, guildId);
    case "modlog": return executeModLog(message, parsed, guildId);
    default: return false;
  }
}

const DURATION_REGEX = /^(\d+)(m|h|d)$/;

function parseDurationMs(str: string): number | null {
  const match = str.match(DURATION_REGEX);
  if (!match) return null;
  const val = parseInt(match[1]);
  switch (match[2]) {
    case "m": return val * 60 * 1000;
    case "h": return val * 60 * 60 * 1000;
    case "d": return val * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function executeBan(message: Message, parsed: ParsedModCommand, guildId: string): Promise<boolean> {
  if (!parsed.targetId) {
    await message.reply("Mention a user to ban. Example: `@aegis ban @user for reason`");
    return true;
  }

  const member = await message.guild?.members.fetch(parsed.targetId).catch(() => null);
  if (!member) {
    await message.reply("User not found in this server.");
    return true;
  }
  if (!member.bannable) {
    await message.reply("I can't ban this user. They may have a higher role than me.");
    return true;
  }

  await member.ban({ reason: `${parsed.reason} (by ${message.author.id})` });
  await logModAction(guildId, {
    action: "ban", targetId: parsed.targetId, moderatorId: message.author.id,
    reason: parsed.reason, timestamp: new Date(),
  });

  await message.reply(`Banned <@${parsed.targetId}>. Reason: ${parsed.reason}`);
  return true;
}

async function executeKick(message: Message, parsed: ParsedModCommand, guildId: string): Promise<boolean> {
  if (!parsed.targetId) {
    await message.reply("Mention a user to kick. Example: `@aegis kick @user for reason`");
    return true;
  }

  const member = await message.guild?.members.fetch(parsed.targetId).catch(() => null);
  if (!member) {
    await message.reply("User not found in this server.");
    return true;
  }
  if (!member.kickable) {
    await message.reply("I can't kick this user. They may have a higher role than me.");
    return true;
  }

  await member.kick(`${parsed.reason} (by ${message.author.id})`);
  await logModAction(guildId, {
    action: "kick", targetId: parsed.targetId, moderatorId: message.author.id,
    reason: parsed.reason, timestamp: new Date(),
  });

  await message.reply(`Kicked <@${parsed.targetId}>. Reason: ${parsed.reason}`);
  return true;
}

async function executeMute(message: Message, parsed: ParsedModCommand, guildId: string): Promise<boolean> {
  if (!parsed.targetId) {
    await message.reply("Mention a user to mute. Example: `@aegis mute @user for reason 10m`");
    return true;
  }

  const durationMs = parseDurationMs(parsed.duration || "10m");
  if (!durationMs || durationMs < 60000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
    await message.reply("Invalid duration. Use formats like `10m`, `2h`, `1d` (1 minute to 28 days).");
    return true;
  }

  const member = await message.guild?.members.fetch(parsed.targetId).catch(() => null);
  if (!member) {
    await message.reply("User not found in this server.");
    return true;
  }
  if (!member.moderatable) {
    await message.reply("I can't mute this user. They may have a higher role than me.");
    return true;
  }

  await member.timeout(durationMs, `${parsed.reason} (by ${message.author.id})`);
  await logModAction(guildId, {
    action: "mute", targetId: parsed.targetId, moderatorId: message.author.id,
    reason: `${parsed.reason} (${formatDuration(durationMs)})`, timestamp: new Date(),
  });

  await message.reply(`Muted <@${parsed.targetId}> for ${formatDuration(durationMs)}. Reason: ${parsed.reason}`);
  return true;
}

async function executeWarn(message: Message, parsed: ParsedModCommand, guildId: string): Promise<boolean> {
  if (!parsed.targetId) {
    await message.reply("Mention a user to warn. Example: `@aegis warn @user for reason`");
    return true;
  }

  await Warning.create({
    guildId,
    userId: parsed.targetId,
    moderatorId: message.author.id,
    reason: parsed.reason,
  });

  const activeWarnings = await Warning.countDocuments({ guildId, userId: parsed.targetId, active: true });

  await logModAction(guildId, {
    action: "warn", targetId: parsed.targetId, moderatorId: message.author.id,
    reason: parsed.reason, timestamp: new Date(),
  });

  await message.reply(`Warned <@${parsed.targetId}>. Reason: ${parsed.reason} (${activeWarnings} active warning${activeWarnings !== 1 ? "s" : ""})`);
  return true;
}

async function executeWarnings(message: Message, parsed: ParsedModCommand, guildId: string): Promise<boolean> {
  if (!parsed.targetId) {
    await message.reply("Mention a user. Example: `@aegis show warnings for @user`");
    return true;
  }

  const warnings = await Warning.find({ guildId, userId: parsed.targetId, active: true }).sort({ createdAt: -1 });

  if (warnings.length === 0) {
    await message.reply(`No active warnings for <@${parsed.targetId}>.`);
    return true;
  }

  const list = warnings.map((w, i) => {
    const date = new Date(w.createdAt).toLocaleDateString();
    return `**#${i + 1}** — ${date}\nReason: ${w.reason}\nBy: <@${w.moderatorId}>`;
  }).join("\n\n");

  await message.reply({
    embeds: [{
      color: 0xf39c12,
      title: `Warnings for user`,
      description: list.slice(0, 4096),
      footer: { text: `${warnings.length} active warning(s)` },
      timestamp: new Date().toISOString(),
    }],
  });
  return true;
}

async function executePurge(message: Message, parsed: ParsedModCommand, guildId: string): Promise<boolean> {
  const count = parsed.count || 10;
  const channel = message.channel;
  if (!channel || !("messages" in channel)) return false;

  let deleted = 0;
  let remaining = count;

  while (remaining > 0) {
    const fetchCount = Math.min(remaining, 100);
    const messages = await (channel as any).messages.fetch({ limit: fetchCount });
    const filtered = Array.from(messages.values());

    if (filtered.length === 0) break;

    const bulk = await (channel as any).bulkDelete(filtered, true);
    deleted += bulk.size;
    remaining -= fetchCount;

    if (bulk.size < fetchCount) break;
  }

  await logModAction(guildId, {
    action: "purge", targetId: "all", moderatorId: message.author.id,
    reason: `Deleted ${deleted} messages`, timestamp: new Date(),
  });

  await message.reply(`Deleted ${deleted} message(s).`);
  return true;
}

async function executeModLog(message: Message, parsed: ParsedModCommand, guildId: string): Promise<boolean> {
  if (!parsed.channelId) {
    await message.reply("Mention a channel. Example: `@aegis set log to #mod-log`");
    return true;
  }

  const AutoModConfig = (await import("../models/AutoModConfig.js")).default;
  await AutoModConfig.findOneAndUpdate(
    { guildId },
    { modLogChannelId: parsed.channelId },
    { upsert: true },
  );

  await message.reply(`Mod log channel set to <#${parsed.channelId}>.`);
  return true;
}
