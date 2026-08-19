import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import Warning from "../../models/Warning.js";
import { logModAction } from "./ModLogService.js";

export class WarnCommand extends BaseCommand {
  name = "warn";
  description = "Warn a user";
  requiredPermissionLevel = PermissionLevel.Moderator;
  requiredPermissions = [PermissionFlagsBits.ModerateMembers];

  slashCommand = new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for warning").setRequired(true));

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const user = ctx.type === "slash"
      ? ctx.interaction?.options.getUser("user")
      : ctx.message.mentions.users.first();

    const reason = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("reason", true) ?? undefined)
      : ctx.args.slice(2).join(" ");

    if (!user) return "Mention a user to warn.";
    if (!reason) return "Provide a reason for the warning.";
    if (!ctx.guildId) return "This command can only be used in a server.";

    await Warning.create({
      guildId: ctx.guildId,
      userId: user.id,
      moderatorId: ctx.userId,
      reason,
    });

    const activeWarnings = await Warning.countDocuments({ guildId: ctx.guildId, userId: user.id, active: true });

    await logModAction(ctx.guildId, {
      action: "warn",
      targetId: user.id,
      moderatorId: ctx.userId,
      reason,
      timestamp: new Date(),
    });

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle("Warning Issued")
          .addFields(
            { name: "User", value: `<@${user.id}>`, inline: true },
            { name: "Moderator", value: `<@${ctx.userId}>`, inline: true },
            { name: "Reason", value: reason, inline: false },
            { name: "Active Warnings", value: `${activeWarnings}`, inline: true },
          )
          .setFooter({ text: "Aegis — Community AI Assistant" })
          .setTimestamp(),
      ],
    };
  }
}
