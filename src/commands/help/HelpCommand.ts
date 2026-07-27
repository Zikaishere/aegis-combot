import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext, ICommand } from "../types.js";
import type { BaseAbility } from "../../abilities/BaseAbility.js";
import { env } from "../../config/index.js";
import { getPrefix } from "../../services/ConfigService.js";
import { getAllCommands } from "../CommandBus.js";
import { getRegisteredAbilities } from "../../abilities/AbilityRegistry.js";

export class HelpCommand extends BaseCommand {
  name = "help";
  description = "Shows Blaze operational command information";

  slashCommand = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows Blaze operational command information");

  async run(ctx: CommandContext) {
    const prefix = ctx.type === "slash" ? "/" : await getPrefix(ctx.guildId);
    const isOwner = ctx.userId === env.ownerId;
    const isMod = await this.isModerator(ctx);

    const embed = new EmbedBuilder()
      .setColor(0x00b4d8)
      .setTitle("Blaze — Command Registry")
      .setDescription("Behavioral Logic & Anomaly Zone Engine — Operational controls");

    const commands = getAllCommands();
    const abilities = getRegisteredAbilities();

    const general: string[] = [];
    const modCmds: string[] = [];
    const ownerCmds: string[] = [];

    const modPerms = [PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers];

    for (const [, cmd] of commands) {
      if (cmd.name === "help") continue;

      let entry = `\`${prefix}${cmd.name}\` — ${cmd.description}`;
      if (cmd.aliases?.length) {
        entry += ` (alias: ${cmd.aliases.map(a => `\`${prefix}${a}\``).join(", ")})`;
      }

      if (cmd.ownerOnly) {
        ownerCmds.push(entry);
      } else if (cmd.requiredPermissions?.some(p => modPerms.includes(p))) {
        modCmds.push(entry);
      } else {
        general.push(entry);
      }
    }

    embed.addFields({ name: "💬 General", value: general.join("\n") || "None", inline: false });

    if (abilities.length) {
      const abilityList = abilities.map(a =>
        `\`${a.name}\` — ${a.description}`
      );
      embed.addFields({ name: "🔧 Abilities", value: abilityList.join("\n"), inline: false });
    }

    if (isMod && modCmds.length) {
      embed.addFields({ name: "🛡️ Moderation", value: modCmds.join("\n"), inline: false });
    }

    if (isOwner && ownerCmds.length) {
      embed.addFields({ name: "⚙️ Owner", value: ownerCmds.join("\n"), inline: false });
    }

    embed.setFooter({ text: "Blaze AI • Project Veil — Behavioral Logic & Anomaly Zone Engine" });

    return { embeds: [embed] };
  }

  private async isModerator(ctx: CommandContext): Promise<boolean> {
    if (ctx.userId === env.ownerId) return true;
    if (!ctx.guildId) return false;

    if (ctx.type === "slash" && ctx.interaction?.member) {
      const perms = (ctx.interaction.member as any).permissions;
      if (perms && typeof perms.has === "function") {
        return perms.has(1n << 2n) || perms.has(1n << 3n);
      }
    }

    if (ctx.type === "prefix" || ctx.type === "mention") {
      if (ctx.message.member && "permissions" in ctx.message.member) {
        const perms = (ctx.message.member as any).permissions;
        if (perms && typeof perms.has === "function") {
          return perms.has(1n << 2n) || perms.has(1n << 3n);
        }
      }
    }

    return false;
  }
}
