import { SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel, PERMISSION_LABELS } from "../../auth/PermissionLevel.js";
import { setPermission, removePermission, getPermissionLevel } from "../../auth/AuthService.js";

export class AuthCommand extends BaseCommand {
  name = "auth";
  description = "Manage operative clearance levels";
  ownerOnly = true;

  slashCommand = new SlashCommandBuilder()
    .setName("auth")
    .setDescription("Manage operative clearance levels")
    .addSubcommand(sub =>
      sub
        .setName("set")
        .setDescription("Assign a clearance level to an operative")
        .addStringOption(opt =>
          opt.setName("user").setDescription("Discord user ID").setRequired(true),
        )
        .addIntegerOption(opt =>
          opt
            .setName("level")
            .setDescription("Clearance level")
            .setRequired(true)
            .addChoices(
              { name: "0 - Operative", value: 0 },
              { name: "1 - Moderator", value: 1 },
              { name: "2 - Administrator", value: 2 },
              { name: "3 - Director (Owner)", value: 3 },
            ),
        )
        .addStringOption(opt =>
          opt.setName("reason").setDescription("Reason for assignment"),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Revoke an operative's clearance")
        .addStringOption(opt =>
          opt.setName("user").setDescription("Discord user ID").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("check")
        .setDescription("Check an operative's clearance level")
        .addStringOption(opt =>
          opt.setName("user").setDescription("Discord user ID").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub.setName("list").setDescription("Show all assigned clearance levels"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided. Use `set`, `remove`, `check`, or `list`.";

    switch (subcommand) {
      case "set":
        return this.handleSet(ctx);
      case "remove":
        return this.handleRemove(ctx);
      case "check":
        return this.handleCheck(ctx);
      case "list":
        return this.handleList(ctx);
      default:
        return "Unknown subcommand. Use `set`, `remove`, `check`, or `list`.";
    }
  }

  private async handleSet(ctx: CommandContext): Promise<string> {
    const targetId: string | undefined = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("user", true) ?? undefined)
      : ctx.args[1];

    const level: number | undefined = ctx.type === "slash"
      ? (ctx.interaction?.options.getInteger("level", true) ?? undefined)
      : (ctx.args[2] ? parseInt(ctx.args[2]) : undefined);

    const reason: string | undefined = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("reason") ?? undefined)
      : ctx.args.slice(3).join(" ") || undefined;

    if (!targetId || level === undefined || level === null) {
      return "Usage: `auth set <userId> <level> [reason]`";
    }

    if (level < 0 || level > 3) {
      return "Invalid level. Use 0 (Operative), 1 (Moderator), 2 (Administrator), or 3 (Director).";
    }

    const targetLevel = await getPermissionLevel(targetId);
    if (targetLevel === PermissionLevel.Owner && ctx.userId !== targetId) {
      return "Cannot modify the Director's clearance level.";
    }

    await setPermission(targetId, level as PermissionLevel, ctx.userId, reason);

    return `Clearance assigned. User \`${targetId}\` is now **${PERMISSION_LABELS[level as PermissionLevel]}**.${reason ? ` Reason: ${reason}` : ""}`;
  }

  private async handleRemove(ctx: CommandContext): Promise<string> {
    const targetId: string | undefined = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("user", true) ?? undefined)
      : ctx.args[1];

    if (!targetId) return "Usage: `auth remove <userId>`";

    const targetLevel = await getPermissionLevel(targetId);
    if (targetLevel === PermissionLevel.Owner) {
      return "Cannot revoke the Director's clearance level.";
    }

    await removePermission(targetId);
    return `Clearance revoked for user \`${targetId}\`. Reverted to Operative.`;
  }

  private async handleCheck(ctx: CommandContext): Promise<string> {
    const targetId: string | undefined = ctx.type === "slash"
      ? (ctx.interaction?.options.getString("user", true) ?? undefined)
      : ctx.args[1];

    if (!targetId) return "Usage: `auth check <userId>`";

    const level = await getPermissionLevel(targetId);
    return `User \`${targetId}\` — Clearance: **${PERMISSION_LABELS[level]}** (Level ${level})`;
  }

  private async handleList(_ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const PermissionRecord = (await import("../../auth/models/PermissionRecord.js")).default;
    const records = await PermissionRecord.find().sort({ level: -1 }).lean().exec();

    if (records.length === 0) {
      return "No custom clearance assignments found. Owner clearance is implicit.";
    }

    const lines = records.map(
      (r: any) => `\`${r.discordId}\` — **${PERMISSION_LABELS[r.level as PermissionLevel]}** (assigned by ${r.assignedBy})`,
    );

    return {
      embeds: [
        {
          title: "Clearance Registry",
          description: lines.join("\n"),
          color: 0x00b4d8,
        },
      ],
    };
  }
}
