import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";

export class BansCommand extends BaseCommand {
  name = "bans";
  description = "View all banned users in the server";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.BanMembers];

  slashCommand = new SlashCommandBuilder()
    .setName("bans")
    .setDescription("View all banned users in the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const guild = ctx.type === "slash" ? ctx.interaction?.guild : ctx.message.guild;
    if (!guild) return "Server only.";

    const bans = await guild.bans.fetch().catch(() => null);
    if (!bans) return "Failed to fetch ban list. Check my permissions.";

    if (bans.size === 0) {
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("Ban List")
            .setDescription("No users are currently banned from this server.")
            .setFooter({ text: "Aegis — Ban List" })
            .setTimestamp(),
        ],
      };
    }

    const entries = bans.map((ban) => {
      const reason = ban.reason || "No reason provided";
      return `\`${ban.user.tag}\` — ${reason.slice(0, 80)}`;
    });

    const pages: string[][] = [];
    for (let i = 0; i < entries.length; i += 15) {
      pages.push(entries.slice(i, i + 15));
    }

    const embeds = pages.map((page, idx) =>
      new EmbedBuilder()
        .setColor(0xff1744)
        .setTitle(`Ban List — ${bans.size} total`)
        .setDescription(page.join("\n"))
        .setFooter({ text: `Aegis — Page ${idx + 1}/${pages.length}` })
        .setTimestamp(),
    );

    return { embeds };
  }
}
