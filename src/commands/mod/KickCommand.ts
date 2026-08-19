import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { logModAction } from "./ModLogService.js";

export class KickCommand extends BaseCommand {
  name = "kick";
  description = "Kick a user from the server";
  requiredPermissionLevel = PermissionLevel.Moderator;
  requiredPermissions = [PermissionFlagsBits.KickMembers];

  slashCommand = new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt => opt.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for kick"));

  async run(ctx: CommandContext): Promise<string> {
    const user = ctx.type === "slash"
      ? ctx.interaction?.options.getUser("user")
      : ctx.message.mentions.users.first();

    const reason = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("reason") ?? "No reason provided")
      : ctx.args.slice(2).join(" ") || "No reason provided";

    if (!user) return "Mention a user to kick.";

    const member = await ctx.message.guild?.members.fetch(user.id).catch(() => null);
    if (!member) return "User not found in this server.";
    if (!member.kickable) return "I cannot kick this user. They may have a higher role than me.";

    const issuer = await ctx.message.guild?.members.fetch(ctx.userId);
    if (issuer && member.roles.highest.position >= issuer.roles.highest.position) {
      return "You cannot kick a user with an equal or higher role.";
    }

    await member.kick(`${reason} (by ${ctx.userId})`);

    await logModAction(ctx.guildId!, {
      action: "kick",
      targetId: user.id,
      moderatorId: ctx.userId,
      reason,
      timestamp: new Date(),
    });

    return `Kicked <@${user.id}>. Reason: ${reason}`;
  }
}
