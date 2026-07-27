import type { Message } from "discord.js";
import type { RoutingResult } from "../types/index.js";

export function stripBotMention(content: string, botUserId: string): string {
  return content
    .replaceAll(`<@${botUserId}>`, "")
    .replaceAll(`<@!${botUserId}>`, "")
    .trim();
}

export function isBotConversationMessage(
  message: Pick<Message, "content" | "channel" | "mentions" | "inGuild" | "guildId" | "guild">,
  clientUserId: string,
): RoutingResult {
  const isDirectMessage =
    message.channel?.isDMBased?.() ??
    (typeof message.inGuild === "function"
      ? !message.inGuild()
      : !message.guildId && !message.guild);

  const mentioned = new RegExp(`<@!?${clientUserId}>`).test(message.content || "");
  const isReplyToBot = message.mentions.repliedUser?.id === clientUserId;

  return {
    isDirectMessage,
    isReplyToBot,
    mentioned,
    shouldHandle: isDirectMessage || mentioned || isReplyToBot,
  };
}
