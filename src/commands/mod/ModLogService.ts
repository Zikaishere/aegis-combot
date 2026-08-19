import { EmbedBuilder } from "discord.js";
import { client } from "../../client/Client.js";
import AutoModConfig from "../../models/AutoModConfig.js";

export interface ModAction {
  action: string;
  targetId: string;
  moderatorId: string;
  reason: string;
  timestamp: Date;
  extra?: string;
}

const ACTION_COLORS: Record<string, number> = {
  ban: 0xff1744,
  kick: 0xff6d00,
  mute: 0xf39c12,
  warn: 0xffc107,
  purge: 0x00b4d8,
  automod: 0x9c27b0,
};

export async function logModAction(guildId: string, action: ModAction): Promise<void> {
  const config = await AutoModConfig.findOne({ guildId });
  const channelId = config?.modLogChannelId;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !("send" in channel)) return;

  const color = ACTION_COLORS[action.action] ?? 0x00b4d8;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`Mod Action: ${action.action.toUpperCase()}`)
    .addFields(
      { name: "Target", value: `<@${action.targetId}>`, inline: true },
      { name: "Moderator", value: `<@${action.moderatorId}>`, inline: true },
      { name: "Reason", value: action.reason, inline: false },
    )
    .setTimestamp(action.timestamp);

  if (action.extra) {
    embed.addFields({ name: "Details", value: action.extra, inline: false });
  }

  await (channel as any).send({ embeds: [embed] }).catch(() => {});
}

export async function getModLogChannel(guildId: string): Promise<string | null> {
  const config = await AutoModConfig.findOne({ guildId });
  return config?.modLogChannelId ?? null;
}
