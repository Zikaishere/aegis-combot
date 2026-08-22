import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import TempVCConfig from "../../models/TempVCConfig.js";

export class TempVCCommand extends BaseCommand {
  name = "tempvc";
  description = "Configure temporary voice channels (join to create)";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("tempvc")
    .setDescription("Configure temporary voice channels")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable temporary voice channels")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("lobby")
        .setDescription("Set the lobby channel (users join this to create a temp channel)")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Voice channel to use as lobby").addChannelTypes(ChannelType.GuildVoice).setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("category")
        .setDescription("Set the category for temp channels")
        .addChannelOption(opt =>
          opt.setName("category").setDescription("Category to create temp channels in").addChannelTypes(ChannelType.GuildCategory).setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("name")
        .setDescription("Set the channel name template")
        .addStringOption(opt =>
          opt.setName("template").setDescription("Name template ({username} or {displayname})").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("bitrate")
        .setDescription("Set the bitrate for temp channels")
        .addIntegerOption(opt =>
          opt.setName("kbps").setDescription("Bitrate in kbps (8-384)").setMinValue(8).setMaxValue(384).setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("limit")
        .setDescription("Set the user limit for temp channels (0 = unlimited)")
        .addIntegerOption(opt =>
          opt.setName("limit").setDescription("User limit (0 = unlimited)").setMinValue(0).setMaxValue(99).setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View current temp VC configuration"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Server only.";

    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    switch (subcommand) {
      case "toggle": return this.handleToggle(ctx);
      case "lobby": return this.handleLobby(ctx);
      case "category": return this.handleCategory(ctx);
      case "name": return this.handleName(ctx);
      case "bitrate": return this.handleBitrate(ctx);
      case "limit": return this.handleLimit(ctx);
      case "status": return this.handleStatus(ctx);
      default: return this.unknownSubcommand(subcommand);
    }
  }

  private async getConfig(guildId: string) {
    let config = await TempVCConfig.findOne({ guildId });
    if (!config) {
      config = await TempVCConfig.create({ guildId });
    }
    return config;
  }

  private async handleToggle(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null || enabled === undefined) return "Provide `enabled true/false`.";

    await TempVCConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { enabled },
      { upsert: true },
    );

    return "Temporary voice channels " + (enabled ? "enabled" : "disabled") + ".";
  }

  private async handleLobby(ctx: CommandContext): Promise<string> {
    const channelId = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel")?.id
      : ctx.args[1]?.replace(/[<#>]/g, "");

    if (!channelId) return "Mention a voice channel.";

    await TempVCConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { lobbyChannelId: channelId },
      { upsert: true },
    );

    return "Lobby channel set to <#" + channelId + ">. Users joining this channel will get a temporary voice channel.";
  }

  private async handleCategory(ctx: CommandContext): Promise<string> {
    const categoryId = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("category")?.id
      : ctx.args[1]?.replace(/[<#>]/g, "");

    if (!categoryId) return "Mention a category.";

    await TempVCConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { categoryId },
      { upsert: true },
    );

    return "Category set to <#" + categoryId + ">. Temp channels will be created in this category.";
  }

  private async handleName(ctx: CommandContext): Promise<string> {
    const template = ctx.type === "slash"
      ? ctx.interaction?.options.getString("template", true)
      : ctx.args.slice(1).join(" ");

    if (!template) return "Provide a name template. Use `{username}` or `{displayname}`.";

    await TempVCConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { channelNameTemplate: template },
      { upsert: true },
    );

    return "Channel name template set to: `" + template + "`";
  }

  private async handleBitrate(ctx: CommandContext): Promise<string> {
    const kbps = ctx.type === "slash"
      ? ctx.interaction?.options.getInteger("kbps", true)
      : parseInt(ctx.args[1]);

    if (!kbps || kbps < 8 || kbps > 384) return "Provide a bitrate between 8 and 384 kbps.";

    await TempVCConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { bitrate: kbps },
      { upsert: true },
    );

    return "Bitrate set to " + kbps + " kbps.";
  }

  private async handleLimit(ctx: CommandContext): Promise<string> {
    const limit = ctx.type === "slash"
      ? ctx.interaction?.options.getInteger("limit", true)
      : parseInt(ctx.args[1]);

    if (limit === null || limit === undefined || limit < 0 || limit > 99) return "Provide a limit between 0 (unlimited) and 99.";

    await TempVCConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { userLimit: limit },
      { upsert: true },
    );

    return "User limit set to " + (limit === 0 ? "unlimited" : limit) + ".";
  }

  private async handleStatus(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const config = await this.getConfig(ctx.guildId!);

    const embed = new EmbedBuilder()
      .setColor(config.enabled ? 0x2ecc71 : 0xff1744)
      .setTitle("Temporary Voice Channel Configuration")
      .addFields(
        { name: "Status", value: config.enabled ? "Enabled" : "Disabled", inline: true },
        { name: "Lobby Channel", value: config.lobbyChannelId ? "<#" + config.lobbyChannelId + ">" : "Not set", inline: true },
        { name: "Category", value: config.categoryId ? "<#" + config.categoryId + ">" : "None (root)", inline: true },
        { name: "Name Template", value: "`" + config.channelNameTemplate + "`", inline: true },
        { name: "Bitrate", value: config.bitrate + " kbps", inline: true },
        { name: "User Limit", value: config.userLimit === 0 ? "Unlimited" : String(config.userLimit), inline: true },
      )
      .setFooter({ text: "Aegis — Temp VC" })
      .setTimestamp();

    return { embeds: [embed] };
  }
}
