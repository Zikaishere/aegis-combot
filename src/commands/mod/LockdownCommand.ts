import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, PermissionsBitField } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import LockState from "../../models/LockState.js";

export class LockdownCommand extends BaseCommand {
  name = "lockdown";
  description = "Lock channels or the entire server";
  requiredPermissionLevel = PermissionLevel.Moderator;
  requiredPermissions = [PermissionFlagsBits.ManageChannels];

  slashCommand = new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Lock channels or the entire server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub =>
      sub
        .setName("lock")
        .setDescription("Lock a single channel")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to lock (default: current)").addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for the lock")),
    )
    .addSubcommand(sub =>
      sub
        .setName("unlock")
        .setDescription("Unlock a single channel")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to unlock (default: current)").addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("lockdown")
        .setDescription("Lock the entire server")
        .addStringOption(opt => opt.setName("reason").setDescription("Reason for the lockdown")),
    )
    .addSubcommand(sub =>
      sub
        .setName("unlockdown")
        .setDescription("Unlock the entire server"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Server only.";

    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    const guild = ctx.interaction?.guild ?? ctx.message?.guild;
    if (!guild) return "Server not found.";

    switch (subcommand) {
      case "lock": return this.handleLock(ctx, guild);
      case "unlock": return this.handleUnlock(ctx, guild);
      case "lockdown": return this.handleLockdown(ctx, guild);
      case "unlockdown": return this.handleUnlockdown(ctx, guild);
      default: return this.unknownSubcommand(subcommand);
    }
  }

  private async handleLock(ctx: CommandContext, guild: any): Promise<string> {
    const channelId = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel")?.id ?? ctx.channelId
      : ctx.args[1]?.replace(/[<#>]/g, "") ?? ctx.channelId;

    const reason = ctx.type === "slash"
      ? ctx.interaction?.options.getString("reason") ?? "No reason provided"
      : ctx.args.slice(2).join(" ") || "No reason provided";

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return "Channel not found or not a text channel.";

    const existing = await LockState.findOne({ guildId: ctx.guildId, channelId });
    if (existing) return `**<#${channelId}>** is already locked.`;

    const overwrites = channel.permissionOverwrites.cache;
    const originalOverwrites = overwrites.map((ow: any) => ({
      channelId: ow.id,
      allow: ow.allow.toArray(),
      deny: ow.deny.toArray(),
    }));

    await LockState.create({
      guildId: ctx.guildId,
      channelId,
      originalOverwrites,
      lockedBy: ctx.userId,
    });

    await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });

    const embed = new EmbedBuilder()
      .setColor(0xff1744)
      .setTitle("Channel Locked")
      .setDescription(`This channel has been locked by <@${ctx.userId}>.`)
      .addFields({ name: "Reason", value: reason })
      .setFooter({ text: "Aegis — Lockdown" })
      .setTimestamp();

    await (channel as any).send({ embeds: [embed] }).catch(() => {});

    return `Locked <#${channelId}>.`;
  }

  private async handleUnlock(ctx: CommandContext, guild: any): Promise<string> {
    const channelId = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel")?.id ?? ctx.channelId
      : ctx.args[1]?.replace(/[<#>]/g, "") ?? ctx.channelId;

    const lockData = await LockState.findOne({ guildId: ctx.guildId, channelId });
    if (!lockData) return `**<#${channelId}>** is not locked.`;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return "Channel not found.";

    for (const ow of lockData.originalOverwrites) {
      const allow = new PermissionsBitField(ow.allow as any);
      const deny = new PermissionsBitField(ow.deny as any);

      if (ow.channelId === guild.id) {
        await channel.permissionOverwrites.edit(guild.id, {
          SendMessages: allow.has(PermissionFlagsBits.SendMessages) ? true : deny.has(PermissionFlagsBits.SendMessages) ? false : null,
        } as any);
      } else {
        await channel.permissionOverwrites.edit(ow.channelId, {
          Allow: allow,
          Deny: deny,
        } as any);
      }
    }

    if (!lockData.originalOverwrites.some(ow => ow.channelId === guild.id)) {
      await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
    }

    await LockState.deleteOne({ _id: lockData._id });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("Channel Unlocked")
      .setDescription(`This channel has been unlocked by <@${ctx.userId}>.`)
      .setFooter({ text: "Aegis — Lockdown" })
      .setTimestamp();

    await (channel as any).send({ embeds: [embed] }).catch(() => {});

    return `Unlocked <#${channelId}>.`;
  }

  private async handleLockdown(ctx: CommandContext, guild: any): Promise<string> {
    const reason = ctx.type === "slash"
      ? ctx.interaction?.options.getString("reason") ?? "No reason provided"
      : ctx.args.slice(1).join(" ") || "No reason provided";

    const channels = await guild.channels.fetch().catch(() => null);
    if (!channels) return "Failed to fetch channels.";

    let locked = 0;
    let alreadyLocked = 0;

    for (const [, channel] of channels) {
      if (channel.type !== 0) continue;
      if (!channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageChannels)) continue;

      const existing = await LockState.findOne({ guildId: ctx.guildId, channelId: channel.id });
      if (existing) {
        alreadyLocked++;
        continue;
      }

      const overwrites = channel.permissionOverwrites.cache;
      const originalOverwrites = overwrites.map((ow: any) => ({
        channelId: ow.id,
        allow: ow.allow.toArray(),
        deny: ow.deny.toArray(),
      }));

      await LockState.create({
        guildId: ctx.guildId,
        channelId: channel.id,
        originalOverwrites,
        lockedBy: ctx.userId,
      });

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
        { name: "Already Locked", value: `${alreadyLocked}`, inline: true },
        { name: "Reason", value: reason },
      )
      .setFooter({ text: "Aegis — Lockdown" })
      .setTimestamp();

    const systemChannel = guild.systemChannel || channels.first();
    if (systemChannel && "send" in systemChannel) {
      await systemChannel.send({ embeds: [embed] }).catch(() => {});
    }

    return `Locked ${locked} channels (${alreadyLocked} already locked).`;
  }

  private async handleUnlockdown(ctx: CommandContext, guild: any): Promise<string> {
    const lockEntries = await LockState.find({ guildId: ctx.guildId });
    if (lockEntries.length === 0) return "No locked channels found.";

    let unlocked = 0;
    let failed = 0;

    for (const lockData of lockEntries) {
      const channel = await guild.channels.fetch(lockData.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        failed++;
        continue;
      }

      try {
        for (const ow of lockData.originalOverwrites) {
          const allow = new PermissionsBitField(ow.allow as any);
          const deny = new PermissionsBitField(ow.deny as any);

          if (ow.channelId === guild.id) {
            await channel.permissionOverwrites.edit(guild.id, {
              SendMessages: allow.has(PermissionFlagsBits.SendMessages) ? true : deny.has(PermissionFlagsBits.SendMessages) ? false : null,
            } as any);
          } else {
            await channel.permissionOverwrites.edit(ow.channelId, {
              Allow: allow,
              Deny: deny,
            } as any);
          }
        }

        if (!lockData.originalOverwrites.some(ow => ow.channelId === guild.id)) {
          await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
        }

        unlocked++;
      } catch {
        failed++;
      }
    }

    await LockState.deleteMany({ guildId: ctx.guildId });

    return `Unlocked ${unlocked} channels (${failed} failed).`;
  }
}
