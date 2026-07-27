import { SlashCommandBuilder, EmbedBuilder, type Guild, ChannelType } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { LoreService } from "../../lore/LoreService.js";

export class DocsCommand extends BaseCommand {
  name = "docs";
  description = "Generate server documentation";
  requiredPermissionLevel = PermissionLevel.Administrator;

  slashCommand = new SlashCommandBuilder()
    .setName("docs")
    .setDescription("Generate server documentation")
    .addSubcommand(sub =>
      sub.setName("server-map").setDescription("Generate a server structure map"),
    )
    .addSubcommand(sub =>
      sub.setName("lore-index").setDescription("Generate the lore database index"),
    )
    .addSubcommand(sub =>
      sub.setName("full").setDescription("Generate complete server documentation"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";

    switch (subcommand) {
      case "server-map":
        return this.handleServerMap(ctx);
      case "lore-index":
        return this.handleLoreIndex();
      case "full":
        return this.handleFull(ctx);
      default:
        return "Unknown subcommand.";
    }
  }

  private async handleServerMap(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const member = ctx.type === "slash" ? ctx.interaction?.member : ctx.message.member;
    const guild = (member as any)?.guild as Guild | undefined;

    if (!guild) return { embeds: [new EmbedBuilder().setColor(0xff1744).setDescription("Could not access server.")] };

    const categories = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => ("position" in a ? a.position : 0) - ("position" in b ? b.position : 0));

    const lines: string[] = [];

    for (const category of categories.values()) {
      lines.push(`**${category.name}**`);
      const children = guild.channels.cache
        .filter(c => c.parentId === category.id)
        .sort((a, b) => ("position" in a ? a.position : 0) - ("position" in b ? b.position : 0));

      for (const child of children.values()) {
        const icon = child.type === ChannelType.GuildText ? "#"
          : child.type === ChannelType.GuildVoice ? "🔊"
          : child.type === ChannelType.GuildForum ? "📋"
          : "📁";
        lines.push(`${icon} ${child.name}`);
      }
      lines.push("");
    }

    const uncategorized = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText && !c.parentId)
      .sort((a, b) => ("position" in a ? a.position : 0) - ("position" in b ? b.position : 0));

    if (uncategorized.size > 0) {
      lines.push("**Uncategorized**");
      for (const ch of uncategorized.values()) {
        lines.push(`# ${ch.name}`);
      }
    }

    const description = lines.join("\n").slice(0, 4000);

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Server Structure Map")
          .setDescription(description)
          .setFooter({ text: `${categories.size} categories • ${guild.channels.cache.size} total channels` })
          .setTimestamp(),
      ],
    };
  }

  private async handleLoreIndex(): Promise<{ embeds: any[] }> {
    const stats = await LoreService.getStats();
    const [anomalies, factions, npcs, locations] = await Promise.all([
      LoreService.anomalies.listAll(),
      LoreService.factions.listAll(),
      LoreService.npcs.listAll(),
      LoreService.locations.listAll(),
    ]);

    const lines: string[] = [];

    if (anomalies.length) {
      lines.push("**ANOMALIES**");
      for (const a of anomalies.slice(0, 10)) {
        lines.push(`• ${a.designation} — ${a.threatLevel} [${a.status}]`);
      }
      lines.push("");
    }

    if (factions.length) {
      lines.push("**FACTIONS**");
      for (const f of factions.slice(0, 10)) {
        lines.push(`• ${f.name} — ${f.status}`);
      }
      lines.push("");
    }

    if (npcs.length) {
      lines.push("**NPCs**");
      for (const n of npcs.slice(0, 10)) {
        lines.push(`• ${n.name} — ${n.title} [${n.status}]`);
      }
      lines.push("");
    }

    if (locations.length) {
      lines.push("**LOCATIONS**");
      for (const l of locations.slice(0, 10)) {
        lines.push(`• ${l.name} — ${l.type} [${l.status}]`);
      }
    }

    if (lines.length === 0) {
      lines.push("Lore database is empty. Use `/lore` commands to populate it.");
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Lore Database Index")
          .setDescription(lines.join("\n").slice(0, 4000))
          .setFooter({
            text: `${stats.anomalies} anomalies • ${stats.factions} factions • ${stats.npcs} NPCs • ${stats.locations} locations`,
          })
          .setTimestamp(),
      ],
    };
  }

  private async handleFull(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const [serverMap, loreIndex] = await Promise.all([
      this.handleServerMap(ctx),
      this.handleLoreIndex(),
    ]);

    const embeds = [
      ...(serverMap.embeds || []),
      ...(loreIndex.embeds || []),
    ];

    return { embeds };
  }
}
