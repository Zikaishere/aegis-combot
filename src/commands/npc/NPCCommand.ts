import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { LoreService } from "../../lore/LoreService.js";

export class NPCCommand extends BaseCommand {
  name = "npc";
  description = "Manage persistent NPCs in the Project Veil universe";
  requiredPermissionLevel = PermissionLevel.Administrator;

  slashCommand = new SlashCommandBuilder()
    .setName("npc")
    .setDescription("Manage persistent NPCs")
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Create a new NPC")
        .addStringOption(opt => opt.setName("name").setDescription("NPC name").setRequired(true))
        .addStringOption(opt => opt.setName("title").setDescription("NPC title/role").setRequired(true))
        .addStringOption(opt => opt.setName("personality").setDescription("Personality description").setRequired(true))
        .addStringOption(opt => opt.setName("speaking_style").setDescription("How they talk").setRequired(true))
        .addStringOption(opt => opt.setName("faction").setDescription("Associated faction"))
        .addStringOption(opt => opt.setName("background").setDescription("Background story")),
    )
    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("View an NPC's details")
        .addStringOption(opt => opt.setName("name").setDescription("NPC name").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("update")
        .setDescription("Update an NPC field")
        .addStringOption(opt => opt.setName("name").setDescription("NPC name").setRequired(true))
        .addStringOption(opt =>
          opt.setName("field").setDescription("Field to update").setRequired(true)
            .addChoices(
              { name: "personality", value: "personality" },
              { name: "speaking_style", value: "speakingStyle" },
              { name: "background", value: "background" },
              { name: "status", value: "status" },
              { name: "faction", value: "faction" },
            ),
        )
        .addStringOption(opt => opt.setName("value").setDescription("New value").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("add-knowledge")
        .setDescription("Add knowledge to an NPC")
        .addStringOption(opt => opt.setName("name").setDescription("NPC name").setRequired(true))
        .addStringOption(opt => opt.setName("fact").setDescription("Knowledge to add").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("add-secret")
        .setDescription("Add a secret to an NPC")
        .addStringOption(opt => opt.setName("name").setDescription("NPC name").setRequired(true))
        .addStringOption(opt => opt.setName("secret").setDescription("Secret to add").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("add-goal")
        .setDescription("Add a goal to an NPC")
        .addStringOption(opt => opt.setName("name").setDescription("NPC name").setRequired(true))
        .addStringOption(opt => opt.setName("goal").setDescription("Goal to add").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("set-relationship")
        .setDescription("Set a relationship between NPCs or with a user")
        .addStringOption(opt => opt.setName("name").setDescription("NPC name").setRequired(true))
        .addStringOption(opt => opt.setName("target").setDescription("Target name or user ID").setRequired(true))
        .addStringOption(opt => opt.setName("relationship").setDescription("Relationship type").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub.setName("list").setDescription("List all NPCs"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";

    switch (subcommand) {
      case "create":
        return this.handleCreate(ctx);
      case "view":
        return this.handleView(ctx);
      case "update":
        return this.handleUpdate(ctx);
      case "add-knowledge":
        return this.handleAddKnowledge(ctx);
      case "add-secret":
        return this.handleAddSecret(ctx);
      case "add-goal":
        return this.handleAddGoal(ctx);
      case "set-relationship":
        return this.handleSetRelationship(ctx);
      case "list":
        return this.handleList();
      default:
        return "Unknown subcommand.";
    }
  }

  private getOpt(ctx: CommandContext, name: string): string | undefined {
    if (ctx.type === "slash") {
      return ctx.interaction?.options.getString(name) ?? undefined;
    }
    return undefined;
  }

  private getRequiredOpt(ctx: CommandContext, name: string, argIndex: number): string | undefined {
    if (ctx.type === "slash") {
      return ctx.interaction?.options.getString(name, true) ?? undefined;
    }
    return ctx.args[argIndex];
  }

  private async handleCreate(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const name = this.getRequiredOpt(ctx, "name", 1);
    const title = this.getRequiredOpt(ctx, "title", 2);
    const personality = this.getRequiredOpt(ctx, "personality", 3);
    const speakingStyle = this.getRequiredOpt(ctx, "speaking_style", 4);
    const faction = this.getOpt(ctx, "faction") ?? ctx.args[5];
    const background = this.getOpt(ctx, "background") ?? ctx.args[6];

    if (!name || !title || !personality || !speakingStyle) {
      return "Usage: `npc create <name> <title> <personality> <speaking_style> [faction] [background]`";
    }

    const existing = await LoreService.npcs.findByName(name);
    if (existing) return `NPC \`${name}\` already exists.`;

    const npc = await LoreService.npcs.create({
      name,
      title,
      personality,
      speakingStyle,
      faction,
      background,
      status: "active",
      knowledge: [],
      secrets: [],
      goals: [],
      relationships: new Map(),
    });

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle(`NPC Created: ${name}`)
          .setDescription(`${title}\n\n${personality}`)
          .addFields(
            { name: "Speaking Style", value: speakingStyle, inline: false },
            ...(faction ? [{ name: "Faction", value: faction, inline: true }] : []),
            ...(background ? [{ name: "Background", value: background, inline: false }] : []),
          )
          .setTimestamp(),
      ],
    };
  }

  private async handleView(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const name = this.getRequiredOpt(ctx, "name", 1);
    if (!name) return "Usage: `npc view <name>`";

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
            ...(npc.background ? [{ name: "Background", value: npc.background, inline: false }] : []),
            ...(npc.knowledge.length ? [{ name: "Knowledge", value: npc.knowledge.map((k: any) => `• ${k}`).join("\n"), inline: false }] : []),
            ...(npc.secrets.length ? [{ name: "Secrets", value: npc.secrets.map((s: any) => `• ${s}`).join("\n"), inline: false }] : []),
            ...(npc.goals.length ? [{ name: "Goals", value: npc.goals.map((g: any) => `• ${g}`).join("\n"), inline: false }] : []),
            ...(npc.relationships instanceof Map && npc.relationships.size > 0
              ? [{ name: "Relationships", value: Array.from(npc.relationships.entries()).map(([k, v]: any) => `• ${k}: ${v}`).join("\n"), inline: false }]
              : []),
          )
          .setTimestamp(),
      ],
    };
  }

  private async handleUpdate(ctx: CommandContext): Promise<string> {
    const name = this.getRequiredOpt(ctx, "name", 1);
    const field = this.getRequiredOpt(ctx, "field", 2);
    const value = this.getRequiredOpt(ctx, "value", 3);

    if (!name || !field || !value) {
      return "Usage: `npc update <name> <field> <value>`";
    }

    const npc = await LoreService.npcs.findByName(name);
    if (!npc) return `No NPC found with name \`${name}\`.`;

    await LoreService.npcs.update(name, { [field]: value });
    return `NPC \`${name}\` updated. Field \`${field}\` set to: ${value}`;
  }

  private async handleAddKnowledge(ctx: CommandContext): Promise<string> {
    const name = this.getRequiredOpt(ctx, "name", 1);
    const fact = this.getRequiredOpt(ctx, "fact", 2);

    if (!name || !fact) return "Usage: `npc add-knowledge <name> <fact>`";

    const npc = await LoreService.npcs.findByName(name);
    if (!npc) return `No NPC found with name \`${name}\`.`;

    await LoreService.npcs.update(name, { $push: { knowledge: fact } });
    return `Knowledge added to \`${name}\`.`;
  }

  private async handleAddSecret(ctx: CommandContext): Promise<string> {
    const name = this.getRequiredOpt(ctx, "name", 1);
    const secret = this.getRequiredOpt(ctx, "secret", 2);

    if (!name || !secret) return "Usage: `npc add-secret <name> <secret>`";

    const npc = await LoreService.npcs.findByName(name);
    if (!npc) return `No NPC found with name \`${name}\`.`;

    await LoreService.npcs.update(name, { $push: { secrets: secret } });
    return `Secret added to \`${name}\`. Classification: CONFIDENTIAL.`;
  }

  private async handleAddGoal(ctx: CommandContext): Promise<string> {
    const name = this.getRequiredOpt(ctx, "name", 1);
    const goal = this.getRequiredOpt(ctx, "goal", 2);

    if (!name || !goal) return "Usage: `npc add-goal <name> <goal>`";

    const npc = await LoreService.npcs.findByName(name);
    if (!npc) return `No NPC found with name \`${name}\`.`;

    await LoreService.npcs.update(name, { $push: { goals: goal } });
    return `Goal added to \`${name}\`.`;
  }

  private async handleSetRelationship(ctx: CommandContext): Promise<string> {
    const name = this.getRequiredOpt(ctx, "name", 1);
    const target = this.getRequiredOpt(ctx, "target", 2);
    const relationship = this.getRequiredOpt(ctx, "relationship", 3);

    if (!name || !target || !relationship) {
      return "Usage: `npc set-relationship <name> <target> <relationship>`";
    }

    const npc = await LoreService.npcs.findByName(name);
    if (!npc) return `No NPC found with name \`${name}\`.`;

    const relationships = npc.relationships instanceof Map
      ? new Map(npc.relationships)
      : new Map(Object.entries(npc.relationships || {}));
    relationships.set(target, relationship);

    await LoreService.npcs.update(name, { relationships });
    return `Relationship set: \`${name}\` → \`${target}\`: ${relationship}`;
  }

  private async handleList(): Promise<{ embeds: any[] }> {
    const npcs = await LoreService.npcs.listAll();

    if (npcs.length === 0) {
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0x00b4d8)
            .setTitle("NPC Registry")
            .setDescription("No NPCs registered in the archive.")
            .setTimestamp(),
        ],
      };
    }

    const lines = npcs.map((n: any) => {
      const status = n.status === "active" ? "🟢" : n.status === "deceased" ? "🔴" : "🟡";
      return `${status} **${n.name}** — ${n.title} (${n.faction || "unaffiliated"})`;
    });

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("NPC Registry")
          .setDescription(lines.join("\n"))
          .setFooter({ text: `${npcs.length} NPC${npcs.length === 1 ? "" : "s"} registered` })
          .setTimestamp(),
      ],
    };
  }
}
