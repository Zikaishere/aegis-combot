import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import WelcomeConfig from "../../models/WelcomeConfig.js";

function replaceVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

export class GoodbyeCommand extends BaseCommand {
  name = "goodbye";
  description = "Configure goodbye messages";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("goodbye")
    .setDescription("Configure goodbye messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("config").setDescription("View current goodbye configuration"),
    )
    .addSubcommand(sub =>
      sub
        .setName("channel")
        .setDescription("Set the goodbye channel")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Goodbye channel").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable goodbye messages")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("embed")
        .setDescription("Set the goodbye embed")
        .addStringOption(opt => opt.setName("title").setDescription("Embed title"))
        .addStringOption(opt => opt.setName("description").setDescription("Embed description. Use {user}, {server}, {membercount}"))
        .addStringOption(opt => opt.setName("color").setDescription("Hex color (e.g. ff1744)"))
        .addStringOption(opt => opt.setName("image").setDescription("Image URL"))
        .addStringOption(opt => opt.setName("footer").setDescription("Footer text")),
    )
    .addSubcommand(sub =>
      sub.setName("test").setDescription("Test the goodbye message"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";
    if (!ctx.guildId) return "Server only.";

    switch (subcommand) {
      case "config": return this.handleConfig(ctx);
      case "channel": return this.handleChannel(ctx);
      case "toggle": return this.handleToggle(ctx);
      case "embed": return this.handleEmbed(ctx);
      case "test": return this.handleTest(ctx);
      default: return "Unknown subcommand.";
    }
  }

  private async getConfig(guildId: string) {
    let config = await WelcomeConfig.findOne({ guildId });
    if (!config) config = await WelcomeConfig.create({ guildId });
    return config;
  }

  private async handleConfig(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const config = await this.getConfig(ctx.guildId!);
    const g = config.goodbye;

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0xff1744)
          .setTitle("Goodbye Configuration")
          .addFields(
            { name: "Status", value: g.enabled ? "Enabled" : "Disabled", inline: true },
            { name: "Channel", value: g.channelId ? `<#${g.channelId}>` : "Not set", inline: true },
            { name: "Title", value: g.embed.title || "Default", inline: true },
            { name: "Variables", value: `{user} — username\n{server} — server name\n{membercount} — member count`, inline: false },
          )
          .setFooter({ text: "Aegis — Goodbye System" })
          .setTimestamp(),
      ],
    };
  }

  private async handleChannel(ctx: CommandContext): Promise<string> {
    const channel = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel")
      : null;

    if (!channel) return "Mention a channel.";

    const config = await this.getConfig(ctx.guildId!);
    config.goodbye.channelId = channel.id;
    await config.save();

    return `Goodbye channel set to <#${channel.id}>.`;
  }

  private async handleToggle(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null) return "Provide `true` or `false`.";

    const config = await this.getConfig(ctx.guildId!);
    config.goodbye.enabled = !!enabled;
    await config.save();

    return `Goodbye ${enabled ? "enabled" : "disabled"}.`;
  }

  private async handleEmbed(ctx: CommandContext): Promise<string> {
    if (ctx.type !== "slash") return "Use the slash command for this.";

    const config = await this.getConfig(ctx.guildId!);
    const section = config.goodbye;

    const title = ctx.interaction?.options.getString("title");
    const description = ctx.interaction?.options.getString("description");
    const color = ctx.interaction?.options.getString("color");
    const image = ctx.interaction?.options.getString("image");
    const footer = ctx.interaction?.options.getString("footer");

    if (title) section.embed.title = title;
    if (description) section.embed.description = description;
    if (color) section.embed.color = parseInt(color, 16) || 0xff1744;
    if (image) section.embed.imageUrl = image;
    if (footer) section.embed.footer = footer;

    await config.save();
    return "Goodbye embed updated.";
  }

  private async handleTest(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const config = await this.getConfig(ctx.guildId!);
    const section = config.goodbye;

    const vars = {
      user: ctx.interaction?.user.username ?? (ctx.message as any)?.author?.username ?? "Unknown",
      username: ctx.interaction?.user.username ?? (ctx.message as any)?.author?.username ?? "Unknown",
      server: (ctx.interaction?.guild ?? ctx.message?.guild)?.name || "Server",
      membercount: String((ctx.interaction?.guild ?? ctx.message?.guild)?.memberCount || 0),
    };

    const embed = new EmbedBuilder()
      .setColor(section.embed.color || 0xff1744);

    if (section.embed.title) embed.setTitle(replaceVars(section.embed.title, vars));
    if (section.embed.description) embed.setDescription(replaceVars(section.embed.description, vars));
    if (section.embed.imageUrl) embed.setImage(section.embed.imageUrl);
    if (section.embed.thumbnailUrl) embed.setThumbnail(section.embed.thumbnailUrl);
    if (section.embed.footer) embed.setFooter({ text: replaceVars(section.embed.footer, vars) });
    if (!section.embed.title && !section.embed.description) {
      embed.setTitle("Goodbye!");
      embed.setDescription(replaceVars("Farewell, {user}! We'll miss you.", vars));
    }

    return { embeds: [embed] };
  }
}
