import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { getRecentActions, getActionsByUser, getActionsByType } from "../../safety/ActionLogger.js";

export class LogsCommand extends BaseCommand {
  name = "logs";
  description = "View operational action logs";
  ownerOnly = true;

  slashCommand = new SlashCommandBuilder()
    .setName("logs")
    .setDescription("View operational action logs")
    .addSubcommand(sub =>
      sub
        .setName("recent")
        .setDescription("Show recent actions")
        .addIntegerOption(opt =>
          opt.setName("count").setDescription("Number of entries (default 10)").setMinValue(1).setMaxValue(50),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("user")
        .setDescription("Show actions by a specific user")
        .addStringOption(opt =>
          opt.setName("user").setDescription("Discord user ID").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("action")
        .setDescription("Show actions of a specific type")
        .addStringOption(opt =>
          opt.setName("type").setDescription("Action type to search for").setRequired(true),
        ),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided. Use `recent`, `user`, or `action`.";

    let logs: any[] = [];

    switch (subcommand) {
      case "recent": {
        const count = ctx.type === "slash"
          ? ctx.interaction?.options.getInteger("count") ?? 10
          : parseInt(ctx.args[1]) || 10;
        logs = await getRecentActions(ctx.guildId ?? "", count);
        break;
      }
      case "user": {
        const userId: string | undefined = ctx.type === "slash"
          ? (ctx.interaction?.options.getString("user", true) ?? undefined)
          : ctx.args[1];
        if (!userId) return "Usage: `logs user <userId>`";
        logs = await getActionsByUser(userId, 25);
        break;
      }
      case "action": {
        const actionType: string | undefined = ctx.type === "slash"
          ? (ctx.interaction?.options.getString("type", true) ?? undefined)
          : ctx.args[1];
        if (!actionType) return "Usage: `logs action <type>`";
        logs = await getActionsByType(actionType, ctx.guildId ?? undefined, 25);
        break;
      }
      default:
        return "Unknown subcommand.";
    }

    if (logs.length === 0) {
      return "No action logs found.";
    }

    const lines = logs.map((log: any) => {
      const time = new Date(log.timestamp).toLocaleString();
      const status = log.result === "success" ? "✅" : log.result === "failure" ? "❌" : log.result === "cancelled" ? "🚫" : "⏳";
      return `${status} \`${time}\` — **${log.action}** by <@${log.userId}> → ${log.affectedResources.join(", ") || "none"}`;
    });

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Operational Action Log")
          .setDescription(lines.join("\n"))
          .setFooter({ text: `Showing ${logs.length} entries` })
          .setTimestamp(),
      ],
    };
  }
}
