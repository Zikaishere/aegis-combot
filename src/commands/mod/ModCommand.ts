import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { getRecentActions } from "../../safety/ActionLogger.js";

export class ModCommand extends BaseCommand {
  name = "mod";
  description = "Moderation assistant — incident tracking and summaries";
  requiredPermissionLevel = PermissionLevel.Moderator;

  slashCommand = new SlashCommandBuilder()
    .setName("mod")
    .setDescription("Moderation assistant")
    .addSubcommand(sub =>
      sub
        .setName("summary")
        .setDescription("Generate a moderation summary for recent incidents")
        .addIntegerOption(opt =>
          opt.setName("count").setDescription("Number of recent actions to summarize (default 20)").setMinValue(5).setMaxValue(100),
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
        .addStringOption(opt => opt.setName("involved").setDescription("Users involved (comma-separated IDs)")),
    )
    .addSubcommand(sub =>
      sub.setName("help").setDescription("Show moderation commands and guidelines"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";

    switch (subcommand) {
      case "summary":
        return this.handleSummary(ctx);
      case "incident":
        return this.handleIncident(ctx);
      case "help":
        return this.handleHelp();
      default:
        return "Unknown subcommand.";
    }
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
            .setDescription("No recent incidents found.")
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
          .setDescription(`Analysis of the last ${logs.length} operational actions.`)
          .addFields(
            { name: "Results", value: `✅ ${successCount} success\n❌ ${failCount} failed\n🚫 ${cancelCount} cancelled`, inline: true },
            { name: "Top Actions", value: topActions || "None", inline: true },
            { name: "Recent Activity", value: recentEntries.join("\n") || "None", inline: false },
          )
          .setFooter({ text: "Aegis — Community AI Assistant" })
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

    if (!description || !severity) {
      return "Usage: `mod incident <description> <severity> [involved]`";
    }

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
          .setTitle(`Incident Logged — ${severity.toUpperCase()}`)
          .setDescription(description)
          .addFields(
            { name: "Reported By", value: `<@${ctx.userId}>`, inline: true },
            { name: "Severity", value: severity, inline: true },
            ...(involvedUsers.length
              ? [{ name: "Involved", value: involvedUsers.map((id: string) => `<@${id}>`).join(", "), inline: false }]
              : []),
          )
          .setTimestamp()
          .setFooter({ text: "Incident logged by Aegis — Community AI Assistant" }),
      ],
    };
  }

  private async handleHelp(): Promise<{ embeds: any[] }> {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Moderation Guidelines")
          .setDescription("Aegis assists moderators but never acts automatically.")
          .addFields(
            { name: "What Aegis Does", value: "• Summarize recent incidents\n• Log incidents with severity\n• Answer staff questions about procedures\n• Document incidents for review", inline: false },
            { name: "What Aegis Never Does", value: "• Take punitive action without moderator input\n• Delete content without approval\n• Replace moderator judgment", inline: false },
            { name: "Commands", value: "`mod summary` — Recent incident summary\n`mod incident` — Log an incident\n`mod help` — This message", inline: false },
          )
          .setFooter({ text: "All actions are logged and require moderator confirmation." })
          .setTimestamp(),
      ],
    };
  }
}
