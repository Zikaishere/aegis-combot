import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { logModAction, getModLogChannel } from "./ModLogService.js";

export class BanCommand extends BaseCommand {
  name = "ban";
  description = "Ban a user from the server";
  requiredPermissionLevel = PermissionLevel.Moderator;
  requiredPermissions = [PermissionFlagsBits.BanMembers];

  slashCommand = new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for ban"))
    .addIntegerOption(opt => opt.setName("days").setDescription("Days of messages to delete (0-7)").setMinValue(0).setMaxValue(7));

  async run(ctx: CommandContext): Promise<string> {
    const user = ctx.type === "slash"
      ? ctx.interaction?.options.getUser("user")
      : ctx.message.mentions.users.first();

    const reason = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("reason") ?? "No reason provided")
      : ctx.args.slice(2).join(" ") || "No reason provided";

    const days = ctx.type === "slash"
      ? (ctx.interaction?.options.getInteger("days") ?? 0)
      : 0;

    if (!user) return "Mention a user to ban.";

    const member = await ctx.message.guild?.members.fetch(user.id).catch(() => null);
    if (!member) return "User not found in this server.";
    if (!member.bannable) return "I cannot ban this user. They may have a higher role than me.";

    const issuer = await ctx.message.guild?.members.fetch(ctx.userId);
    if (issuer && member.roles.highest.position >= issuer.roles.highest.position) {
      return "You cannot ban a user with an equal or higher role.";
    }

    await member.ban({ deleteMessageSeconds: days * 86400, reason: `${reason} (by ${ctx.userId})` });

    await logModAction(ctx.guildId!, {
      action: "ban",
      targetId: user.id,
      moderatorId: ctx.userId,
      reason,
      timestamp: new Date(),
    });

    return `Banned <@${user.id}>. Reason: ${reason}`;
  }
}
