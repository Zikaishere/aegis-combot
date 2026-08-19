import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";

export class LockdownCommand extends BaseCommand {
  name = "lockdown";
  description = "Lock or unlock a channel during raids";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Lock or unlock a channel during raids")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName("lock")
        .setDescription("Lock a channel (deny SendMessages for everyone)")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to lock").addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for the lockdown")),
    )
    .addSubcommand(sub =>
      sub
        .setName("unlock")
        .setDescription("Unlock a channel")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to unlock").addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("lockall")
        .setDescription("Lock all text channels")
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for the lockdown")),
    )
    .addSubcommand(sub =>
      sub.setName("unlockall").setDescription("Unlock all locked channels"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";
    if (!ctx.guildId) return "Server only.";

    const guild = ctx.type === "slash" ? ctx.interaction?.guild : ctx.message.guild;
    if (!guild) return "Server not found.";

    switch (subcommand) {
      case "lock": return this.handleLock(ctx, guild);
      case "unlock": return this.handleUnlock(ctx, guild);
      case "lockall": return this.handleLockAll(ctx, guild);
      case "unlockall": return this.handleUnlockAll(ctx, guild);
      default: return "Unknown subcommand.";
    }
  }

  private async handleLock(ctx: CommandContext, guild: any): Promise<string> {
    const channel = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel") || ctx.interaction?.channel
      : ctx.message.channel;

    const reason = ctx.type === "slash"
      ? ctx.interaction?.options.getString("reason") || "No reason provided"
      : ctx.args.slice(1).join(" ") || "No reason provided";

    if (!channel) return "Channel not found.";

    try {
      await (channel as any).permissionOverwrites.edit(guild.id, {
        SendMessages: false,
      });
    } catch {
      return "Failed to lock the channel. Check my permissions.";
    }

    const embed = new EmbedBuilder()
      .setColor(0xff1744)
      .setTitle("Channel Locked")
      .setDescription(`This channel has been locked by <@${ctx.userId}>.`)
      .addFields({ name: "Reason", value: reason })
      .setFooter({ text: "Aegis — Lockdown" })
      .setTimestamp();

    if ("send" in channel) {
      await (channel as any).send({ embeds: [embed] }).catch(() => {});
    }

    return `Locked <#${(channel as any).id}>.`;
  }

  private async handleUnlock(ctx: CommandContext, guild: any): Promise<string> {
    const channel = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel") || ctx.interaction?.channel
      : ctx.message.channel;

    if (!channel) return "Channel not found.";

    try {
      await (channel as any).permissionOverwrites.edit(guild.id, {
        SendMessages: null,
      });
    } catch {
      return "Failed to unlock the channel. Check my permissions.";
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("Channel Unlocked")
      .setDescription(`This channel has been unlocked by <@${ctx.userId}>.`)
      .setFooter({ text: "Aegis — Lockdown" })
      .setTimestamp();

    if ("send" in channel) {
      await (channel as any).send({ embeds: [embed] }).catch(() => {});
    }

    return `Unlocked <#${(channel as any).id}>.`;
  }

  private async handleLockAll(ctx: CommandContext, guild: any): Promise<string> {
    const reason = ctx.type === "slash"
      ? ctx.interaction?.options.getString("reason") || "No reason provided"
      : ctx.args.slice(1).join(" ") || "No reason provided";

    const channels = await guild.channels.fetch().catch(() => null);
    if (!channels) return "Failed to fetch channels.";

    let locked = 0;
    for (const [, channel] of channels) {
      if (channel.type !== 0) continue;
      if (!channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageChannels)) continue;

      try {
        await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
        locked++;
      } catch {}
    }

    const embed = new EmbedBuilder()
      .setColor(0xff1744)
      .setTitle("Server Lockdown")
      .setDescription(`All text channels have been locked by <@${ctx.userId}>.`)
      .addFields(
        { name: "Channels Locked", value: `${locked}`, inline: true },
        { name: "Reason", value: reason },
      )
      .setFooter({ text: "Aegis — Lockdown" })
      .setTimestamp();

    const systemChannel = guild.systemChannel || (await guild.channels.fetch().then((chs: any) => chs.first()));
    if (systemChannel && "send" in systemChannel) {
      await systemChannel.send({ embeds: [embed] }).catch(() => {});
    }

    return `Locked ${locked} channels.`;
  }

  private async handleUnlockAll(ctx: CommandContext, guild: any): Promise<string> {
    const channels = await guild.channels.fetch().catch(() => null);
    if (!channels) return "Failed to fetch channels.";

    let unlocked = 0;
    for (const [, channel] of channels) {
      if (channel.type !== 0) continue;
      if (!channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageChannels)) continue;

      const overwrite = channel.permissionOverwrites.cache.get(guild.id);
      if (overwrite?.deny.has(PermissionFlagsBits.SendMessages)) {
        try {
          await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
          unlocked++;
        } catch {}
      }
    }

    return `Unlocked ${unlocked} channels.`;
  }
}
