import type { Client, VoiceState } from "discord.js";
import { ChannelType, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import TempVCConfig from "../models/TempVCConfig.js";

const EMPTY_DELETE_DELAY_MS = 2 * 60 * 1000;

const tempChannels = new Map<string, { ownerId: string }>();
const pendingDeletes = new Map<string, NodeJS.Timeout>();

let discordClient: Client | null = null;

async function deleteTempChannel(channelId: string): Promise<void> {
  tempChannels.delete(channelId);
  await TempVCConfig.updateMany({}, { $pull: { activeChannelIds: channelId } }).catch(() => {});

  if (!discordClient) return;
  const channel = await discordClient.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  await channel.delete("Temporary voice channel empty").catch(() => {});
}

function scheduleDelete(channelId: string): void {
  if (pendingDeletes.has(channelId)) return;
  const timer = setTimeout(() => {
    pendingDeletes.delete(channelId);
    void deleteTempChannel(channelId);
  }, EMPTY_DELETE_DELAY_MS);
  pendingDeletes.set(channelId, timer);
}

function cancelPendingDelete(channelId: string): void {
  const timer = pendingDeletes.get(channelId);
  if (timer) clearTimeout(timer);
  pendingDeletes.delete(channelId);
}

export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const guild = newState.guild;
  if (!guild) return;

  const config = await TempVCConfig.findOne({ guildId: guild.id });
  if (!config?.enabled || !config.lobbyChannelId) return;

  const joinedChannel = newState.channel;
  const leftChannel = oldState.channel;

  if (joinedChannel && pendingDeletes.has(joinedChannel.id)) {
    cancelPendingDelete(joinedChannel.id);
  }

  if (joinedChannel && joinedChannel.id === config.lobbyChannelId && leftChannel?.id !== joinedChannel.id) {
    const existing = [...tempChannels.entries()].find(([, t]) => t.ownerId === newState.member?.id);
    if (existing) {
      await newState.member?.voice.setChannel(existing[0]).catch(() => {});
      return;
    }
    await createTempChannel(guild, newState, config);
  }

  if (leftChannel && tempChannels.has(leftChannel.id) && leftChannel.members.size === 0) {
    scheduleDelete(leftChannel.id);
  }
}

async function createTempChannel(guild: any, state: VoiceState, config: any): Promise<void> {
  const member = state.member;
  if (!member) return;

  const categoryFallback = state.channel?.parentId ?? null;
  const channelName = config.channelNameTemplate
    .replace("{username}", member.user.username)
    .replace("{displayname}", member.displayName)
    .slice(0, 100);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: config.categoryId || categoryFallback,
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
  }).catch((err: unknown) => {
    console.error("Failed to create temporary voice channel:", err);
    return null;
  });

  if (!channel) return;

  tempChannels.set(channel.id, { ownerId: member.id });
  await TempVCConfig.updateOne(
    { guildId: guild.id },
    { $addToSet: { activeChannelIds: channel.id } },
  ).catch(() => {});

  try {
    await member.voice.setChannel(channel);
  } catch {
    await deleteTempChannel(channel.id).catch(() => {});
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00b4d8)
    .setTitle("Temporary Voice Channel")
    .setDescription(
      "Your temporary voice channel has been created.\n\n" +
      "**Controls:**\n" +
      "> Rename the channel to change its name\n" +
      "> Set user limit to control capacity\n" +
      "> Kick members using Discord's built-in controls\n\n" +
      "Channel will be deleted 2 minutes after it's empty.",
    )
    .setFooter({ text: "Aegis — Temp VC" })
    .setTimestamp();

  await (channel as any).send({ embeds: [embed] }).catch(() => {});
}

export async function initTempVC(client: Client): Promise<void> {
  discordClient = client;

  const configs = await TempVCConfig.find({ activeChannelIds: { $ne: [] } }).catch(() => []);
  for (const config of configs) {
    for (const channelId of config.activeChannelIds) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        await TempVCConfig.updateOne(
          { guildId: config.guildId },
          { $pull: { activeChannelIds: channelId } },
        ).catch(() => {});
        continue;
      }

      const members = (channel as any).members as Map<string, unknown> | undefined;
      tempChannels.set(channelId, { ownerId: "unknown" });
      if (!members || members.size === 0) {
        scheduleDelete(channelId);
      }
    }
  }
}

export function getTempChannelOwner(channelId: string): string | null {
  return tempChannels.get(channelId)?.ownerId ?? null;
}
