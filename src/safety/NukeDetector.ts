import type { Guild, GuildAuditLogsEntry } from "discord.js";
import { PermissionsBitField, EmbedBuilder, AuditLogEvent } from "discord.js";
import AutoModConfig from "../models/AutoModConfig.js";
import LockState from "../models/LockState.js";

const actionTimestamps = new Map<string, { action: string; time: number }[]>();
const recentlyLocked = new Map<string, number>();

const CLEANUP_INTERVAL = 60_000;
const LOCK_COOLDOWN = 300_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entries] of actionTimestamps) {
    const fresh = entries.filter(e => now - e.time < 30_000);
    if (fresh.length === 0) actionTimestamps.delete(key);
    else actionTimestamps.set(key, fresh);
  }
  for (const [key, time] of recentlyLocked) {
    if (now - time > LOCK_COOLDOWN) recentlyLocked.delete(key);
  }
}, CLEANUP_INTERVAL);

function recordAction(guildId: string, action: string): number {
  const now = Date.now();
  const entries = actionTimestamps.get(guildId) || [];
  const recent = entries.filter(e => now - e.time < 30_000);
  recent.push({ action, time: now });
  actionTimestamps.set(guildId, recent);
  return recent.length;
}

export async function onChannelDeleteNuke(channel: any): Promise<void> {
  if (!channel.guild) return;
  const guild = channel.guild;

  const config = await AutoModConfig.findOne({ guildId: guild.id });
  if (!config?.enabled || !config.nukeDetection?.enabled) return;

  const count = recordAction(guild.id, "channelDelete");
  if (count >= (config.nukeDetection.channelDeleteThreshold || 3)) {
    await triggerNukeLockdown(guild, "channel deletion", count, config);
  }
}

export async function onRoleDeleteNuke(role: any): Promise<void> {
  if (!role.guild) return;
  const guild = role.guild;

  const config = await AutoModConfig.findOne({ guildId: guild.id });
  if (!config?.enabled || !config.nukeDetection?.enabled) return;

  const count = recordAction(guild.id, "roleDelete");
  if (count >= (config.nukeDetection.roleDeleteThreshold || 3)) {
    await triggerNukeLockdown(guild, "role deletion", count, config);
  }
}

export async function onBanNuke(ban: any): Promise<void> {
  if (!ban.guild) return;
  const guild = ban.guild;

  const config = await AutoModConfig.findOne({ guildId: guild.id });
  if (!config?.enabled || !config.nukeDetection?.enabled) return;

  const count = recordAction(guild.id, "ban");
  if (count >= (config.nukeDetection.banThreshold || 5)) {
    await triggerNukeLockdown(guild, "mass bans", count, config);
  }
}

export async function onKickNuke(member: any): Promise<void> {
  if (!member.guild) return;
  const guild = member.guild;

  const config = await AutoModConfig.findOne({ guildId: guild.id });
  if (!config?.enabled || !config.nukeDetection?.enabled) return;

  const count = recordAction(guild.id, "kick");
  if (count >= (config.nukeDetection.kickThreshold || 5)) {
    await triggerNukeLockdown(guild, "mass kicks", count, config);
  }
}

async function triggerNukeLockdown(
  guild: any,
  triggerType: string,
  actionCount: number,
  config: any,
): Promise<void> {
  if (recentlyLocked.has(guild.id)) return;
  recentlyLocked.set(guild.id, Date.now());
  actionTimestamps.delete(guild.id);

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
      lockedBy: guild.members.me?.id || "nuke-detector",
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
        .setTitle("Nuke Detected — Server Locked Down")
        .setDescription(
          `${actionCount} ${triggerType} detected in the last 30 seconds.\n` +
          `All text channels have been locked automatically.\n\n` +
          `Use \`/lockdown unlockdown\` to restore access.`,
        )
        .addFields(
          { name: "Trigger", value: triggerType, inline: true },
          { name: "Count", value: `${actionCount}`, inline: true },
          { name: "Channels Locked", value: `${locked}`, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: "Aegis — Nuke Detection" });

      await (channel as any).send({ embeds: [embed] }).catch(() => {});
    }
  }
}
