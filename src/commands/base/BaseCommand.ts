import type { CommandContext, ICommand } from "../types.js";
import type { ExecResult } from "../../types/index.js";
import type { Message, ChatInputCommandInteraction } from "discord.js";
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
      if (this.ownerOnly && ctx.userId !== env.ownerId) {
        return { ok: false, error: "Access denied. Clearance level insufficient." };
      }

      if (this.requiredPermissionLevel !== undefined) {
        const hasAccess = await checkPermission(ctx.userId, this.requiredPermissionLevel);
        if (!hasAccess && ctx.userId !== env.ownerId) {
          return { ok: false, error: "Access denied. Clearance level insufficient." };
        }
      }

      if (this.requiredPermissions && ctx.guildId) {
        if (ctx.type === "prefix" || ctx.type === "mention") {
          const member = ctx.message.member;
          if (member && "permissions" in member) {
            const perms = member.permissions as any;
            if (perms instanceof Map ? false : typeof perms.has === "function") {
              const hasAll = this.requiredPermissions.every((p: bigint) => perms.has(p));
              if (!hasAll) return { ok: false, error: "Access denied. Clearance level insufficient." };
            }
          }
        }
      }

      const result = await this.run(ctx);
      if (result === null) return { ok: true, data: undefined };

      if (typeof result === "string") {
        if (ctx.type === "slash" && ctx.interaction) {
          await ctx.interaction.reply(result);
        } else {
          await ctx.message.reply(result);
        }
      } else if (typeof result === "object") {
        if (ctx.type === "slash" && ctx.interaction) {
          await ctx.interaction.reply(result as any);
        } else {
          await ctx.message.reply(result as any);
        }
      }

      return { ok: true, data: undefined };
    } catch (error) {
      const errorId = await logError(error);
      const msg = `Operational error logged. Reference: \`${errorId}\``;

      if (ctx.type === "slash" && ctx.interaction) {
        const replied = (ctx.interaction as any).replied || (ctx.interaction as any).deferred;
        if (replied) {
          await ctx.interaction.followUp({ content: msg, ephemeral: true });
        } else {
          await ctx.interaction.reply({ content: msg, ephemeral: true });
        }
      } else {
        await ctx.message.reply(msg);
      }

      return { ok: false, error: error instanceof Error ? error.message : String(error), errorId };
    }
  }
}
