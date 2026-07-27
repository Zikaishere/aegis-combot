import type { Message, Interaction, ChatInputCommandInteraction } from "discord.js";
import type { ExecResult } from "../types/index.js";
import type { PermissionLevel } from "../auth/PermissionLevel.js";

export interface CommandContext {
  type: "prefix" | "slash" | "mention";
  name: string;
  args: string[];
  userId: string;
  guildId: string | null;
  channelId: string;
  message: Message;
  interaction?: ChatInputCommandInteraction;
}

export interface ICommand {
  name: string;
  description: string;
  aliases?: string[];
  requiredPermissions?: bigint[];
  ownerOnly?: boolean;
  requiredPermissionLevel?: PermissionLevel;
  execute(ctx: CommandContext): Promise<ExecResult>;

  // Optional handler for slash commands — simplifies registration
  slashCommand?: any;
}
