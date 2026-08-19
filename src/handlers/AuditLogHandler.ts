import type { Guild, GuildMember, TextChannel, Role, PartialMessage } from "discord.js";
import { EmbedBuilder } from "discord.js";
import AuditLogEntry from "../models/AuditLogEntry.js";
import AutoModConfig from "../models/AutoModConfig.js";

async function getLogChannel(guild: Guild): Promise<TextChannel | null> {
  const config = await AutoModConfig.findOne({ guildId: guild.id });
  if (!config?.modLogChannelId) return null;
  const channel = await guild.channels.fetch(config.modLogChannelId).catch(() => null);
  if (channel && channel.isTextBased()) return channel as TextChannel;
  return null;
}

async function log(guild: Guild, action: string, details: string, extra?: Partial<{ moderatorId: string; targetId: string; channelId: string; metadata: Record<string, any> }>) {
  await AuditLogEntry.create({
    guildId: guild.id,
    action,
    details,
    ...extra,
  }).catch(() => {});

  const logChannel = await getLogChannel(guild);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(getColor(action))
    .setTitle(`Audit: ${action}`)
    .setDescription(details.slice(0, 4096))
    .setTimestamp();

  if (extra?.moderatorId) embed.addFields({ name: "By", value: `<@${extra.moderatorId}>`, inline: true });
  if (extra?.targetId) embed.addFields({ name: "Target", value: `<@${extra.targetId}>`, inline: true });

  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

function getColor(action: string): number {
  if (action.startsWith("channel")) return 0x00b4d8;
  if (action.startsWith("role")) return 0x9c27b0;
  if (action.startsWith("member") || action.startsWith("ban")) return 0xff9800;
  if (action.startsWith("message")) return 0xff1744;
  return 0x00b4d8;
}

export async function onChannelCreate(channel: any): Promise<void> {
  if (!channel.guild) return;
  await log(channel.guild, "channelCreate", `Channel created: <#${channel.id}> (${channel.name})`);
}

export async function onChannelDelete(channel: any): Promise<void> {
  if (!channel.guild) return;
  await log(channel.guild, "channelDelete", `Channel deleted: ${channel.name} (${channel.id})`);
}

export async function onChannelUpdate(old: any, updated: any): Promise<void> {
  if (!old.guild) return;
  const changes: string[] = [];
  if (old.name !== updated.name) changes.push(`Name: \`${old.name}\` → \`${updated.name}\``);
  if (old.topic !== updated.topic) changes.push(`Topic changed`);
  if (old.nsfw !== updated.nsfw) changes.push(`NSFW: ${old.nsfw} → ${updated.nsfw}`);
  if (changes.length === 0) return;
  await log(old.guild, "channelUpdate", `Channel updated: <#${old.id}>\n${changes.join("\n")}`);
}

export async function onRoleCreate(role: Role): Promise<void> {
  if (!role.guild) return;
  await log(role.guild, "roleCreate", `Role created: <@&${role.id}> (${role.name})`);
}

export async function onRoleDelete(role: Role): Promise<void> {
  if (!role.guild) return;
  await log(role.guild, "roleDelete", `Role deleted: ${role.name} (${role.id})`);
}

export async function onRoleUpdate(old: Role, updated: Role): Promise<void> {
  if (!old.guild) return;
  const changes: string[] = [];
  if (old.name !== updated.name) changes.push(`Name: \`${old.name}\` → \`${updated.name}\``);
  if (old.color !== updated.color) changes.push(`Color changed`);
  if (old.hoist !== updated.hoist) changes.push(`Hoist: ${old.hoist} → ${updated.hoist}`);
  if (old.mentionable !== updated.mentionable) changes.push(`Mentionable: ${old.mentionable} → ${updated.mentionable}`);
  if (changes.length === 0) return;
  await log(old.guild, "roleUpdate", `Role updated: <@&${old.id}>\n${changes.join("\n")}`);
}

export async function onMemberUpdate(old: GuildMember, updated: GuildMember): Promise<void> {
  if (!old.guild) return;
  const changes: string[] = [];

  if (old.nickname !== updated.nickname) {
    changes.push(`Nickname: \`${old.nickname || old.user.username}\` → \`${updated.nickname || updated.user.username}\``);
  }

  const oldRoles = old.roles.cache.map(r => r.id);
  const newRoles = updated.roles.cache.map(r => r.id);
  const added = newRoles.filter(id => !oldRoles.includes(id));
  const removed = oldRoles.filter(id => !newRoles.includes(id));

  if (added.length) changes.push(`Roles added: ${added.map(id => `<@&${id}>`).join(", ")}`);
  if (removed.length) changes.push(`Roles removed: ${removed.map(id => `<@&${id}>`).join(", ")}`);

  if (changes.length === 0) return;
  await log(old.guild, "memberUpdate", `Member updated: <@${old.id}>\n${changes.join("\n")}`, { targetId: old.id });
}

export async function onMessageDelete(message: PartialMessage): Promise<void> {
  if (!message.guild) return;
  if (message.author?.bot) return;
  if (!message.content) return;

  await log(message.guild, "messageDelete", `Message deleted in <#${message.channel.id}> by <@${message.author?.id || "unknown"}>:\n\`\`\`${message.content.slice(0, 500)}\`\`\``, {
    targetId: message.author?.id,
    channelId: message.channel.id,
  });
}

export async function onMessageUpdate(old: PartialMessage, updated: PartialMessage): Promise<void> {
  if (!old.guild) return;
  if (old.author?.bot) return;
  if (!old.content || !updated.content) return;
  if (old.content === updated.content) return;

  await log(old.guild, "messageUpdate", `Message edited in <#${old.channel.id}> by <@${old.author?.id || "unknown"}>:\n**Before:**\n\`\`\`${old.content.slice(0, 300)}\`\`\`\n**After:**\n\`\`\`${updated.content.slice(0, 300)}\`\`\``, {
    targetId: old.author?.id,
    channelId: old.channel.id,
  });
}

export async function onBanAdd(ban: any): Promise<void> {
  if (!ban.guild) return;
  const reason = ban.reason || "No reason provided";
  await log(ban.guild, "banAdd", `User banned: <@${ban.user.id}> (${ban.user.tag})\nReason: ${reason}`, {
    targetId: ban.user.id,
    moderatorId: ban.executor?.id,
  });
}

export async function onBanRemove(ban: any): Promise<void> {
  if (!ban.guild) return;
  await log(ban.guild, "banRemove", `User unbanned: <@${ban.user.id}> (${ban.user.tag})`, {
    targetId: ban.user.id,
    moderatorId: ban.executor?.id,
  });
}
