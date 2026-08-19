import type { ButtonInteraction } from "discord.js";
import { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import TicketConfig from "../models/TicketConfig.js";
import Ticket from "../models/Ticket.js";

export async function handleTicketButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId !== "ticket_create") return;
  if (!interaction.guild) return;

  const config = await TicketConfig.findOne({ guildId: interaction.guild.id });
  if (!config || !config.enabled) {
    await interaction.reply({ content: "Ticket system is not configured.", ephemeral: true });
    return;
  }

  const existing = await Ticket.findOne({
    guildId: interaction.guild.id,
    creatorId: interaction.user.id,
    status: "open",
  });

  if (existing) {
    await interaction.reply({ content: `You already have an open ticket: <#${existing.channelId}>`, ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketNumber = await Ticket.countDocuments({ guildId: interaction.guild.id }) + 1;

  const channel = await interaction.guild.channels.create({
    name: `ticket-${ticketNumber}`,
    type: ChannelType.GuildText,
    parent: config.categoryId || undefined,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      ...config.staffRoleIds.map(id => ({
        id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      })),
    ],
  });

  const ticket = await Ticket.create({
    guildId: interaction.guild.id,
    channelId: channel.id,
    creatorId: interaction.user.id,
    status: "open",
  });

  const staffMentions = config.staffRoleIds.map(id => `<@&${id}>`).join(" ");

  const embed = new EmbedBuilder()
    .setColor(0x00b4d8)
    .setTitle(`Ticket #${ticketNumber}`)
    .setDescription(config.openMessage)
    .addFields(
      { name: "Created by", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Ticket ID", value: `\`${ticket.id}\``, inline: true },
    )
    .setFooter({ text: "Aegis — Ticket System" })
    .setTimestamp();

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒"),
  );

  await channel.send({ content: staffMentions, embeds: [embed], components: [closeRow] });

  await interaction.editReply(`Ticket created: <#${channel.id}>`);
}

export async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId !== "ticket_close") return;
  if (!interaction.guild) return;

  const ticket = await Ticket.findOne({
    guildId: interaction.guild.id,
    channelId: interaction.channelId,
    status: "open",
  });

  if (!ticket) {
    await interaction.reply({ content: "No open ticket found in this channel.", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  ticket.status = "closed";
  ticket.closedAt = new Date();
  ticket.closedBy = interaction.user.id;
  await ticket.save();

  const config = await TicketConfig.findOne({ guildId: interaction.guild.id });

  const logChannel = config?.logChannelId
    ? await interaction.guild.channels.fetch(config.logChannelId).catch(() => null)
    : null;

  if (logChannel && "send" in logChannel) {
    const transcriptText = ticket.transcript
      .slice(-10)
      .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.author}: ${m.content}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0xff1744)
      .setTitle(`Ticket #${await Ticket.countDocuments({ guildId: interaction.guild.id })} Closed`)
      .addFields(
        { name: "Opened by", value: `<@${ticket.creatorId}>`, inline: true },
        { name: "Closed by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Messages", value: String(ticket.transcript.length), inline: true },
      )
      .setTimestamp();

    if (transcriptText) {
      embed.addFields({ name: "Last messages", value: transcriptText.slice(0, 1024) });
    }

    await (logChannel as any).send({ embeds: [embed] }).catch(() => {});
  }

  await interaction.editReply(config?.closeMessage || "Ticket closed.");

  setTimeout(async () => {
    const ch = await interaction.guild?.channels.fetch(ticket.channelId).catch(() => null);
    if (ch) await ch.delete().catch(() => {});
  }, 5000);
}
