import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import Warning from "../../models/Warning.js";

export class WarningsCommand extends BaseCommand {
  name = "warnings";
  description = "View warnings for a user";
  requiredPermissionLevel = PermissionLevel.Moderator;
  requiredPermissions = [PermissionFlagsBits.ModerateMembers];

  slashCommand = new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warnings for a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName("user").setDescription("User to check").setRequired(true))
    .addBooleanOption(opt => opt.setName("all").setDescription("Show inactive warnings too"));

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const user = ctx.type === "slash"
      ? ctx.interaction?.options.getUser("user")
      : ctx.message.mentions.users.first();

    const showAll = ctx.type === "slash"
      ? (ctx.interaction?.options.getBoolean("all") ?? false)
      : ctx.args.includes("--all");

    if (!user) return "Mention a user to check warnings.";
    if (!ctx.guildId) return "This command can only be used in a server.";

    const query: any = { guildId: ctx.guildId, userId: user.id };
    if (!showAll) query.active = true;

    const warnings = await Warning.find(query).sort({ createdAt: -1 });

    if (warnings.length === 0) {
      return `No${showAll ? "" : " active"} warnings found for <@${user.id}>.`;
    }

    const list = warnings.map((w, i) => {
      const status = w.active ? "Active" : "Cleared";
      const date = new Date(w.createdAt).toLocaleDateString();
      return `**#${i + 1}** [${status}] — ${date}\nReason: ${w.reason}\nBy: <@${w.moderatorId}>`;
    }).join("\n\n");

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle(`Warnings for ${user.username}`)
          .setDescription(list.slice(0, 4096))
          .setFooter({ text: `${warnings.length} warning(s)${showAll ? "" : " (active only)"}` })
          .setTimestamp(),
      ],
    };
  }
}
