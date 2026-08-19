import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import AutoModConfig from "../../models/AutoModConfig.js";

export class ModLogCommand extends BaseCommand {
  name = "modlog";
  description = "Set the moderation log channel";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("modlog")
    .setDescription("Set the moderation log channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("Channel for mod logs").setRequired(true),
    );

  async run(ctx: CommandContext): Promise<string> {
    const channelId = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel")?.id
      : ctx.args[0]?.replace(/[<#>]/g, "");

    if (!channelId) return "Mention or provide a channel.";

    if (!ctx.guildId) return "This command can only be used in a server.";

    const channel = await (ctx.interaction?.guild ?? ctx.message?.guild)?.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return "Must be a text channel.";

    await AutoModConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { modLogChannelId: channelId },
      { upsert: true },
    );

    return `Mod log channel set to <#${channelId}>.`;
  }
}
