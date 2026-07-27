import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { createEvent, concludeEvent, type EventConfig } from "../../events/EventManager.js";
import { registerConfirmation, buildConfirmationEmbed } from "../../safety/ConfirmationHandler.js";

export class EventCommand extends BaseCommand {
  name = "event";
  description = "Manage Project Veil events";
  requiredPermissionLevel = PermissionLevel.Administrator;

  slashCommand = new SlashCommandBuilder()
    .setName("event")
    .setDescription("Manage Project Veil events")
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Create a new event")
        .addStringOption(opt => opt.setName("name").setDescription("Event name").setRequired(true))
        .addStringOption(opt =>
          opt.setName("type").setDescription("Event type").setRequired(true)
            .addChoices(
              { name: "Containment Breach", value: "containment_breach" },
              { name: "Anomaly Investigation", value: "anomaly_investigation" },
              { name: "Timeline Shift", value: "timeline_shift" },
              { name: "Faction Conflict", value: "faction_conflict" },
              { name: "Custom", value: "custom" },
            ),
        )
        .addStringOption(opt => opt.setName("description").setDescription("Event description").setRequired(true))
        .addStringOption(opt => opt.setName("objectives").setDescription("Comma-separated objectives"))
        .addStringOption(opt => opt.setName("announcement").setDescription("Opening announcement message")),
    )
    .addSubcommand(sub =>
      sub
        .setName("conclude")
        .setDescription("Conclude the current event in this channel")
        .addStringOption(opt => opt.setName("title").setDescription("Conclusion title").setRequired(true))
        .addStringOption(opt => opt.setName("summary").setDescription("Conclusion summary").setRequired(true)),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";

    if (subcommand === "create") {
      return this.handleCreate(ctx);
    }

    if (subcommand === "conclude") {
      return this.handleConclude(ctx);
    }

    return "Unknown subcommand.";
  }

  private async handleCreate(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const name = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("name", true) ?? undefined)
      : ctx.args[1];
    const type = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("type", true) ?? undefined)
      : ctx.args[2];
    const description = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("description", true) ?? undefined)
      : ctx.args.slice(3).join(" ");
    const objectivesRaw = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("objectives") ?? undefined)
      : undefined;
    const announcement = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("announcement") ?? undefined)
      : undefined;

    if (!name || !type || !description) {
      return "Usage: `event create <name> <type> <description> [objectives] [announcement]`";
    }

    if (!ctx.guildId) return "This command can only be used in a server.";

    const member = ctx.type === "slash" ? ctx.interaction?.member : ctx.message.member;
    const guild = (member as any)?.guild;
    if (!guild) return "Could not access server instance.";

    const objectives = objectivesRaw
      ? objectivesRaw.split(",").map((o: string) => o.trim()).filter(Boolean)
      : [];

    const config: EventConfig = {
      name,
      type: type as EventConfig["type"],
      description,
      objectives,
      announcementMessage: announcement || `A ${type.replace(/_/g, " ")} event has been initiated. All operatives stand by.`,
    };

    const confirmationId = registerConfirmation({
      userId: ctx.userId,
      userTag: ctx.type === "slash"
        ? ctx.interaction?.user.tag ?? "unknown"
        : ctx.message.author.tag,
      action: `create_event:${name}`,
      reason: `Create event: ${name} (${type})`,
      affectedResources: [`event:${name}`],
      guildId: ctx.guildId ?? undefined,
      channelId: ctx.channelId,
      execute: async () => {
        const result = await createEvent(
          guild,
          config,
          ctx.userId,
          ctx.type === "slash"
            ? ctx.interaction?.user.tag ?? "unknown"
            : ctx.message.author.tag,
        );
        return { success: result.success, message: result.message };
      },
    });

    const confirmEmbed = buildConfirmationEmbed({
      userId: ctx.userId,
      userTag: ctx.type === "slash"
        ? ctx.interaction?.user.tag ?? "unknown"
        : ctx.message.author.tag,
      action: `create_event:${name}`,
      reason: `Create event: ${name} (${type})`,
      affectedResources: [`event:${name}`],
    });

    return { embeds: [confirmEmbed] };
  }

  private async handleConclude(ctx: CommandContext): Promise<string> {
    const title = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("title", true) ?? undefined)
      : ctx.args[1];
    const summary = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("summary", true) ?? undefined)
      : ctx.args.slice(2).join(" ");

    if (!title || !summary) {
      return "Usage: `event conclude <title> <summary>`";
    }

    const channel = ctx.type === "slash"
      ? ctx.interaction?.channel
      : ctx.message.channel;

    if (!channel || !("send" in channel)) return "Could not access channel.";

    const success = await concludeEvent(
      channel as any,
      title,
      summary,
      ctx.userId,
      ctx.type === "slash"
        ? ctx.interaction?.user.tag ?? "unknown"
        : ctx.message.author.tag,
    );

    return success
      ? `Event **${title}** concluded successfully.`
      : `Failed to conclude event.`;
  }
}
