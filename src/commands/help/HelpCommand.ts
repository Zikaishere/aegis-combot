import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { env } from "../../config/index.js";
import { getPrefix } from "../../services/ConfigService.js";
import { getAllCommands } from "../CommandBus.js";
import { PermissionLevel, PERMISSION_LABELS } from "../../auth/PermissionLevel.js";

const CATEGORY_CONFIG: Record<number, { name: string; emoji: string; color: number; keywords: string[] }> = {
  [PermissionLevel.None]: { name: "General", emoji: "💬", color: 0x5865f2, keywords: ["general"] },
  [PermissionLevel.Moderator]: { name: "Moderation", emoji: "🛡️", color: 0xf59e0b, keywords: ["mod", "moderation", "staff"] },
  [PermissionLevel.Administrator]: { name: "Admin", emoji: "⚙️", color: 0xef4444, keywords: ["admin", "setup", "config", "configuration"] },
  [PermissionLevel.Owner]: { name: "Owner", emoji: "👑", color: 0x9b59b6, keywords: ["owner"] },
};

interface CmdInfo {
  name: string;
  desc: string;
  permLevel: number;
  sub: { name: string; desc: string }[];
}

export class HelpCommand extends BaseCommand {
  name = "help";
  description = "Show all commands and usage";

  slashCommand = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all commands and usage")
    .addStringOption(opt =>
      opt.setName("query").setDescription("Category name or command name"),
    );

  async run(ctx: CommandContext) {
    const prefix = ctx.type === "slash" ? "/" : await getPrefix(ctx.guildId);
    const isOwner = ctx.userId === env.ownerId;
    const isMod = await this.isModerator(ctx);
    const isAdmin = await this.isAdmin(ctx);

    const query = ctx.type === "slash"
      ? ctx.interaction?.options.getString("query")
      : ctx.args[0];

    if (!query) return this.showOverview(ctx, prefix, isOwner, isMod, isAdmin);

    const catPerm = this.resolveCategory(query);
    if (catPerm !== null) {
      return this.showCategory(ctx, prefix, catPerm, isOwner, isMod, isAdmin);
    }

    return this.showCommand(ctx, query, prefix);
  }

  private resolveCategory(query: string): number | null {
    const lower = query.toLowerCase();
    for (const [perm, cat] of Object.entries(CATEGORY_CONFIG)) {
      if (cat.keywords.some(k => lower === k || lower.startsWith(k))) {
        return Number(perm);
      }
    }
    return null;
  }

  private getVisibleCommands(isOwner: boolean, isMod: boolean, isAdmin: boolean): CmdInfo[] {
    const commands = getAllCommands();
    const result: CmdInfo[] = [];

    for (const [, cmd] of commands) {
      const permLevel = cmd.requiredPermissionLevel ?? PermissionLevel.None;

      if (permLevel === PermissionLevel.Owner) continue;
      if (cmd.ownerOnly) continue;
      if (permLevel === PermissionLevel.Internal) continue;

      if (permLevel >= PermissionLevel.Moderator && !isMod && !isOwner) continue;
      if (permLevel >= PermissionLevel.Administrator && !isAdmin && !isOwner) continue;

      const sub: { name: string; desc: string }[] = [];
      if (cmd.slashCommand) {
        const options = (cmd.slashCommand as any).options;
        if (options?.length) {
          for (const o of options) {
            if (o.type === 1) sub.push({ name: o.name, desc: o.description });
          }
        }
      }

      result.push({ name: cmd.name, desc: cmd.description, permLevel, sub });
    }

    return result;
  }

  private async showOverview(ctx: CommandContext, prefix: string, isOwner: boolean, isMod: boolean, isAdmin: boolean) {
    const cmds = this.getVisibleCommands(isOwner, isMod, isAdmin);
    const botUser = ctx.type === "slash"
      ? ctx.interaction?.client.user
      : (ctx.message as any)?.client?.user;

    const grouped = new Map<number, number>();
    for (const cmd of cmds) {
      grouped.set(cmd.permLevel, (grouped.get(cmd.permLevel) ?? 0) + 1);
    }

    const sorted = [...grouped.entries()].sort((a, b) => a[0] - b[0]);

    const CATEGORY_DESC: Record<number, string> = {
      [PermissionLevel.None]: "Commands anyone can use",
      [PermissionLevel.Moderator]: "Staff moderation tools",
      [PermissionLevel.Administrator]: "Server configuration and setup",
      [PermissionLevel.Owner]: "Bot owner only",
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Aegis")
      .setDescription(
        "Your community AI assistant.\n\n" +
        "Use **" + prefix + "help <category>** to browse a category\n" +
        "Use **" + prefix + "help <command>** to see command details",
      );

    if (botUser) embed.setThumbnail(botUser.displayAvatarURL());

    for (const [permLevel, count] of sorted) {
      const cat = CATEGORY_CONFIG[permLevel] || CATEGORY_CONFIG[PermissionLevel.None];
      const desc = CATEGORY_DESC[permLevel] || "Miscellaneous";
      const keywords = cat.keywords.slice(0, 2).join(" / ");

      embed.addFields({
        name: `${cat.emoji} ${cat.name}`,
        value: `${desc} · ${count} commands\n*${prefix}help ${keywords}*`,
        inline: true,
      });
    }

    embed.setFooter({ text: `${cmds.length} commands total` }).setTimestamp();

    return { embeds: [embed] };
  }

  private async showCategory(ctx: CommandContext, prefix: string, permLevel: number, isOwner: boolean, isMod: boolean, isAdmin: boolean) {
    const cmds = this.getVisibleCommands(isOwner, isMod, isAdmin).filter(c => c.permLevel === permLevel);
    const cat = CATEGORY_CONFIG[permLevel] || CATEGORY_CONFIG[PermissionLevel.None];

    if (cmds.length === 0) {
      return `No commands available in the **${cat.name}** category.`;
    }

    const embed = new EmbedBuilder()
      .setColor(cat.color)
      .setTitle(`${cat.emoji} ${cat.name}`)
      .setDescription(`All commands in the **${cat.name}** category.`);

    for (const cmd of cmds) {
      let value = cmd.desc;
      if (cmd.sub.length > 0) {
        value += "\n" + cmd.sub.map(s => `> \`${s.name}\` — ${s.desc}`).join("\n");
      }
      embed.addFields({ name: `${prefix}${cmd.name}`, value, inline: false });
    }

    embed.setFooter({ text: `${cmds.length} commands · ${prefix}help <command> for details` }).setTimestamp();

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
          embed.addFields({
            name: "Subcommands",
            value: subCmds.map((s: any) => `\`${s.name}\` — ${s.description}`).join("\n"),
            inline: false,
          });
        }

        const opts = options.filter((o: any) => o.type !== 1 && o.type !== 2);
        if (opts.length) {
          embed.addFields({
            name: "Options",
            value: opts.map((o: any) =>
              `\`${o.name}\`${o.required ? " *(required)*" : ""} — ${o.description || "No description"}`,
            ).join("\n"),
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
