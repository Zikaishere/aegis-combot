import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { getRecentActions } from "../../safety/ActionLogger.js";
import Warning from "../../models/Warning.js";

export class ModCommand extends BaseCommand {
  name = "mod";
  description = "Moderation tools and incident tracking";
  requiredPermissionLevel = PermissionLevel.Moderator;

  slashCommand = new SlashCommandBuilder()
    .setName("mod")
    .setDescription("Moderation tools and incident tracking")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers | PermissionFlagsBits.BanMembers)
    .addSubcommand(sub =>
      sub
        .setName("warn")
        .setDescription("Issue a warning to a user")
        .addUserOption(opt => opt.setName("user").setDescription("User to warn").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for the warning").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("warnings")
        .setDescription("View warnings for a user")
        .addUserOption(opt => opt.setName("user").setDescription("User to check").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List all active warnings in this server")
        .addIntegerOption(opt =>
          opt.setName("count").setDescription("Max warnings to show (default 20)").setMinValue(5).setMaxValue(100),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("summary")
        .setDescription("Summarize recent moderation activity")
        .addIntegerOption(opt =>
          opt.setName("count").setDescription("Number of recent actions (default 20)").setMinValue(5).setMaxValue(100),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("incident")
        .setDescription("Log a moderation incident")
        .addStringOption(opt => opt.setName("description").setDescription("Incident description").setRequired(true))
        .addStringOption(opt =>
          opt.setName("severity").setDescription("Severity level").setRequired(true)
            .addChoices(
              { name: "Low", value: "low" },
              { name: "Medium", value: "medium" },
              { name: "High", value: "high" },
              { name: "Critical", value: "critical" },
            ),
        )
        .addStringOption(opt => opt.setName("involved").setDescription("User IDs involved (comma-separated)")),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Server only.";

    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    switch (subcommand) {
      case "warn": return this.handleWarn(ctx);
      case "warnings": return this.handleWarnings(ctx);
      case "list": return this.handleList(ctx);
      case "summary": return this.handleSummary(ctx);
      case "incident": return this.handleIncident(ctx);
      default: return "Unknown subcommand. Use `/mod warn`, `/mod warnings`, `/mod list`, `/mod summary`, or `/mod incident`.";
    }
  }

  private async handleWarn(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const userId = ctx.type === "slash"
      ? ctx.interaction?.options.getUser("user")?.id
      : ctx.args[1]?.replace(/[<@!>]/g, "");
    const reason = ctx.type === "slash"
      ? ctx.interaction?.options.getString("reason")
      : ctx.args.slice(2).join(" ");

    if (!userId || !reason) return "Usage: `/mod warn @user <reason>`";

    const guild = ctx.interaction?.guild ?? ctx.message?.guild;
    const issuer = ctx.interaction?.member ?? ctx.message?.member;

    if (!guild || !issuer) return "Server only.";

    const targetMember = await guild.members.fetch(userId).catch(() => null);
    if (!targetMember) return "User not found in this server.";

    if (targetMember.roles.highest.position >= (issuer as any).roles.highest.position) {
      return "Can't warn someone with an equal or higher role.";
    }

    await Warning.create({
      guildId: ctx.guildId,
      userId,
      moderatorId: ctx.userId,
      reason,
      createdAt: new Date(),
    });

    const warningCount = await Warning.countDocuments({ guildId: ctx.guildId, userId });

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("Warning Issued")
      .setDescription(`**<@${userId}>** has been warned.`)
      .addFields(
        { name: "Reason", value: reason, inline: false },
        { name: "Total Warnings", value: `${warningCount}`, inline: true },
        { name: "Moderator", value: `<@${ctx.userId}>`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: "Aegis — Moderation" });

    return { embeds: [embed] };
  }

  private async handleWarnings(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const userId = ctx.type === "slash"
      ? ctx.interaction?.options.getUser("user")?.id
      : ctx.args[1]?.replace(/[<@!>]/g, "");

    if (!userId) return "Usage: `/mod warnings @user`";

    const warnings = await Warning.find({ guildId: ctx.guildId, userId }).sort({ createdAt: -1 });

    if (warnings.length === 0) {
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("No Warnings")
            .setDescription(`<@${userId}> has a clean record.`)
            .setTimestamp(),
        ],
      };
    }

    const lines = warnings.slice(0, 25).map((w, i) => {
      const date = new Date(w.createdAt).toLocaleDateString();
      return `\`${i + 1}.\` ${date} — **${w.reason}** (<@${w.moderatorId}>)`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle(`Warnings — ${warnings.length}`)
      .setDescription(`**<@${userId}>**\n\n${lines.join("\n")}`)
      .setTimestamp()
      .setFooter({ text: "Aegis — Moderation" });

    return { embeds: [embed] };
  }

  private async handleList(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const count = ctx.type === "slash"
      ? (ctx.interaction?.options.getInteger("count") ?? 20)
      : (ctx.args[1] ? parseInt(ctx.args[1]) : 20);

    const warnings = await Warning.find({ guildId: ctx.guildId })
      .sort({ createdAt: -1 })
      .limit(count);

    if (warnings.length === 0) {
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("No Warnings")
            .setDescription("This server has no active warnings.")
            .setTimestamp(),
        ],
      };
    }

    const lines = warnings.map((w, i) => {
      const date = new Date(w.createdAt).toLocaleDateString();
      return `\`${i + 1}.\` <@${w.userId}> — ${w.reason} (${date})`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle(`Active Warnings`)
      .setDescription(lines.join("\n"))
      .setTimestamp()
      .setFooter({ text: "Aegis — Moderation" });

    return { embeds: [embed] };
  }

  private async handleSummary(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const count = ctx.type === "slash"
      ? (ctx.interaction?.options.getInteger("count") ?? 20)
      : (ctx.args[1] ? parseInt(ctx.args[1]) : 20);

    const logs = await getRecentActions(ctx.guildId ?? "", count);

    if (logs.length === 0) {
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0x00b4d8)
            .setTitle("Moderation Summary")
            .setDescription("No recent activity found.")
            .setTimestamp(),
        ],
      };
    }

    const successCount = logs.filter((l: any) => l.result === "success").length;
    const failCount = logs.filter((l: any) => l.result === "failure").length;
    const cancelCount = logs.filter((l: any) => l.result === "cancelled").length;

    const actionTypes = new Map<string, number>();
    for (const log of logs) {
      actionTypes.set(log.action, (actionTypes.get(log.action) || 0) + 1);
    }

    const topActions = [...actionTypes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action, count]) => `\`${action}\` — ${count}x`)
      .join("\n");

    const recentEntries = logs.slice(0, 5).map((l: any) => {
      const time = new Date(l.timestamp).toLocaleString();
      const status = l.result === "success" ? "✅" : l.result === "failure" ? "❌" : "🚫";
      return `${status} ${time} — ${l.action}`;
    });

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Moderation Summary")
          .setDescription(`Last ${logs.length} operational actions.`)
          .addFields(
            { name: "Results", value: `✅ ${successCount} success\n❌ ${failCount} failed\n🚫 ${cancelCount} cancelled`, inline: true },
            { name: "Top Actions", value: topActions || "None", inline: true },
            { name: "Recent Activity", value: recentEntries.join("\n") || "None", inline: false },
          )
          .setFooter({ text: "Aegis — Moderation" })
          .setTimestamp(),
      ],
    };
  }

  private async handleIncident(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const description = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("description", true) ?? undefined)
      : ctx.args[1];
    const severity = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("severity", true) ?? undefined)
      : ctx.args[2];
    const involved = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("involved") ?? undefined)
      : ctx.args[3];

    if (!description || !severity) return "Usage: `/mod incident <description> <severity> [involved]`";

    const involvedUsers = involved
      ? involved.split(",").map((id: string) => id.trim()).filter(Boolean)
      : [];

    const severityColors: Record<string, number> = {
      low: 0x2ecc71,
      medium: 0xf39c12,
      high: 0xe74c3c,
      critical: 0xff1744,
    };

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(severityColors[severity] ?? 0x00b4d8)
          .setTitle(`Incident — ${severity.toUpperCase()}`)
          .setDescription(description)
          .addFields(
            { name: "Reported By", value: `<@${ctx.userId}>`, inline: true },
            { name: "Severity", value: severity, inline: true },
            ...(involvedUsers.length
              ? [{ name: "Involved", value: involvedUsers.map((id: string) => `<@${id}>`).join(", "), inline: false }]
              : []),
          )
          .setTimestamp()
          .setFooter({ text: "Aegis — Moderation" }),
      ],
    };
  }
}
