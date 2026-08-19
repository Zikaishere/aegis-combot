import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import VerificationConfig from "../../models/VerificationConfig.js";
import AutoModConfig from "../../models/AutoModConfig.js";
import HoneypotConfig from "../../models/HoneypotConfig.js";
import WelcomeConfig from "../../models/WelcomeConfig.js";
import TicketConfig from "../../models/TicketConfig.js";
import AuditLogEntry from "../../models/AuditLogEntry.js";

export class SetupCommand extends BaseCommand {
  name = "setup";
  description = "Interactive setup wizard for all Aegis features";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Interactive setup wizard for all Aegis features")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("overview").setDescription("See the full setup checklist"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Server only.";

    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (subcommand === "overview" || !subcommand) {
      return this.handleOverview(ctx);
    }

    return "Unknown subcommand. Use `/setup overview`.";
  }

  private async handleOverview(ctx: CommandContext): Promise<{ embeds: any[] }> {
    if (!ctx.guildId) return { embeds: [] };

    const [verifyConfig, autoModConfig, honeypotConfig, welcomeConfig, ticketConfig] = await Promise.all([
      VerificationConfig.findOne({ guildId: ctx.guildId }),
      AutoModConfig.findOne({ guildId: ctx.guildId }),
      HoneypotConfig.findOne({ guildId: ctx.guildId }),
      WelcomeConfig.findOne({ guildId: ctx.guildId }),
      TicketConfig.findOne({ guildId: ctx.guildId }),
    ]);

    const auditCount = await AuditLogEntry.countDocuments({ guildId: ctx.guildId });

    const check = (val: boolean) => val ? "✅" : "⬜";

    const items = [
      {
        name: "1. Verification",
        status: check(!!verifyConfig?.enabled && !!verifyConfig?.gateChannelId && !!verifyConfig?.verifiedRoleId),
        details: verifyConfig?.enabled
          ? `Gate: ${verifyConfig.gateChannelId ? `<#${verifyConfig.gateChannelId}>` : "not set"} · Role: ${verifyConfig.verifiedRoleId ? `<@&${verifyConfig.verifiedRoleId}>` : "not set"}`
          : "Not configured — `/verify setup`",
        cmd: "`/verify setup`",
      },
      {
        name: "2. Welcome Messages",
        status: check(!!welcomeConfig?.welcome?.enabled),
        details: welcomeConfig?.welcome?.enabled
          ? `Welcome: ${welcomeConfig.welcome.channelId ? `<#${welcomeConfig.welcome.channelId}>` : "not set"} · Goodbye: ${welcomeConfig.goodbye?.channelId ? `<#${welcomeConfig.goodbye.channelId}>` : "not set"}`
          : "Not configured — `/welcome setup`",
        cmd: "`/welcome channel` + `/welcome toggle`",
      },
      {
        name: "3. Auto-Moderation",
        status: check(!!autoModConfig?.enabled),
        details: autoModConfig?.enabled
          ? `Spam: ${autoModConfig.antiSpam.enabled ? "on" : "off"} · Links: ${autoModConfig.linkFilter.enabled ? "on" : "off"} · Profanity: ${autoModConfig.profanityFilter.enabled ? "on" : "off"}`
          : "Not configured — `/automod toggle enabled`",
        cmd: "`/automod`",
      },
      {
        name: "4. Moderation Log",
        status: check(!!autoModConfig?.modLogChannelId),
        details: autoModConfig?.modLogChannelId
          ? `Log channel: <#${autoModConfig.modLogChannelId}>`
          : "Not configured — `/modlog`",
        cmd: "`/modlog #channel`",
      },
      {
        name: "5. Honeypot",
        status: check(!!honeypotConfig?.enabled && honeypotConfig.trapChannels.length > 0),
        details: honeypotConfig?.enabled
          ? `Trap channels: ${honeypotConfig.trapChannels.length} · Log: ${honeypotConfig.logChannelId ? `<#${honeypotConfig.logChannelId}>` : "not set"}`
          : "Not configured — `/honeypot`",
        cmd: "`/honeypot add #channel`",
      },
      {
        name: "6. Reaction Roles",
        status: "ℹ️",
        details: "Create reaction role messages — `/reactionrole create`",
        cmd: "`/reactionrole create`",
      },
      {
        name: "7. Tickets",
        status: check(!!ticketConfig?.enabled),
        details: ticketConfig?.enabled
          ? `Panel: ${ticketConfig.channelId ? `<#${ticketConfig.channelId}>` : "not set"} · Category: ${ticketConfig.categoryId ? `<#${ticketConfig.categoryId}>` : "not set"}`
          : "Not configured — `/ticket setup`",
        cmd: "`/ticket setup`",
      },
      {
        name: "8. AI Channels",
        status: "ℹ️",
        details: "Restrict which channels the AI responds in — `/config ai-channel`",
        cmd: "`/config ai-channel`",
      },
      {
        name: "9. Audit Log",
        status: check(auditCount > 0),
        details: auditCount > 0
          ? `${auditCount} entries logged`
          : "No entries yet — will populate as events occur",
        cmd: "`/auditlog status`",
      },
    ];

    const description = items.map(item =>
      `${item.status} **${item.name}**\n` +
      `> ${item.details}\n` +
      `> ${item.cmd}`,
    ).join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Aegis Setup Checklist")
      .setDescription(description)
      .setFooter({ text: "Aegis — Setup Wizard" })
      .setTimestamp();

    return { embeds: [embed] };
  }
}
