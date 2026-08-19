import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { env } from "../../config/index.js";
import { getPrefix } from "../../services/ConfigService.js";
import { getAllCommands } from "../CommandBus.js";
import { PermissionLevel, PERMISSION_LABELS } from "../../auth/PermissionLevel.js";

const CATEGORY_CONFIG: Record<number, { name: string; emoji: string; color: number }> = {
  [PermissionLevel.None]: { name: "General", emoji: "💬", color: 0x5865f2 },
  [PermissionLevel.Moderator]: { name: "Moderation", emoji: "🛡️", color: 0xf59e0b },
  [PermissionLevel.Administrator]: { name: "Admin", emoji: "⚙️", color: 0xef4444 },
  [PermissionLevel.Owner]: { name: "Owner", emoji: "👑", color: 0x9b59b6 },
};

interface CmdInfo {
  name: string;
  desc: string;
  sub: string[];
}

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

    const grouped: Map<number, CmdInfo[]> = new Map();

    for (const [name, cmd] of commands) {
      if (cmd.ownerOnly && !isOwner) continue;

      const permLevel = cmd.requiredPermissionLevel ?? PermissionLevel.None;

      if (permLevel >= PermissionLevel.Owner && !isOwner) continue;
      if (permLevel >= PermissionLevel.Moderator && !isMod && !isOwner) continue;
      if (permLevel >= PermissionLevel.Administrator && !isAdmin && !isOwner) continue;
      if (permLevel === PermissionLevel.Internal) continue;

      const sub: string[] = [];
      if (cmd.slashCommand) {
        const options = (cmd.slashCommand as any).options;
        if (options?.length) {
          for (const o of options) {
            if (o.type === 1) sub.push(o.name);
          }
        }
      }

      if (!grouped.has(permLevel)) grouped.set(permLevel, []);
      grouped.get(permLevel)!.push({ name, desc: cmd.description, sub });
    }

    const sorted = [...grouped.entries()].sort((a, b) => a[0] - b[0]);

    const accentColor = sorted.length > 0
      ? CATEGORY_CONFIG[sorted[0][0]]?.color ?? 0x5865f2
      : 0x5865f2;

    const embed = new EmbedBuilder()
      .setColor(accentColor)
      .setTitle("Aegis")
      .setDescription(
        "Your community AI assistant.\n" +
        `Type **${prefix}help <command>** to see how to use any command.`,
      );

    if (botUser) {
      embed.setThumbnail(botUser.displayAvatarURL());
    }

    for (const [permLevel, cmds] of sorted) {
      const cat = CATEGORY_CONFIG[permLevel] || CATEGORY_CONFIG[PermissionLevel.None];

      const lines = cmds.map(c => {
        const subPreview = c.sub.length > 0
          ? "\n      " + c.sub.map(s => `\`${s}\``).join(" · ")
          : "";
        return `**${prefix}${c.name}**\n      ${c.desc}${subPreview}`;
      });

      embed.addFields({
        name: `${cat.emoji} ${cat.name} \u200b`,
        value: lines.join("\n\n"),
        inline: false,
      });
    }

    let totalSubs = 0;
    for (const [, cmds] of grouped) {
      for (const c of cmds) totalSubs += c.sub.length;
    }

    const totalCmds = [...grouped.values()].reduce((sum, cmds) => sum + cmds.length, 0);

    embed.setFooter({
      text: `${totalCmds} commands · ${totalSubs} subcommands`,
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
        ? `Did you mean: ${similar.map(s => `\`${s}\``).join(", ")}?`
        : `Use \`${prefix}help\` to see all commands.`;

      return `Unknown command: \`${name}\`. ${hint}`;
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
            `\`${s.name}\` — ${s.description}`,
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

    embed.setFooter({ text: "Aegis — Command Details" }).setTimestamp();

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
