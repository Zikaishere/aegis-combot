import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { env } from "../../config/index.js";
import { getPrefix } from "../../services/ConfigService.js";
import { getAllCommands } from "../CommandBus.js";

const CATEGORIES = [
  {
    name: "General",
    emoji: "💬",
    commands: ["help", "ping", "setup", "profile", "memory"],
  },
  {
    name: "Configuration",
    emoji: "⚙️",
    commands: ["config", "automod", "welcome", "reactionrole", "ticket", "verify", "honeypot", "embed"],
  },
  {
    name: "Moderation",
    emoji: "🛡️",
    commands: ["ban", "kick", "mute", "warn", "warnings", "purge", "lockdown", "bans", "mod", "modlog"],
  },
  {
    name: "Admin",
    emoji: "👑",
    commands: ["auth", "logs", "auditlog", "owner"],
  },
];

const DESCRIPTIONS: Record<string, string> = {
  help: "Show this help menu",
  ping: "Check bot latency",
  setup: "Interactive setup wizard for all features",
  profile: "View a user's AI profile",
  memory: "Store and recall information",
  config: "View or change bot settings",
  automod: "Configure auto-moderation (spam, links, profanity)",
  welcome: "Set up welcome and goodbye messages",
  reactionrole: "Create reaction role messages",
  ticket: "Set up a support ticket system",
  verify: "Set up user verification",
  honeypot: "Set up trap channels for compromised accounts",
  embed: "Create and send custom embeds",
  ban: "Ban a user from the server",
  kick: "Kick a user from the server",
  mute: "Timeout a user",
  warn: "Issue a warning to a user",
  warnings: "View a user's warnings",
  purge: "Bulk delete messages",
  lockdown: "Lock/unlock channels during raids",
  bans: "View all banned users",
  mod: "Moderator assistant",
  modlog: "Set the moderation log channel",
  auth: "Manage permission levels",
  logs: "View operational logs",
  auditlog: "View server audit trail",
  owner: "Owner-only commands",
};

export class HelpCommand extends BaseCommand {
  name = "help";
  description = "Shows Aegis command information";

  slashCommand = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows Aegis command information")
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

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Aegis")
      .setDescription(
        "AI-powered community bot for Discord.\n" +
        "Type `" + prefix + "help <command>` for details on any command.",
      )
      .setThumbnail(ctx.type === "slash" ? ctx.interaction?.client.user.displayAvatarURL() || null : ctx.message.client.user.displayAvatarURL() || null);

    for (const category of CATEGORIES) {
      const cmdNames = category.commands.filter(name => {
        if (!commands.has(name)) return false;
        const cmd = commands.get(name)!;
        if (cmd.ownerOnly && !isOwner) return false;
        if (cmd.requiredPermissionLevel !== undefined && cmd.requiredPermissionLevel >= 2 && !isMod) return false;
        return true;
      });

      if (cmdNames.length === 0) continue;

      const lines = cmdNames.map(name => {
        const cmd = commands.get(name)!;
        const desc = DESCRIPTIONS[name] || cmd.description;
        return `\`${prefix}${name}\` — ${desc}`;
      });

      embed.addFields({
        name: `${category.emoji} ${category.name}`,
        value: lines.join("\n"),
        inline: false,
      });
    }

    embed.setFooter({ text: "Aegis — Community AI Bot" }).setTimestamp();

    return { embeds: [embed] };
  }

  private async showCommand(ctx: CommandContext, name: string, prefix: string): Promise<string | { embeds: any[] }> {
    const commands = getAllCommands();
    const cmd = commands.get(name.toLowerCase());

    if (!cmd) {
      return `Unknown command: \`${name}\`. Use \`${prefix}help\` to see all commands.`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${prefix}${cmd.name}`)
      .setDescription(cmd.description);

    if (cmd.aliases?.length) {
      embed.addFields({
        name: "Aliases",
        value: cmd.aliases.map(a => `\`${prefix}${a}\``).join(", "),
        inline: true,
      });
    }

    if (cmd.requiredPermissionLevel !== undefined) {
      const levels = ["Everyone", "Trusted", "Moderator", "Administrator", "Owner"];
      embed.addFields({
        name: "Permission Level",
        value: levels[cmd.requiredPermissionLevel] || "Unknown",
        inline: true,
      });
    }

    if (cmd.slashCommand) {
      const options = (cmd.slashCommand as any).options;
      if (options?.length) {
        const subCmds = options.filter((o: any) => o.type === 1 || o.type === 2);
        if (subCmds.length) {
          embed.addFields({
            name: "Subcommands",
            value: subCmds.map((s: any) => `\`${prefix}${cmd.name} ${s.name}\` — ${s.description}`).join("\n"),
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
