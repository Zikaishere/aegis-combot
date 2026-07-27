import type { Message } from "discord.js";

export type MaybeMessage = Pick<
  Message,
  | "content"
  | "author"
  | "member"
  | "guild"
  | "guildId"
  | "channel"
  | "channelId"
  | "mentions"
  | "reply"
  | "inGuild"
>;
