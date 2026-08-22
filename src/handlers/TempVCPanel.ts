import type { ButtonInteraction, ModalSubmitInteraction, UserSelectMenuInteraction } from "discord.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  OverwriteType,
  UserSelectMenuBuilder,
} from "discord.js";
import { getTempChannelOwner, setTempChannelOwner, removeTempChannel } from "./TempVCHandler.js";

const panelMessageIds = new Map<string, string>();

function isLocked(channel: any): boolean {
  const everyone = channel.permissionOverwrites?.cache?.find(
    (o: any) => o.type === OverwriteType.Role && o.id === channel.guild.id,
  );
  return Boolean(everyone?.deny.has(PermissionFlagsBits.Connect));
}

function getAccessLists(channel: any): { allowed: string[]; blocked: string[] } {
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const o of channel.permissionOverwrites?.cache?.values() ?? []) {
    if (o.type !== OverwriteType.Member) continue;
    if (o.allow.has(PermissionFlagsBits.Connect)) allowed.push(o.id);
    else if (o.deny.has(PermissionFlagsBits.Connect)) blocked.push(o.id);
  }
  return { allowed, blocked };
}

export async function resolveOwnerId(channel: any): Promise<string | null> {
  const known = getTempChannelOwner(channel.id);
  if (known && known !== "unknown") return known;

  const overwrite = channel.permissionOverwrites?.cache?.find(
    (o: any) => o.type === OverwriteType.Member && o.allow.has(PermissionFlagsBits.ManageChannels),
  );
  if (overwrite) {
    setTempChannelOwner(channel.id, overwrite.id);
    return overwrite.id;
  }
  return null;
}

export function buildOwnerPanel(channel: any, ownerId: string): { embeds: any[]; components: any[] } {
  const locked = isLocked(channel);
  const limit = (channel as any).userLimit || 0;
  const memberCount = (channel as any).members?.size ?? 0;
  const { allowed, blocked } = getAccessLists(channel);

  const embed = new EmbedBuilder()
    .setColor(locked ? 0xff9800 : 0x00b4d8)
    .setTitle("Channel Control Panel")
    .setDescription(
      `<@${ownerId}>, this is your temporary voice channel.\n\n` +
        `> Status: ${locked ? "**Locked**" : "**Public**"}\n` +
        `> Users: ${memberCount}${limit > 0 ? ` / ${limit}` : ""}\n\n` +
        `Use the buttons below to manage it. The channel is deleted 2 minutes after it goes empty.`,
    )
    .setFooter({ text: "Aegis — Temp VC" })
    .setTimestamp();

  if (allowed.length > 0) {
    embed.addFields({
      name: "Allowed",
      value: allowed.slice(0, 20).map((id) => `<@${id}>`).join(", "),
      inline: false,
    });
  }
  if (blocked.length > 0) {
    embed.addFields({
      name: "Blocked",
      value: blocked.slice(0, 20).map((id) => `<@${id}>`).join(", "),
      inline: false,
    });
  }

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_toggle")
      .setLabel(locked ? "Unlock" : "Lock")
      .setEmoji(locked ? "🔓" : "🔒")
      .setStyle(locked ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_rename")
      .setLabel("Rename")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("tempvc_limit")
      .setLabel("User Limit")
      .setEmoji("👥")
      .setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_allow")
      .setLabel("Allow User")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("tempvc_block")
      .setLabel("Block User")
      .setEmoji("⛔")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_reset_access")
      .setLabel("Reset Access")
      .setEmoji("♻️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_claim")
      .setLabel("Claim")
      .setEmoji("👑")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_close")
      .setLabel("Delete")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row1, row2] };
}

async function requireOwnerPanelContext(interaction: ButtonInteraction | ModalSubmitInteraction) {
  if (!interaction.guild || !interaction.channel) return null;

  const channel: any = await interaction.guild.channels
    .fetch(interaction.channel.id)
    .catch(() => null);
  if (!channel) return null;

  const ownerId = await resolveOwnerId(channel);
  return { channel, ownerId };
}

export async function rememberPanelMessage(channelId: string, messageId: string): Promise<void> {
  panelMessageIds.set(channelId, messageId);
}

