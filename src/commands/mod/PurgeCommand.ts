import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { logModAction } from "./ModLogService.js";

export class PurgeCommand extends BaseCommand {
  name = "purge";
  description = "Bulk delete messages from a channel";
  requiredPermissionLevel = PermissionLevel.Moderator;
  requiredPermissions = [PermissionFlagsBits.ManageMessages];

  slashCommand = new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk delete messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => opt.setName("count").setDescription("Number of messages to delete (1-100)").setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(opt => opt.setName("user").setDescription("Only delete messages from this user"));

  async run(ctx: CommandContext): Promise<string> {
    const count = ctx.type === "slash"
      ? ctx.interaction?.options.getInteger("count", true)
      : parseInt(ctx.args[0]);

    const targetUser = ctx.type === "slash"
      ? ctx.interaction?.options.getUser("user")
      : ctx.message.mentions.users.first();

    if (!count || count < 1 || count > 100) return "Provide a count between 1 and 100.";

    const channel = ctx.message.channel;
    if (!channel || !("messages" in channel)) return "This command can only be used in text channels.";

    let deleted = 0;
    let remaining = count;

    while (remaining > 0) {
      const fetchCount = Math.min(remaining, 100);
      const messages = await (channel as any).messages.fetch({ limit: fetchCount });

      let filtered = Array.from(messages.values());
      if (targetUser) {
        filtered = filtered.filter((m: any) => m.author.id === targetUser.id);
      }

      if (filtered.length === 0) break;

      const bulk = await (channel as any).bulkDelete(filtered, true);
      deleted += bulk.size;
      remaining -= fetchCount;

      if (bulk.size < fetchCount) break;
    }

    await logModAction(ctx.guildId!, {
      action: "purge",
      targetId: targetUser?.id ?? "all",
      moderatorId: ctx.userId,
      reason: `Deleted ${deleted} messages${targetUser ? ` from <@${targetUser.id}>` : ""}`,
      timestamp: new Date(),
    });

    return `Deleted ${deleted} message(s).${targetUser ? ` (filtered to <@${targetUser.id}>)` : ""}`;
  }
}
