import type { GuildMember } from "discord.js";
import { PermissionsBitField, EmbedBuilder } from "discord.js";
import AutoModConfig from "../models/AutoModConfig.js";
import LockState from "../models/LockState.js";

const joinTimestamps = new Map<string, number[]>();
const recentlyLocked = new Map<string, number>();

const CLEANUP_INTERVAL = 60_000;
const LOCK_COOLDOWN = 300_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of joinTimestamps) {
    const fresh = timestamps.filter(t => now - t < 120_000);
    if (fresh.length === 0) joinTimestamps.delete(key);
    else joinTimestamps.set(key, fresh);
  }
  for (const [key, time] of recentlyLocked) {
    if (now - time > LOCK_COOLDOWN) recentlyLocked.delete(key);
  }
}, CLEANUP_INTERVAL);

export async function checkRaid(member: GuildMember): Promise<void> {
  const guild = member.guild;
  if (!guild) return;

  const config = await AutoModConfig.findOne({ guildId: guild.id });
  if (!config?.enabled || !config.raidDetection?.enabled) return;

  const now = Date.now();
  const windowMs = config.raidDetection.windowSeconds * 1000;
  const threshold = config.raidDetection.threshold;

  if (recentlyLocked.has(guild.id)) return;

  const timestamps = joinTimestamps.get(guild.id) || [];
  const recent = timestamps.filter(t => now - t < windowMs);
  recent.push(now);
  joinTimestamps.set(guild.id, recent);

  if (recent.length >= threshold) {
    await triggerRaidLockdown(guild, member, recent.length, config.raidDetection);
  }
}

async function triggerRaidLockdown(
  guild: any,
  triggerMember: GuildMember,
  joinCount: number,
  config: any,
): Promise<void> {
  recentlyLocked.set(guild.id, Date.now());
  joinTimestamps.delete(guild.id);

  const channels = await guild.channels.fetch().catch(() => null);
  if (!channels) return;

  let locked = 0;
  for (const [, channel] of channels) {
    if (channel.type !== 0) continue;
    if (!channel.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.ManageChannels)) continue;

    const existing = await LockState.findOne({ guildId: guild.id, channelId: channel.id });
    if (existing) continue;

    const overwrites = channel.permissionOverwrites.cache;
    const originalOverwrites = overwrites.map((ow: any) => ({
      channelId: ow.id,
      allow: ow.allow.toArray(),
      deny: ow.deny.toArray(),
    }));

    await LockState.create({
      guildId: guild.id,
      channelId: channel.id,
      originalOverwrites,
      lockedBy: guild.members.me?.id || "raid-detector",
    });

    try {
      await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
      locked++;
    } catch {}
  }

  const logChannelId = config.modLogChannelId || config.auditLogChannelId;
  if (logChannelId) {
    const channel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (channel && "send" in channel) {
      const embed = new EmbedBuilder()
        .setColor(0xff1744)
        .setTitle("Raid Detected — Server Locked Down")
        .setDescription(
          `${joinCount} members joined in the last ${config.windowSeconds}s.\n` +
          `All text channels have been locked automatically.\n\n` +
          `Use \`/lockdown unlockdown\` to restore access.`,
        )
        .addFields(
          { name: "Triggered By", value: `<@${triggerMember.id}> (join #${joinCount})`, inline: true },
          { name: "Channels Locked", value: `${locked}`, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: "Aegis — Raid Detection" });

      await (channel as any).send({ embeds: [embed] }).catch(() => {});
    }
  }
}
