import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits as Perms } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import TicketConfig from "../../models/TicketConfig.js";
import Ticket from "../../models/Ticket.js";

export class TicketCommand extends BaseCommand {
  name = "ticket";
  description = "Configure the support ticket system";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Configure the support ticket system")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Set up the ticket system")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel for the ticket panel").addChannelTypes(ChannelType.GuildText).setRequired(true),
        )
        .addChannelOption(opt =>
          opt.setName("category").setDescription("Category for ticket channels").addChannelTypes(ChannelType.GuildCategory).setRequired(true),
        )
        .addRoleOption(opt => opt.setName("staff_role").setDescription("Staff role for tickets").setRequired(true))
        .addStringOption(opt => opt.setName("title").setDescription("Panel embed title"))
        .addStringOption(opt => opt.setName("description").setDescription("Panel embed description"))
        .addIntegerOption(opt => opt.setName("color").setDescription("Embed color (hex)")),
    )
    .addSubcommand(sub =>
      sub
        .setName("close")
        .setDescription("Close the current ticket"),
    )
    .addSubcommand(sub =>
      sub
        .setName("claim")
        .setDescription("Claim the current ticket"),
    )
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a user to the current ticket")
        .addUserOption(opt => opt.setName("user").setDescription("User to add").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub.setName("config").setDescription("View ticket configuration"),
    )
    .addSubcommand(sub =>
      sub.setName("transcript").setDescription("Get a transcript of the current ticket"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";
    if (!ctx.guildId) return "Server only.";

    switch (subcommand) {
      case "setup": return this.handleSetup(ctx);
      case "close": return this.handleClose(ctx);
      case "claim": return this.handleClaim(ctx);
      case "add": return this.handleAdd(ctx);
      case "config": return this.handleConfig(ctx);
      case "transcript": return this.handleTranscript(ctx);
      default: return this.unknownSubcommand(subcommand);
    }
  }

  private async getConfig(guildId: string) {
    let config = await TicketConfig.findOne({ guildId });
    if (!config) config = await TicketConfig.create({ guildId });
    return config;
  }

  private async handleSetup(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (ctx.type !== "slash") return "Use slash commands.";

    const channel = ctx.interaction?.options.getChannel("channel");
    const category = ctx.interaction?.options.getChannel("category");
    const staffRole = ctx.interaction?.options.getRole("staff_role");
    const title = ctx.interaction?.options.getString("title") ?? "Support Ticket";
    const description = ctx.interaction?.options.getString("description") ?? "Click the button below to open a support ticket.";
    const color = ctx.interaction?.options.getInteger("color");

    if (!channel || !category || !staffRole) return "Missing required options.";

    const guild = ctx.interaction?.guild ?? ctx.message?.guild;
    const botPerms = (channel as any).permissionsFor?.(guild?.members?.me);
    if (!botPerms?.has(PermissionFlagsBits.SendMessages) || !botPerms?.has(PermissionFlagsBits.EmbedLinks)) {
      return "I don't have permission to send in that channel.";
    }

    const embed = new EmbedBuilder()
      .setColor(color || 0x00b4d8)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: "Aegis — Ticket System" })
      .setTimestamp();

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_create")
        .setLabel("Open Ticket")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎫"),
    );

    const msg = await (channel as any).send({ embeds: [embed], components: [button] });

    const AutoModConfig = (await import("../../models/AutoModConfig.js")).default;
    const autoMod = await AutoModConfig.findOne({ guildId: ctx.guildId });

    await TicketConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      {
        enabled: true,
        channelId: channel.id,
        categoryId: category.id,
        logChannelId: autoMod?.modLogChannelId ?? null,
        embed: { title, description, color: color || 0x00b4d8 },
        staffRoleIds: [staffRole.id],
      },
      { upsert: true },
    );

    return `Ticket system setup in <#${channel.id}>. Panel message: \`${msg.id}\``;
  }

  private async handleClose(ctx: CommandContext): Promise<string> {
    if (!ctx.guildId) return "Server only.";

    const ticket = await Ticket.findOne({ guildId: ctx.guildId, channelId: ctx.channelId, status: "open" });
    if (!ticket) return "No open ticket in this channel.";

    ticket.status = "closed";
    ticket.closedAt = new Date();
    ticket.closedBy = ctx.userId;
    await ticket.save();

    const config = await this.getConfig(ctx.guildId);

    const transcriptText = ticket.transcript
      .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.author}: ${m.content}`)
      .join("\n");

    const guildObj = ctx.interaction?.guild ?? ctx.message?.guild;
    const logChannel = config.logChannelId
      ? await guildObj?.channels.fetch(config.logChannelId).catch(() => null)
      : null;

    if (logChannel && "send" in logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xff1744)
        .setTitle("Ticket Closed")
        .addFields(
          { name: "Ticket", value: `<#${ticket.channelId}>`, inline: true },
          { name: "Opened by", value: `<@${ticket.creatorId}>`, inline: true },
          { name: "Closed by", value: `<@${ctx.userId}>`, inline: true },
          { name: "Messages", value: String(ticket.transcript.length), inline: true },
        )
        .setTimestamp();

      if (transcriptText.length > 0) {
        embed.addFields({ name: "First 5 messages", value: transcriptText.split("\n").slice(0, 5).join("\n").slice(0, 1024) });
      }

      await (logChannel as any).send({ embeds: [embed] }).catch(() => {});
    }

    const replyChannel = ctx.interaction?.channel ?? ctx.message?.channel;
    if (replyChannel && "send" in replyChannel) {
      await (replyChannel as any).send(config.closeMessage || "This ticket has been closed.").catch(() => {});
    }

    setTimeout(async () => {
      const g = ctx.interaction?.guild ?? ctx.message?.guild;
      const channel = await g?.channels.fetch(ticket.channelId).catch(() => null);
      if (channel) await channel.delete().catch(() => {});
    }, 5000);

    return `Ticket closed by <@${ctx.userId}>.`;
  }

  private async handleClaim(ctx: CommandContext): Promise<string> {
    if (!ctx.guildId) return "Server only.";

    const ticket = await Ticket.findOne({ guildId: ctx.guildId, channelId: ctx.channelId, status: "open" });
    if (!ticket) return "No open ticket in this channel.";

    ticket.assignedTo = ctx.userId;
    await ticket.save();

    return `Ticket claimed by <@${ctx.userId}>.`;
  }

  private async handleAdd(ctx: CommandContext): Promise<string> {
    if (!ctx.guildId) return "Server only.";

    const user = ctx.type === "slash"
      ? ctx.interaction?.options.getUser("user")
      : ctx.message.mentions.users.first();

    if (!user) return "Mention a user.";

    const ticket = await Ticket.findOne({ guildId: ctx.guildId, channelId: ctx.channelId, status: "open" });
    if (!ticket) return "No open ticket in this channel.";

    const channel = await (ctx.interaction?.guild ?? ctx.message?.guild)?.channels.fetch(ctx.channelId);
    if (!channel || !("permissionOverwrites" in channel)) return "Cannot modify this channel.";

    await (channel as any).permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    return `<@${user.id}> has been added to the ticket.`;
  }

  private async handleConfig(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const config = await this.getConfig(ctx.guildId!);

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Ticket Configuration")
          .addFields(
            { name: "Status", value: config.enabled ? "Enabled" : "Disabled", inline: true },
            { name: "Panel Channel", value: config.channelId ? `<#${config.channelId}>` : "Not set", inline: true },
            { name: "Category", value: config.categoryId ? `${config.categoryId}` : "Not set", inline: true },
            { name: "Staff Roles", value: config.staffRoleIds.length ? config.staffRoleIds.map(id => `<@&${id}>`).join(", ") : "None", inline: true },
            { name: "Log Channel", value: config.logChannelId ? `<#${config.logChannelId}>` : "Not set", inline: true },
          )
          .setFooter({ text: "Aegis — Ticket System" })
          .setTimestamp(),
      ],
    };
  }

  private async handleTranscript(ctx: CommandContext): Promise<string> {
    if (!ctx.guildId) return "Server only.";

    const ticket = await Ticket.findOne({ guildId: ctx.guildId, channelId: ctx.channelId });
    if (!ticket) return "No ticket found in this channel.";

    const text = ticket.transcript
      .map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.author}: ${m.content}`)
      .join("\n");

    if (!text) return "No messages in transcript.";

    const chunk = text.length > 1900 ? text.slice(0, 1900) + "\n... (truncated)" : text;

    return `**Transcript** (${ticket.transcript.length} messages):\n\`\`\`\n${chunk}\n\`\`\``;
  }
}
