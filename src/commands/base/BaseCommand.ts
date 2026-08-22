import type { CommandContext, ICommand } from "../types.js";
import type { ExecResult } from "../../types/index.js";
import type { Message, ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import { env } from "../../config/index.js";
import { logError } from "../../services/ErrorService.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { checkPermission } from "../../auth/AuthService.js";

export abstract class BaseCommand implements ICommand {
  abstract name: string;
  abstract description: string;

  aliases?: string[];
  requiredPermissions?: bigint[];
  ownerOnly = false;
  requiredPermissionLevel?: PermissionLevel;
  slashCommand?: any;

  abstract run(ctx: CommandContext): Promise<string | { embeds: any[] } | { files: any[]; content?: string } | null>;

  async execute(ctx: CommandContext): Promise<ExecResult> {
    try {
      if (ctx.type === "slash" && ctx.interaction && !ctx.interaction.replied && !ctx.interaction.deferred) {
        await ctx.interaction.deferReply();
      }

      const denied = "Access denied. Clearance level insufficient.";

      if (this.ownerOnly && ctx.userId !== env.ownerId) {
        return this.deny(ctx, denied);
      }

      if (this.requiredPermissionLevel !== undefined) {
        const hasAccess = await checkPermission(ctx.userId, this.requiredPermissionLevel);
        if (!hasAccess && ctx.userId !== env.ownerId) {
          return this.deny(ctx, denied);
        }
      }

      if (this.requiredPermissions && ctx.guildId) {
        if (ctx.type === "prefix" || ctx.type === "mention") {
          const member = ctx.message.member;
          if (member && "permissions" in member) {
            const perms = member.permissions as any;
            if (perms instanceof Map ? false : typeof perms.has === "function") {
              const hasAll = this.requiredPermissions.every((p: bigint) => perms.has(p));
              if (!hasAll) return { ok: false, error: denied };
            }
          }
        }
      }

      const result = await this.run(ctx);
      if (result === null) return { ok: true, data: undefined };

      if (typeof result === "string") {
        if (ctx.type === "slash" && ctx.interaction) {
          await ctx.interaction.editReply(result);
        } else {
          await ctx.message.reply(result);
        }
      } else if (typeof result === "object") {
        if (ctx.type === "slash" && ctx.interaction) {
          await ctx.interaction.editReply(result as any);
        } else {
          await ctx.message.reply(result as any);
        }
      }

      return { ok: true, data: undefined };
    } catch (error) {
      const errorId = await logError(error);
      const msg = `Operational error logged. Reference: \`${errorId}\``;

      try {
        if (ctx.type === "slash" && ctx.interaction) {
          const flags = MessageFlags.Ephemeral;
          if (ctx.interaction.replied || ctx.interaction.deferred) {
            await ctx.interaction.followUp({ content: msg, flags });
          } else {
            await ctx.interaction.reply({ content: msg, flags });
          }
        } else {
          await ctx.message.reply(msg);
        }
      } catch {
        // Interaction token expired or channel unavailable; nothing left to do.
      }

      return { ok: false, error: error instanceof Error ? error.message : String(error), errorId };
    }
  }

  private async deny(ctx: CommandContext, msg: string): Promise<ExecResult> {
    try {
      if (ctx.type === "slash" && ctx.interaction && (ctx.interaction.deferred || ctx.interaction.replied)) {
        await ctx.interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
      }
    } catch {
      // Best-effort notification only.
    }
    return { ok: false, error: msg };
  }

  protected unknownSubcommand(sub?: string): string {
    const options: any[] = Array.isArray(this.slashCommand?.options) ? this.slashCommand.options : [];
    const subs = options.filter((o) => o.type === 1);
    if (subs.length === 0) {
      return sub ? `Unknown subcommand: \`${sub}\`.` : "This command requires a subcommand.";
    }
    const header = sub
      ? `\`${sub}\` isn't a valid subcommand. Options:`
      : "This command needs a subcommand. Options:";
    const lines = subs.map((o) => `> \`${o.name}\` — ${o.description}`);
    return [header, ...lines].join("\n");
  }
}
