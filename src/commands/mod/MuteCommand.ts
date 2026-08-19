import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { logModAction } from "./ModLogService.js";

const DURATION_REGEX = /^(\d+)(m|h|d)$/;

function parseDuration(str: string): number | null {
  const match = str.match(DURATION_REGEX);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
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

export class MuteCommand extends BaseCommand {
  name = "mute";
  description = "Timeout a user (mute)";
  requiredPermissionLevel = PermissionLevel.Moderator;
  requiredPermissions = [PermissionFlagsBits.ModerateMembers];

  slashCommand = new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName("user").setDescription("User to mute").setRequired(true))
    .addStringOption(opt => opt.setName("duration").setDescription("Duration (e.g. 10m, 2h, 1d)").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for mute"));

  async run(ctx: CommandContext): Promise<string> {
    const user = ctx.type === "slash"
      ? ctx.interaction?.options.getUser("user")
      : ctx.message.mentions.users.first();

    const durationStr = ctx.type === "slash"
      ? ctx.interaction?.options.getString("duration", true)
      : ctx.args[1];

    const reason = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("reason") ?? "No reason provided")
      : ctx.args.slice(2).join(" ") || "No reason provided";

    if (!user) return "Mention a user to mute.";
    if (!durationStr) return "Provide a duration. Examples: `10m`, `2h`, `1d`.";

    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 60000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return "Invalid duration. Must be between 1m and 28d. Formats: `10m`, `2h`, `1d`.";
    }

    const guild = ctx.interaction?.guild ?? ctx.message?.guild;
    const member = await guild?.members.fetch(user.id).catch(() => null);
    if (!member) return "User not found in this server.";
    if (!member.moderatable) return "I cannot mute this user. They may have a higher role than me.";

    const issuer = await guild?.members.fetch(ctx.userId);
    if (issuer && member.roles.highest.position >= issuer.roles.highest.position) {
      return "You cannot mute a user with an equal or higher role.";
    }

    await member.timeout(durationMs, `${reason} (by ${ctx.userId})`);

    await logModAction(ctx.guildId!, {
      action: "mute",
      targetId: user.id,
      moderatorId: ctx.userId,
      reason: `${reason} (${formatDuration(durationMs)})`,
      timestamp: new Date(),
    });

    return `Muted <@${user.id}> for ${formatDuration(durationMs)}. Reason: ${reason}`;
  }
}
