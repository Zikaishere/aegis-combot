import type { GuildMember } from "discord.js";
import { EmbedBuilder } from "discord.js";
import WelcomeConfig from "../models/WelcomeConfig.js";

function replaceVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const config = await WelcomeConfig.findOne({ guildId: member.guild.id });
  if (!config) return;

  if (config.autoRole.enabled && config.autoRole.roleIds.length > 0) {
    for (const roleId of config.autoRole.roleIds) {
      await member.roles.add(roleId).catch(() => {});
    }
  }

  if (!config.welcome.enabled || !config.welcome.channelId) return;

  const channel = await member.guild.channels.fetch(config.welcome.channelId).catch(() => null);
  if (!channel || !("send" in channel)) return;

  const vars = {
    user: `<@${member.id}>`,
    username: member.user.username,
    server: member.guild.name,
    membercount: String(member.guild.memberCount),
  };

  const embed = new EmbedBuilder()
    .setColor(config.welcome.embed.color || 0x2ecc71);

  if (config.welcome.embed.title) {
    embed.setTitle(replaceVars(config.welcome.embed.title, vars));
  }
  if (config.welcome.embed.description) {
    embed.setDescription(replaceVars(config.welcome.embed.description, vars));
  }
  if (config.welcome.embed.imageUrl) {
    embed.setImage(config.welcome.embed.imageUrl);
  }
  if (config.welcome.embed.thumbnailUrl) {
    embed.setThumbnail(replaceVars(config.welcome.embed.thumbnailUrl, vars));
  }
  if (config.welcome.embed.footer) {
    embed.setFooter({ text: replaceVars(config.welcome.embed.footer, vars) });
  }
  embed.setTimestamp();

  if (!config.welcome.embed.title && !config.welcome.embed.description) {
    embed.setTitle("Welcome!");
    embed.setDescription(replaceVars(
      "Welcome to {server}, {user}! You are member #{membercount}.",
      vars,
    ));
    embed.setThumbnail(member.user.displayAvatarURL());
  }

  if (config.welcome.message) {
    await (channel as any).send({ content: replaceVars(config.welcome.message, vars), embeds: [embed] }).catch(() => {});
  } else {
    await (channel as any).send({ embeds: [embed] }).catch(() => {});
  }
}

export async function handleGuildMemberRemove(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const config = await WelcomeConfig.findOne({ guildId: member.guild.id });
  if (!config || !config.goodbye.enabled || !config.goodbye.channelId) return;

  const channel = await member.guild.channels.fetch(config.goodbye.channelId).catch(() => null);
  if (!channel || !("send" in channel)) return;

  const vars = {
    user: member.user.username,
    username: member.user.username,
    server: member.guild.name,
    membercount: String(member.guild.memberCount),
  };

  const embed = new EmbedBuilder()
    .setColor(config.goodbye.embed.color || 0xff1744);

  if (config.goodbye.embed.title) {
    embed.setTitle(replaceVars(config.goodbye.embed.title, vars));
  }
  if (config.goodbye.embed.description) {
    embed.setDescription(replaceVars(config.goodbye.embed.description, vars));
  }
  if (config.goodbye.embed.imageUrl) {
    embed.setImage(config.goodbye.embed.imageUrl);
  }
  if (config.goodbye.embed.footer) {
    embed.setFooter({ text: replaceVars(config.goodbye.embed.footer, vars) });
  }
  embed.setTimestamp();

  if (!config.goodbye.embed.title && !config.goodbye.embed.description) {
    embed.setTitle("Goodbye!");
    embed.setDescription(replaceVars(
      "Farewell, {user}! We'll miss you.",
      vars,
    ));
  }

  if (config.goodbye.message) {
    await (channel as any).send({ content: replaceVars(config.goodbye.message, vars), embeds: [embed] }).catch(() => {});
  } else {
    await (channel as any).send({ embeds: [embed] }).catch(() => {});
  }
}
