import {
  type Guild,
  ChannelType,
  EmbedBuilder,
  type TextChannel,
} from "discord.js";
import { logAction } from "../safety/ActionLogger.js";

export interface EventConfig {
  name: string;
  type: "containment_breach" | "anomaly_investigation" | "timeline_shift" | "faction_conflict" | "custom";
  description: string;
  objectives: string[];
  announcementMessage: string;
  npcDialogue?: { npc: string; message: string }[];
  temporaryChannels?: string[];
}

interface EventResult {
  success: boolean;
  channelId?: string;
  messageIds: string[];
  message?: string;
}

export async function createEvent(
  guild: Guild,
  config: EventConfig,
  userId: string,
  userTag: string,
): Promise<EventResult> {
  const messageIds: string[] = [];

  try {
    let eventCategory = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === "active events",
    );

    if (!eventCategory) {
      eventCategory = await guild.channels.create({
        name: "Active Events",
        type: ChannelType.GuildCategory,
      });
    }

    const eventChannel = await guild.channels.create({
      name: config.name.toLowerCase().replace(/\s+/g, "-").slice(0, 100),
      type: ChannelType.GuildText,
      parent: eventCategory.id,
      topic: `[${config.type.toUpperCase()}] ${config.description.slice(0, 100)}`,
    });

    const alertEmbed = new EmbedBuilder()
      .setColor(config.type === "containment_breach" ? 0xff1744 : 0x00b4d8)
      .setTitle(`EVENT: ${config.name}`)
      .setDescription(config.announcementMessage)
      .addFields(
        { name: "Type", value: config.type.replace(/_/g, " "), inline: true },
        { name: "Status", value: "ACTIVE", inline: true },
        ...(config.objectives.length
          ? [{ name: "Objectives", value: config.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n"), inline: false }]
          : []),
      )
      .setTimestamp()
      .setFooter({ text: "Event initiated by Blaze — Behavioral Logic & Anomaly Zone Engine" });

    const alertMsg = await eventChannel.send({ embeds: [alertEmbed] });
    messageIds.push(alertMsg.id);

    if (config.npcDialogue?.length) {
      for (const entry of config.npcDialogue.slice(0, 3)) {
        const npcEmbed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(entry.npc)
          .setDescription(entry.message)
          .setTimestamp();

        const npcMsg = await eventChannel.send({ embeds: [npcEmbed] });
        messageIds.push(npcMsg.id);
      }
    }

    if (config.temporaryChannels?.length) {
      for (const chName of config.temporaryChannels) {
        const ch = await guild.channels.create({
          name: chName.toLowerCase().replace(/\s+/g, "-").slice(0, 100),
          type: ChannelType.GuildText,
          parent: eventCategory.id,
        });
        messageIds.push(`channel:${ch.id}`);
      }
    }

    await logAction({
      userId,
      userTag,
      action: "create_event",
      reason: `Event: ${config.name} (${config.type})`,
      affectedResources: [`channel:${eventChannel.id}`, ...messageIds],
      result: "success",
      guildId: guild.id,
    });

    return {
      success: true,
      channelId: eventChannel.id,
      messageIds,
      message: `Event **${config.name}** created. Channel: <#${eventChannel.id}>`,
    };
  } catch (error) {
    await logAction({
      userId,
      userTag,
      action: "create_event",
      reason: `Failed: ${error instanceof Error ? error.message : String(error)}`,
      affectedResources: messageIds,
      result: "failure",
      guildId: guild.id,
    });

    return {
      success: false,
      messageIds,
      message: `Failed to create event: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function concludeEvent(
  channel: TextChannel,
  conclusionTitle: string,
  conclusionSummary: string,
  userId: string,
  userTag: string,
): Promise<boolean> {
  try {
    const conclusionEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`EVENT CONCLUDED: ${conclusionTitle}`)
      .setDescription(conclusionSummary)
      .setTimestamp()
      .setFooter({ text: "Event concluded by Blaze — Behavioral Logic & Anomaly Zone Engine" });

    await channel.send({ embeds: [conclusionEmbed] });

    await logAction({
      userId,
      userTag,
      action: "conclude_event",
      reason: `Concluded: ${conclusionTitle}`,
      affectedResources: [`channel:${channel.id}`],
      result: "success",
      guildId: channel.guild.id,
    });

    return true;
  } catch {
    return false;
  }
}
