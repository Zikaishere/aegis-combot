import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { LoreService } from "../../lore/LoreService.js";

export class LoreCommand extends BaseCommand {
  name = "lore";
  description = "Manage the Project Veil lore database";
  requiredPermissionLevel = PermissionLevel.Administrator;

  slashCommand = new SlashCommandBuilder()
    .setName("lore")
    .setDescription("Manage the Project Veil lore database")
    .addSubcommand(sub =>
      sub.setName("stats").setDescription("Show lore database statistics"),
    )
    .addSubcommand(sub =>
      sub
        .setName("anomaly")
        .setDescription("Look up an anomaly")
        .addStringOption(opt =>
          opt.setName("designation").setDescription("Anomaly designation").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("faction")
        .setDescription("Look up a faction")
        .addStringOption(opt =>
          opt.setName("name").setDescription("Faction name").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("npc")
        .setDescription("Look up an NPC")
        .addStringOption(opt =>
          opt.setName("name").setDescription("NPC name").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("location")
        .setDescription("Look up a location")
        .addStringOption(opt =>
          opt.setName("name").setDescription("Location name").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub.setName("timeline").setDescription("Show the active timeline"),
    )
    .addSubcommand(sub =>
      sub.setName("search").setDescription("Search the lore database")
        .addStringOption(opt =>
          opt.setName("query").setDescription("Search query").setRequired(true),
        ),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";

    switch (subcommand) {
      case "stats":
        return this.handleStats();
      case "anomaly":
        return this.handleAnomaly(ctx);
      case "faction":
        return this.handleFaction(ctx);
      case "npc":
        return this.handleNPC(ctx);
      case "location":
        return this.handleLocation(ctx);
      case "timeline":
        return this.handleTimeline();
      case "search":
        return this.handleSearch(ctx);
      default:
        return "Unknown subcommand.";
    }
  }

  private async handleStats(): Promise<{ embeds: any[] }> {
    const stats = await LoreService.getStats();

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Lore Database — Statistics")
          .setDescription("Current state of the Project Veil archive.")
          .addFields(
            { name: "Anomalies", value: `${stats.anomalies}`, inline: true },
            { name: "Factions", value: `${stats.factions}`, inline: true },
            { name: "NPCs", value: `${stats.npcs}`, inline: true },
            { name: "Locations", value: `${stats.locations}`, inline: true },
            { name: "Timelines", value: `${stats.timelines}`, inline: true },
            { name: "Events", value: `${stats.events}`, inline: true },
          )
          .setTimestamp(),
      ],
    };
  }

  private async handleAnomaly(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const designation = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("designation", true) ?? undefined)
      : ctx.args[1];

    if (!designation) return "Usage: `lore anomaly <designation>`";

    const anomaly = await LoreService.anomalies.findByDesignation(designation);
    if (!anomaly) return `No anomaly found with designation \`${designation}\`.`;

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(anomaly.threatLevel === "Threat-5" ? 0xff1744 : 0x00b4d8)
          .setTitle(`Anomaly: ${anomaly.designation}`)
          .setDescription(anomaly.description)
          .addFields(
            { name: "Threat Level", value: anomaly.threatLevel, inline: true },
            { name: "Status", value: anomaly.status, inline: true },
            { name: "Discovery Date", value: new Date(anomaly.discoveryDate).toLocaleDateString(), inline: true },
            ...(anomaly.location ? [{ name: "Location", value: anomaly.location, inline: true }] : []),
            ...(anomaly.containmentProcedures ? [{ name: "Containment", value: anomaly.containmentProcedures, inline: false }] : []),
            ...(anomaly.assignedTeam?.length ? [{ name: "Assigned Team", value: anomaly.assignedTeam.join(", "), inline: true }] : []),
            ...(anomaly.notes.length ? [{ name: "Notes", value: anomaly.notes.join("\n"), inline: false }] : []),
          )
          .setTimestamp(),
      ],
    };
  }

  private async handleFaction(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const name = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("name", true) ?? undefined)
      : ctx.args[1];

    if (!name) return "Usage: `lore faction <name>`";

    const faction = await LoreService.factions.findByName(name);
    if (!faction) return `No faction found with name \`${name}\`.`;

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle(`Faction: ${faction.name}`)
          .setDescription(faction.description)
          .addFields(
            { name: "Status", value: faction.status, inline: true },
            ...(faction.leader ? [{ name: "Leader", value: faction.leader, inline: true }] : []),
            ...(faction.headquarters ? [{ name: "HQ", value: faction.headquarters, inline: true }] : []),
            ...(faction.goals.length ? [{ name: "Goals", value: faction.goals.join("\n"), inline: false }] : []),
            ...(faction.allies.length ? [{ name: "Allies", value: faction.allies.join(", "), inline: true }] : []),
            ...(faction.enemies.length ? [{ name: "Enemies", value: faction.enemies.join(", "), inline: true }] : []),
          )
          .setTimestamp(),
      ],
    };
  }

  private async handleNPC(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const name = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("name", true) ?? undefined)
      : ctx.args[1];

    if (!name) return "Usage: `lore npc <name>`";

    const npc = await LoreService.npcs.findByName(name);
    if (!npc) return `No NPC found with name \`${name}\`.`;

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle(`${npc.name} — ${npc.title}`)
          .setDescription(npc.personality)
          .addFields(
            { name: "Status", value: npc.status, inline: true },
            ...(npc.faction ? [{ name: "Faction", value: npc.faction, inline: true }] : []),
            { name: "Speaking Style", value: npc.speakingStyle, inline: false },
            ...(npc.knowledge.length ? [{ name: "Knowledge", value: npc.knowledge.join("\n"), inline: false }] : []),
            ...(npc.goals.length ? [{ name: "Goals", value: npc.goals.join("\n"), inline: false }] : []),
          )
          .setTimestamp(),
      ],
    };
  }

  private async handleLocation(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const name = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("name", true) ?? undefined)
      : ctx.args[1];

    if (!name) return "Usage: `lore location <name>`";

    const location = await LoreService.locations.findByName(name);
    if (!location) return `No location found with name \`${name}\`.`;

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle(`Location: ${location.name}`)
          .setDescription(location.description)
          .addFields(
            { name: "Type", value: location.type, inline: true },
            { name: "Status", value: location.status, inline: true },
            ...(location.factionControl ? [{ name: "Controlled By", value: location.factionControl, inline: true }] : []),
            ...(location.coordinates ? [{ name: "Coordinates", value: location.coordinates, inline: true }] : []),
          )
          .setTimestamp(),
      ],
    };
  }

  private async handleTimeline(): Promise<string | { embeds: any[] }> {
    const timeline = await LoreService.timelines.findActive();
    if (!timeline) return "No active timeline found in the archive.";

    const eventLines = timeline.events.slice(-10).map(
      (e: any) => `${e.realityShift ? "⚠️" : "•"} **${e.date}** — ${e.description}`,
    );

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle(`Timeline: ${timeline.designation}`)
          .setDescription(timeline.description)
          .addFields(
            { name: "Recent Events", value: eventLines.join("\n") || "No events recorded.", inline: false },
            ...(timeline.divergences.length ? [{ name: "Divergences", value: timeline.divergences.join("\n"), inline: false }] : []),
          )
          .setTimestamp(),
      ],
    };
  }

  private async handleSearch(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const query = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("query", true) ?? undefined)
      : ctx.args.slice(1).join(" ");

    if (!query) return "Usage: `lore search <query>`";

    const [anomalies, factions, npcs, locations, events] = await Promise.all([
      LoreService.anomalies.search(query),
      LoreService.factions.search(query),
      LoreService.npcs.search(query),
      LoreService.locations.search(query),
      LoreService.events.search(query),
    ]);

    const total = anomalies.length + factions.length + npcs.length + locations.length + events.length;
    if (total === 0) return `No results found for \`${query}\`.`;

    const lines: string[] = [];
    if (anomalies.length) lines.push(`**Anomalies:** ${anomalies.map(a => a.designation).join(", ")}`);
    if (factions.length) lines.push(`**Factions:** ${factions.map(f => f.name).join(", ")}`);
    if (npcs.length) lines.push(`**NPCs:** ${npcs.map(n => n.name).join(", ")}`);
    if (locations.length) lines.push(`**Locations:** ${locations.map(l => l.name).join(", ")}`);
    if (events.length) lines.push(`**Events:** ${events.map(e => e.title).join(", ")}`);

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle(`Search Results: "${query}"`)
          .setDescription(lines.join("\n\n"))
          .setFooter({ text: `${total} total result${total === 1 ? "" : "s"}` })
          .setTimestamp(),
      ],
    };
  }
}
