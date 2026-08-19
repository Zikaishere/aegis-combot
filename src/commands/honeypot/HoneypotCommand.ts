import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import HoneypotConfig from "../../models/HoneypotConfig.js";

export class HoneypotCommand extends BaseCommand {
  name = "honeypot";
  description = "Configure the honeypot trap system";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("honeypot")
    .setDescription("Configure the honeypot trap system")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View honeypot configuration"),
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable the honeypot system")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a trap channel")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to make a trap").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Remove a trap channel")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to remove from traps").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("log")
        .setDescription("Set the log channel for honeypot triggers")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to log triggers").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";
    if (!ctx.guildId) return "Server only.";

    switch (subcommand) {
      case "status": return this.handleStatus(ctx);
      case "toggle": return this.handleToggle(ctx);
      case "add": return this.handleAdd(ctx);
      case "remove": return this.handleRemove(ctx);
      case "log": return this.handleLog(ctx);
      default: return "Unknown subcommand.";
    }
  }

  private async getConfig(guildId: string) {
    let config = await HoneypotConfig.findOne({ guildId });
    if (!config) config = await HoneypotConfig.create({ guildId });
    return config;
  }

  private async handleStatus(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const config = await this.getConfig(ctx.guildId!);

    const channels = config.trapChannels.length > 0
      ? config.trapChannels.map(id => `<#${id}>`).join("\n")
      : "None";

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(config.enabled ? 0xff9800 : 0x999999)
          .setTitle("Honeypot Configuration")
          .addFields(
            { name: "Status", value: config.enabled ? "Enabled" : "Disabled", inline: true },
            { name: "Trap Channels", value: channels, inline: false },
            { name: "Log Channel", value: config.logChannelId ? `<#${config.logChannelId}>` : "Not set", inline: true },
          )
          .setDescription("Users who send messages in trap channels have all roles stripped and must re-verify.")
          .setFooter({ text: "Aegis — Honeypot System" })
          .setTimestamp(),
      ],
    };
  }

  private async handleToggle(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null || enabled === undefined) return "Provide `true` or `false`.";

    await HoneypotConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { enabled },
      { upsert: true },
    );

    return `Honeypot system ${enabled ? "enabled" : "disabled"}.`;
  }

  private async handleAdd(ctx: CommandContext): Promise<string> {
    const channel = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel")
      : null;

    if (!channel) return "Provide a channel.";

    const config = await this.getConfig(ctx.guildId!);
    if (config.trapChannels.includes(channel.id)) return `<#${channel.id}> is already a trap channel.`;

    config.trapChannels.push(channel.id);
    await config.save();

    return `<#${channel.id}> added as a trap channel. Users who send messages there will have their roles stripped.`;
  }

  private async handleRemove(ctx: CommandContext): Promise<string> {
    const channel = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel")
      : null;

    if (!channel) return "Provide a channel.";

    const config = await this.getConfig(ctx.guildId!);
    const idx = config.trapChannels.indexOf(channel.id);
    if (idx === -1) return `<#${channel.id}> is not a trap channel.`;

    config.trapChannels.splice(idx, 1);
    await config.save();

    return `<#${channel.id}> removed from trap channels.`;
  }

  private async handleLog(ctx: CommandContext): Promise<string> {
    const channel = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel")
      : null;

    if (!channel) return "Provide a channel.";

    await HoneypotConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { logChannelId: channel.id },
      { upsert: true },
    );

    return `Honeypot log channel set to <#${channel.id}>.`;
  }
}
