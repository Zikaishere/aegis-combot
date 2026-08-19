import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import AuditLogEntry from "../../models/AuditLogEntry.js";

export class AuditLogCommand extends BaseCommand {
  name = "auditlog";
  description = "Server event log (channel/role changes, message edits, bans)";
  requiredPermissionLevel = PermissionLevel.Moderator;
  requiredPermissions = [PermissionFlagsBits.ViewAuditLog];

  slashCommand = new SlashCommandBuilder()
    .setName("auditlog")
    .setDescription("Server event log")
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
    .addSubcommand(sub =>
      sub
        .setName("channel")
        .setDescription("Set the audit log channel")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel for audit logs").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("View recent audit log entries")
        .addStringOption(opt =>
          opt.setName("filter").setDescription("Filter by action type")
            .addChoices(
              { name: "all", value: "all" },
              { name: "channels", value: "channel" },
              { name: "roles", value: "role" },
              { name: "members", value: "member" },
              { name: "messages", value: "message" },
            ),
        )
        .addIntegerOption(opt => opt.setName("count").setDescription("Number of entries (default 15)").setMinValue(5).setMaxValue(50)),
    )
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View audit log configuration"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";
    if (!ctx.guildId) return "Server only.";

    switch (subcommand) {
      case "channel": return this.handleChannel(ctx);
      case "view": return this.handleView(ctx);
      case "status": return this.handleStatus(ctx);
      default: return "Unknown subcommand.";
    }
  }

  private async handleChannel(ctx: CommandContext): Promise<string> {
    const channelId = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel")?.id
      : ctx.args[1]?.replace(/[<#>]/g, "");

    if (!channelId) return "Mention a channel.";

    const AutoModConfig = (await import("../../models/AutoModConfig.js")).default;
    await AutoModConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { auditLogChannelId: channelId },
      { upsert: true },
    );

    return `Audit log channel set to <#${channelId}>.`;
  }

  private async handleView(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const filter = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("filter") ?? "all")
      : "all";
    const count = ctx.type === "slash"
      ? (ctx.interaction?.options.getInteger("count") ?? 15)
      : 15;

    const query: any = { guildId: ctx.guildId };
    if (filter !== "all") {
      query.action = new RegExp(`^${filter}`, "i");
    }

    const entries = await AuditLogEntry.find(query).sort({ timestamp: -1 }).limit(count);

    if (entries.length === 0) {
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0x00b4d8)
            .setTitle("Audit Log")
            .setDescription("No entries found.")
            .setTimestamp(),
        ],
      };
    }

    const list = entries.map(e => {
      const time = `<t:${Math.floor(new Date(e.timestamp).getTime() / 1000)}:R>`;
      const mod = e.moderatorId ? `<@${e.moderatorId}>` : "System";
      return `${time} **${e.action}** — ${e.details} (by ${mod})`;
    }).join("\n");

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle(`Audit Log — ${filter === "all" ? "All" : filter}`)
          .setDescription(list.slice(0, 4096))
          .setFooter({ text: `${entries.length} entries` })
          .setTimestamp(),
      ],
    };
  }

  private async handleStatus(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const AutoModConfig = (await import("../../models/AutoModConfig.js")).default;
    const config = await AutoModConfig.findOne({ guildId: ctx.guildId });

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Audit Log Configuration")
          .addFields(
            { name: "Audit Log Channel", value: config?.auditLogChannelId ? `<#${config.auditLogChannelId}>` : "Not set", inline: true },
          )
          .setFooter({ text: "Aegis — Audit Log" })
          .setTimestamp(),
      ],
    };
  }
}
