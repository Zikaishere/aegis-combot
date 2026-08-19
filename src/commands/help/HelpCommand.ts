import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { env } from "../../config/index.js";
import { getPrefix } from "../../services/ConfigService.js";
import { getAllCommands } from "../CommandBus.js";
import { PermissionLevel, PERMISSION_LABELS } from "../../auth/PermissionLevel.js";

const CATEGORY_CONFIG: Record<number, { name: string; emoji: string; color: number; desc: string }> = {
  [PermissionLevel.None]: { name: "General", emoji: "💬", color: 0x5865f2, desc: "Commands anyone can use" },
  [PermissionLevel.Moderator]: { name: "Moderation", emoji: "🛡️", color: 0xf59e0b, desc: "Staff moderation tools" },
  [PermissionLevel.Administrator]: { name: "Admin", emoji: "⚙️", color: 0xef4444, desc: "Server configuration" },
  [PermissionLevel.Owner]: { name: "Owner", emoji: "👑", color: 0x9b59b6, desc: "Bot owner only" },
};

export class HelpCommand extends BaseCommand {
  name = "help";
  description = "Show all commands and usage";

  slashCommand = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all commands and usage")
    .addStringOption(opt =>
      opt.setName("command").setDescription("Get details on a specific command"),
    );

  async run(ctx: CommandContext) {
    const prefix = ctx.type === "slash" ? "/" : await getPrefix(ctx.guildId);
    const isOwner = ctx.userId === env.ownerId;
    const isMod = await this.isModerator(ctx);
    const isAdmin = await this.isAdmin(ctx);

    const specificCmd = ctx.type === "slash"
      ? ctx.interaction?.options.getString("command")
      : ctx.args[0];

    if (specificCmd) {
      return this.showCommand(ctx, specificCmd, prefix);
    }

    const commands = getAllCommands();
    const botUser = ctx.type === "slash"
      ? ctx.interaction?.client.user
      : (ctx.message as any)?.client?.user;

    const grouped: Map<number, { name: string; emoji: string; color: number; desc: string; cmds: { name: string; desc: string; sub: string[] }[] }> = new Map();

    for (const [name, cmd] of commands) {
      if (cmd.ownerOnly && !isOwner) continue;

      const permLevel = cmd.requiredPermissionLevel ?? PermissionLevel.None;

      if (permLevel >= PermissionLevel.Owner && !isOwner) continue;
      if (permLevel >= PermissionLevel.Moderator && !isMod && !isOwner) continue;
      if (permLevel >= PermissionLevel.Administrator && !isAdmin && !isOwner) continue;
      if (permLevel === PermissionLevel.Internal) continue;

      const cat = CATEGORY_CONFIG[permLevel] || CATEGORY_CONFIG[PermissionLevel.None];
      if (!grouped.has(permLevel)) {
        grouped.set(permLevel, { ...cat, cmds: [] });
      }

      const sub: string[] = [];
      if (cmd.slashCommand) {
        const options = (cmd.slashCommand as any).options;
        if (options?.length) {
          const subCmds = options.filter((o: any) => o.type === 1);
          for (const s of subCmds) {
            sub.push(s.name);
          }
        }
      }

      grouped.get(permLevel)!.cmds.push({ name, desc: cmd.description, sub });
    }

    const sorted = [...grouped.entries()].sort((a, b) => a[0] - b[0]);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Aegis")
      .setDescription(
        "Your community AI assistant.\n" +
        `Use **${prefix}help <command>** for details on any command.\n` +
        "\u200b",
      );

    if (botUser) {
      embed.setThumbnail(botUser.displayAvatarURL());
    }

    for (const [, cat] of sorted) {
      const lines = cat.cmds.map(c => {
        const subList = c.sub.length > 0
          ? ` → _${c.sub.join(", ")}_`
          : "";
        return `\`${prefix}${c.name}\` — ${c.desc}${subList}`;
      });

      embed.addFields({
        name: `${cat.emoji} ${cat.name}`,
        value: lines.join("\n"),
        inline: false,
      });
    }

    const totalCmds = [...commands.values()].filter(c => {
      const p = c.requiredPermissionLevel ?? PermissionLevel.None;
      if (c.ownerOnly && !isOwner) return false;
      if (p >= PermissionLevel.Owner && !isOwner) return false;
      if (p === PermissionLevel.Internal) return false;
      return true;
    }).length;

    const totalSubs = [...commands.values()].reduce((sum, c) => {
      if (c.slashCommand) {
        const options = (c.slashCommand as any).options;
        if (options?.length) {
          return sum + options.filter((o: any) => o.type === 1).length;
        }
      }
      return sum;
    }, 0);

    embed.setFooter({
      text: `${totalCmds} commands · ${totalSubs} subcommands · Aegis`,
    }).setTimestamp();

    return { embeds: [embed] };
  }

