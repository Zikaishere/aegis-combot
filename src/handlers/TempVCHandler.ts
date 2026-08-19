import type { VoiceState } from "discord.js";
import { ChannelType, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import TempVCConfig from "../models/TempVCConfig.js";

const tempChannels = new Map<string, { channelId: string; ownerId: string }>();

export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const guild = newState.guild;
  if (!guild) return;

  const config = await TempVCConfig.findOne({ guildId: guild.id });
  if (!config?.enabled || !config.lobbyChannelId) return;

  const joinedChannel = newState.channel;
  const leftChannel = oldState.channel;

  if (joinedChannel && joinedChannel.id === config.lobbyChannelId) {
    await createTempChannel(guild, newState, config);
  }

  if (leftChannel) {
    const temp = tempChannels.get(leftChannel.id);
    if (temp && leftChannel.members.size === 0) {
      await leftChannel.delete().catch(() => {});
      tempChannels.delete(leftChannel.id);
    }
  }
}

async function createTempChannel(guild: any, state: VoiceState, config: any): Promise<void> {
  const member = state.member;
  if (!member) return;

  const channelName = config.channelNameTemplate
    .replace("{username}", member.user.username)
    .replace("{displayname}", member.displayName)
    .slice(0, 100);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: config.categoryId || null,
    bitrate: config.bitrate * 1000,
    userLimit: config.userLimit || 0,
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MoveMembers,
          PermissionFlagsBits.MuteMembers,
          PermissionFlagsBits.DeafenMembers,
        ],
      },
    ],
  }).catch(() => null);

  if (!channel) return;

  tempChannels.set(channel.id, { channelId: channel.id, ownerId: member.id });

  try {
    await member.voice.setChannel(channel);
  } catch {}

  const embed = new EmbedBuilder()
    .setColor(0x00b4d8)
    .setTitle("Temporary Voice Channel")
    .setDescription(
      "Your temporary voice channel has been created.\n\n" +
      "**Controls:**\n" +
      "> Rename the channel to change its name\n" +
      "> Set user limit to control capacity\n" +
      "> Kick members using Discord's built-in controls\n\n" +
      "Channel will be deleted when it's empty.",
    )
    .setFooter({ text: "Aegis — Temp VC" })
    .setTimestamp();

  await (channel as any).send({ embeds: [embed] }).catch(() => {});
}

export function getTempChannelOwner(channelId: string): string | null {
  return tempChannels.get(channelId)?.ownerId ?? null;
}