export async function handleTempVCButton(interaction: ButtonInteraction): Promise<void> {
  const ctx = await requireOwnerPanelContext(interaction);
  if (!ctx?.channel) return;

  const { channel, ownerId } = ctx;
  const userId = interaction.user.id;
  const customId = interaction.customId;

  if (customId === "tempvc_claim") {
    if (!ownerId) return void interaction.reply({ content: "This channel has no tracked owner.", ephemeral: true }).catch(() => {});
    const members = (channel as any).members as Map<string, unknown> | undefined;
    const ownerPresent = ownerId !== "unknown" && members?.has(ownerId);
    if (ownerPresent && ownerId !== userId) {
      return void interaction.reply({ content: `The owner (<@${ownerId}>) is still in the channel.`, ephemeral: true }).catch(() => {});
    }

    await channel.permissionOverwrites.edit(ownerId === "unknown" ? channel.guild.roles.everyone : ownerId, {
      ManageChannels: null,
      MoveMembers: null,
      MuteMembers: null,
      DeafenMembers: null,
    }).catch(() => {});

    await channel.permissionOverwrites.edit(userId, {
      ManageChannels: true,
      MoveMembers: true,
      MuteMembers: true,
      DeafenMembers: true,
    }).catch(() => {});

    setTempChannelOwner(channel.id, userId);
    const panel = buildOwnerPanel(channel, userId);
    await interaction.update(panel).catch(() => {});
    return;
  }

  if (!ownerId || ownerId !== userId) {
    return void interaction.reply({
      content: `Only the channel owner can use this.${ownerId && ownerId !== "unknown" ? ` (<@${ownerId}>)` : ""}`,
      ephemeral: true,
    }).catch(() => {});
  }

  switch (customId) {
    case "tempvc_toggle": {
      const locked = isLocked(channel);
      await channel.permissionOverwrites.edit(channel.guild.id, {
        Connect: locked ? null : false,
      });
      const panel = buildOwnerPanel(channel, userId);
      await interaction.update(panel).catch(() => {});
      break;
    }
    case "tempvc_rename": {
      const modal = new ModalBuilder()
        .setCustomId("tempvc_rename_modal")
        .setTitle("Rename Channel")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("tempvc_name_input")
              .setLabel("New channel name")
              .setStyle(TextInputStyle.Short)
              .setMinLength(1)
              .setMaxLength(90)
              .setValue((channel as any).name.slice(0, 90))
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal).catch(() => {});
      break;
    }
    case "tempvc_limit": {
      const modal = new ModalBuilder()
        .setCustomId("tempvc_limit_modal")
        .setTitle("Set User Limit")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("tempvc_limit_input")
              .setLabel("Limit (0-99, 0 = unlimited)")
              .setStyle(TextInputStyle.Short)
              .setMaxLength(2)
              .setValue(String((channel as any).userLimit || 0))
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal).catch(() => {});
      break;
    }
    case "tempvc_allow":
    case "tempvc_block": {
      const mode = customId === "tempvc_allow" ? "allow" : "block";
      const menu = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`tempvc_${mode}_select`)
          .setPlaceholder(mode === "allow" ? "Users who CAN join" : "Users who CANNOT join")
          .setMinValues(1)
          .setMaxValues(10),
      );
      await interaction.reply({ content: `Pick up to 10 users to **${mode}**:`, components: [menu], ephemeral: true }).catch(() => {});
      break;
    }
    case "tempvc_reset_access": {
      const { ownerId: currentOwner } = ctx;
      for (const o of [...channel.permissionOverwrites.cache.values()]) {
        if (o.type === OverwriteType.Member && o.id !== currentOwner) {
          await channel.permissionOverwrites.delete(o.id).catch(() => {});
        }
      }
      await interaction.update(buildOwnerPanel(channel, userId)).catch(() => {});
      break;
    }
    case "tempvc_close": {
      panelMessageIds.delete(channel.id);
      await interaction.reply({ content: "Deleting channel...", ephemeral: true }).catch(() => {});
      await removeTempChannel(channel.id).catch(() => {});
      break;
    }
  }
}

export async function handleTempVCSelect(interaction: UserSelectMenuInteraction): Promise<void> {
  if (!interaction.customId.startsWith("tempvc_")) return;
  if (!interaction.guild || !interaction.channel) return;

  const ctx = await requireOwnerPanelContext(interaction as any);
  if (!ctx?.channel || !ctx.ownerId || ctx.ownerId !== interaction.user.id) {
    await interaction.reply({ content: "Only the channel owner can use this.", ephemeral: true }).catch(() => {});
    return;
  }

  const { channel, ownerId } = ctx;
  const isAllow = interaction.customId === "tempvc_allow_select";
  if (!isAllow && interaction.customId !== "tempvc_block_select") return;

  let applied = 0;
  for (const id of interaction.values) {
    if (id === ownerId) continue;
    await channel.permissionOverwrites.edit(
      id,
      isAllow ? { Connect: true, Speak: true } : { Connect: false, Speak: false },
    ).catch(() => {});
    applied++;
  }

  const messageId = panelMessageIds.get(channel.id);
  if (messageId && interaction.channel.isTextBased()) {
    const panelMsg = await (interaction.channel as any).messages.fetch(messageId).catch(() => null);
    if (panelMsg && panelMsg.editable) {
      await panelMsg.edit(buildOwnerPanel(channel, ownerId)).catch(() => {});
    }
  }

  await interaction
    .reply({ content: `${isAllow ? "Allowed" : "Blocked"} ${applied} user(s).`, ephemeral: true })
    .catch(() => {});
}

export async function handleTempVCModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("tempvc_")) return false;
  if (!interaction.guild || !interaction.channel) return true;

  const ctx = await requireOwnerPanelContext(interaction);
  if (!ctx?.channel || !ctx.ownerId || ctx.ownerId !== interaction.user.id) {
    await interaction.reply({ content: "Only the channel owner can use this.", ephemeral: true }).catch(() => {});
    return true;
  }

  const { channel, ownerId } = ctx;

  if (interaction.customId === "tempvc_rename_modal") {
    const name = interaction.fields.getTextInputValue("tempvc_name_input").trim().slice(0, 100);
    if (name) await channel.setName(name).catch(() => {});
  }

  if (interaction.customId === "tempvc_limit_modal") {
    const parsed = parseInt(interaction.fields.getTextInputValue("tempvc_limit_input"), 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 99) {
      await channel.setUserLimit(parsed).catch(() => {});
    }
  }

  const messageId = panelMessageIds.get(channel.id);
  if (messageId && interaction.channel.isTextBased()) {
    const panelMsg = await (interaction.channel as any).messages.fetch(messageId).catch(() => null);
    if (panelMsg && panelMsg.editable) {
      await panelMsg.edit(buildOwnerPanel(channel, ownerId)).catch(() => {});
    }
  }

  await interaction.reply({ content: "Done.", ephemeral: true }).catch(() => {});
  return true;
}