  private async showCommand(ctx: CommandContext, name: string, prefix: string): Promise<string | { embeds: any[] }> {
    const commands = getAllCommands();
    const cmd = commands.get(name.toLowerCase());

    if (!cmd) {
      const similar = [...commands.keys()].filter(k =>
        k.startsWith(name.toLowerCase().slice(0, 3)),
      ).slice(0, 5);

      const hint = similar.length
        ? ` Did you mean: ${similar.map(s => `\`${s}\``).join(", ")}?`
        : ` Use \`${prefix}help\` to see all commands.`;

      return `Unknown command: \`${name}\`.` + hint;
    }

    const permLevel = cmd.requiredPermissionLevel ?? PermissionLevel.None;
    const cat = CATEGORY_CONFIG[permLevel] || CATEGORY_CONFIG[PermissionLevel.None];
    const label = PERMISSION_LABELS[permLevel] || "Unknown";

    const embed = new EmbedBuilder()
      .setColor(cat.color)
      .setTitle(`${cat.emoji} ${prefix}${cmd.name}`)
      .setDescription(cmd.description || "No description provided.");

    embed.addFields(
      { name: "Category", value: `${cat.emoji} ${cat.name}`, inline: true },
      { name: "Permission", value: label, inline: true },
    );

    if (cmd.aliases?.length) {
      embed.addFields({
        name: "Aliases",
        value: cmd.aliases.map(a => `\`${prefix}${a}\``).join(", "),
        inline: true,
      });
    }

    if (cmd.slashCommand) {
      const options = (cmd.slashCommand as any).options;
      if (options?.length) {
        const subCmds = options.filter((o: any) => o.type === 1);
        if (subCmds.length) {
          const subLines = subCmds.map((s: any) =>
            `**${s.name}** — ${s.description}`,
          );

          embed.addFields({
            name: "Subcommands",
            value: subLines.join("\n"),
            inline: false,
          });
        }

        const opts = options.filter((o: any) => o.type !== 1 && o.type !== 2);
        if (opts.length) {
          const optLines = opts.map((o: any) =>
            `\`${o.name}\`${o.required ? " *(required)*" : ""} — ${o.description || "No description"}`,
          );

          embed.addFields({
            name: "Options",
            value: optLines.join("\n"),
            inline: false,
          });
        }
      }
    }

    embed.setFooter({ text: `Aegis — Command Details` }).setTimestamp();

    return { embeds: [embed] };
  }

  private async isModerator(ctx: CommandContext): Promise<boolean> {
    if (ctx.userId === env.ownerId) return true;
    if (!ctx.guildId) return false;

    if (ctx.type === "slash" && ctx.interaction?.member) {
      const perms = (ctx.interaction.member as any).permissions;
      if (perms && typeof perms.has === "function") {
        return perms.has(PermissionFlagsBits.KickMembers) || perms.has(PermissionFlagsBits.BanMembers);
      }
    }

    if (ctx.type === "prefix" || ctx.type === "mention") {
      const perms = (ctx.message.member as any)?.permissions;
      if (perms && typeof perms.has === "function") {
        return perms.has(PermissionFlagsBits.KickMembers) || perms.has(PermissionFlagsBits.BanMembers);
      }
    }

    return false;
  }

  private async isAdmin(ctx: CommandContext): Promise<boolean> {
    if (ctx.userId === env.ownerId) return true;
    if (!ctx.guildId) return false;

    if (ctx.type === "slash" && ctx.interaction?.member) {
      const perms = (ctx.interaction.member as any).permissions;
      if (perms && typeof perms.has === "function") {
        return perms.has(PermissionFlagsBits.Administrator);
      }
    }

    if (ctx.type === "prefix" || ctx.type === "mention") {
      const perms = (ctx.message.member as any)?.permissions;
      if (perms && typeof perms.has === "function") {
        return perms.has(PermissionFlagsBits.Administrator);
      }
    }

    return false;
  }
}
