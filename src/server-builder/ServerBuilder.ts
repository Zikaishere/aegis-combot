import {
  type Guild,
  type GuildChannelCreateOptions,
  type ColorResolvable,
  ChannelType,
} from "discord.js";
import { getTemplate, listTemplates, type DivisionTemplate } from "./templates/index.js";
import { logAction } from "../safety/ActionLogger.js";

interface BuildResult {
  success: boolean;
  categoryId?: string;
  channelIds: string[];
  roleIds: string[];
  message?: string;
}

export async function buildDivision(
  guild: Guild,
  templateName: string,
  userId: string,
  userTag: string,
): Promise<BuildResult> {
  const template = getTemplate(templateName);
  if (!template) {
    return {
      success: false,
      channelIds: [],
      roleIds: [],
      message: `Unknown template: \`${templateName}\`. Available: ${listTemplates().join(", ")}`,
    };
  }

  const channelIds: string[] = [];
  const roleIds: string[] = [];

  try {
    const roles: string[] = [];
    for (const roleDef of template.roles) {
      const role = await guild.roles.create({
        name: roleDef.name,
        color: roleDef.color as ColorResolvable,
        permissions: roleDef.permissions,
        mentionable: roleDef.mentionable ?? false,
      });
      roles.push(role.id);
      roleIds.push(role.id);
    }

    const category = await guild.channels.create({
      name: template.name,
      type: ChannelType.GuildCategory,
    });

    for (const channelDef of template.channels) {
      const channelOptions: GuildChannelCreateOptions = {
        name: channelDef.name,
        parent: category.id,
      };

      switch (channelDef.type) {
        case "text":
          channelOptions.type = ChannelType.GuildText;
          if (channelDef.topic) channelOptions.topic = channelDef.topic;
          break;
        case "voice":
          channelOptions.type = ChannelType.GuildVoice;
          break;
        case "forum":
          channelOptions.type = ChannelType.GuildForum;
          if (channelDef.topic) channelOptions.topic = channelDef.topic;
          break;
        case "stage":
          channelOptions.type = ChannelType.GuildStageVoice;
          break;
      }

      if (channelDef.nsfw) channelOptions.nsfw = true;

      const channel = await guild.channels.create(channelOptions);
      channelIds.push(channel.id);
    }

    await logAction({
      userId,
      userTag,
      action: "build_division",
      reason: `Created division: ${template.name}`,
      affectedResources: [
        `category:${category.id}`,
        ...channelIds.map(id => `channel:${id}`),
        ...roleIds.map(id => `role:${id}`),
      ],
      result: "success",
      guildId: guild.id,
    });

    return {
      success: true,
      categoryId: category.id,
      channelIds,
      roleIds,
      message: `Division **${template.name}** created successfully.`,
    };
  } catch (error) {
    await logAction({
      userId,
      userTag,
      action: "build_division",
      reason: `Failed to create division: ${template.name} — ${error instanceof Error ? error.message : String(error)}`,
      affectedResources: [...channelIds, ...roleIds],
      result: "failure",
      guildId: guild.id,
    });

    return {
      success: false,
      channelIds,
      roleIds,
      message: `Failed to create division: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function buildCustomDivision(
  guild: Guild,
  categoryName: string,
  channels: { name: string; type: "text" | "voice" | "forum"; topic?: string }[],
  roles: { name: string; color: string }[],
  userId: string,
  userTag: string,
): Promise<BuildResult> {
  const channelIds: string[] = [];
  const roleIds: string[] = [];

  try {
    for (const roleDef of roles) {
      const role = await guild.roles.create({
        name: roleDef.name,
        color: roleDef.color as ColorResolvable,
      });
      roleIds.push(role.id);
    }

    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
    });

    for (const channelDef of channels) {
      const channelOptions: GuildChannelCreateOptions = {
        name: channelDef.name,
        parent: category.id,
      };

      switch (channelDef.type) {
        case "text":
          channelOptions.type = ChannelType.GuildText;
          if (channelDef.topic) channelOptions.topic = channelDef.topic;
          break;
        case "voice":
          channelOptions.type = ChannelType.GuildVoice;
          break;
        case "forum":
          channelOptions.type = ChannelType.GuildForum;
          if (channelDef.topic) channelOptions.topic = channelDef.topic;
          break;
      }

      const channel = await guild.channels.create(channelOptions);
      channelIds.push(channel.id);
    }

    await logAction({
      userId,
      userTag,
      action: "build_custom_division",
      reason: `Created custom division: ${categoryName}`,
      affectedResources: [
        `category:${category.id}`,
        ...channelIds.map(id => `channel:${id}`),
        ...roleIds.map(id => `role:${id}`),
      ],
      result: "success",
      guildId: guild.id,
    });

    return {
      success: true,
      categoryId: category.id,
      channelIds,
      roleIds,
      message: `Custom division **${categoryName}** created with ${channels.length} channels and ${roles.length} roles.`,
    };
  } catch (error) {
    await logAction({
      userId,
      userTag,
      action: "build_custom_division",
      reason: `Failed: ${error instanceof Error ? error.message : String(error)}`,
      affectedResources: [...channelIds, ...roleIds],
      result: "failure",
      guildId: guild.id,
    });

    return {
      success: false,
      channelIds,
      roleIds,
      message: `Failed to create division: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export { listTemplates };
