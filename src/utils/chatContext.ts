import type { ChatContext } from "../types/index.js";
import type { Message } from "discord.js";

export function getChatContext(message: Pick<Message, "channelId" | "channel" | "guildId" | "guild" | "author">): ChatContext {
  const channelId = message.channelId || (message.channel?.id as string) || "unknown-channel";
  const guildId = message.guildId || (message.guild?.id as string) || null;
  const userId = message.author.id;

  return {
    chatKey: `${channelId}:${userId}`,
    channelId,
    guildId,
    userId,
  };
}
