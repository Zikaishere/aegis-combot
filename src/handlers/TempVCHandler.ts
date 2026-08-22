import type { Client, VoiceState } from "discord.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import TempVCConfig from "../models/TempVCConfig.js";
import { buildOwnerPanel, rememberPanelMessage } from "./TempVCPanel.js";

const MODULE_VERSION = 2;
const EMPTY_DELETE_DELAY_MS = 2 * 60 * 1000;

console.log(`[TempVC] Handler v${MODULE_VERSION} loaded`);

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
  const lobbyId = config?.lobbyChannelId ?? null;

  const joinedId = newState.channelId;
  const leftId = oldState.channelId;

  // Someone joined a temp channel — cancel its pending deletion.
  if (joinedId && pendingDeletes.has(joinedId)) {
    console.log(`[TempVC] Rejoin cancels deletion of ${joinedId}`);
    cancelPendingDelete(joinedId);
  }

  // Join-to-create.
  if (config?.enabled && lobbyId && joinedId === lobbyId && leftId !== joinedId) {
    console.log(`[TempVC] Lobby join by ${newState.member?.id ?? "unknown"} in ${guild.id}`);
    await createTempChannel(guild, newState, config);
  }

  // Empty temp channel — schedule deletion.
  if (leftId && tempChannels.has(leftId) && (oldState.channel?.members.size ?? 0) === 0) {
    console.log(`[TempVC] ${leftId} empty — deleting in ${EMPTY_DELETE_DELAY_MS / 1000}s`);
    scheduleDelete(leftId);
  }
}

async function createTempChannel(guild: any, state: VoiceState, config: any): Promise<void> {
  const member = state.member;
  if (!member) return;

  const existing = [...tempChannels.entries()].find(([, t]) => t.ownerId === member.id);
  if (existing) {
    const alive = await guild.channels.fetch(existing[0]).catch(() => null);
    if (alive) {
      await member.voice.setChannel(alive).catch(() => {});
      return;
    }
    tempChannels.delete(existing[0]);
  }

  const categoryFallback = state.channel?.parentId ?? null;
  const channelName = String(config.channelNameTemplate || "{username}'s channel")
    .replace("{username}", member.user.username)
    .replace("{displayname}", member.displayName)
    .slice(0, 100);

  const parentsToTry = [config.categoryId, categoryFallback, null].filter(
    (value, index, arr) => value !== undefined && arr.indexOf(value) === index,
  );

  let channel: any = null;
  let lastError: unknown = null;

  for (const parent of parentsToTry) {
    channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent,
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
      lastError = err;
      return null;
    });
    if (channel) break;
    console.warn(`[TempVC] Create failed with parent=${parent}, trying next`);
  }

  if (!channel) {
    console.error("[TempVC] Failed to create temporary voice channel:", lastError);
    return;
  }

  console.log(`[TempVC] Created ${channel.id} ("${channel.name}") in guild ${guild.id}`);

  tempChannels.set(channel.id, { ownerId: member.id });
  await TempVCConfig.updateOne(
    { guildId: guild.id },
    { $addToSet: { activeChannelIds: channel.id } },
  ).catch(() => {});

  try {
    await member.voice.setChannel(channel);
  } catch {
    console.warn(`[TempVC] Could not move ${member.id} into ${channel.id} — deleting it`);
    await deleteTempChannel(channel.id).catch(() => {});
    return;
  }

  const panel = buildOwnerPanel(channel as any, member.id);
  const sent = await (channel as any).send(panel).catch(() => {});
  if (sent) await rememberPanelMessage(channel.id, sent.id).catch(() => {});
}

export { buildOwnerPanel } from "./TempVCPanel.js";

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
  console.log(`[TempVC] Init done — tracking ${tempChannels.size} channel(s)`);
}

export async function removeTempChannel(channelId: string): Promise<void> {
  return deleteTempChannel(channelId);
}

export function setTempChannelOwner(channelId: string, ownerId: string): void {
  tempChannels.set(channelId, { ownerId });
}

export function getTempChannelOwner(channelId: string): string | null {
  return tempChannels.get(channelId)?.ownerId ?? null;
}
