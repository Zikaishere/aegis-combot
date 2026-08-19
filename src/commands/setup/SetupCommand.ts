import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";

interface SetupCheck {
  name: string;
  enabled: boolean;
  details: string;
  cmd: string;
}

async function loadChecks(guildId: string): Promise<SetupCheck[]> {
  const [
    verifyConfig,
    autoModConfig,
    honeypotConfig,
    welcomeConfig,
    ticketConfig,
    auditCount,
  ] = await Promise.all([
    import("../../models/VerificationConfig.js").then(m => m.default.findOne({ guildId })),
    import("../../models/AutoModConfig.js").then(m => m.default.findOne({ guildId })),
    import("../../models/HoneypotConfig.js").then(m => m.default.findOne({ guildId })),
    import("../../models/WelcomeConfig.js").then(m => m.default.findOne({ guildId })),
    import("../../models/TicketConfig.js").then(m => m.default.findOne({ guildId })),
    import("../../models/AuditLogEntry.js").then(m => m.default.countDocuments({ guildId })),
  ]);

  const checks: SetupCheck[] = [];

  const verifyReady = !!verifyConfig?.enabled && !!verifyConfig.gateChannelId && !!verifyConfig.verifiedRoleId;
  checks.push({
    name: "Verification",
    enabled: verifyReady,
    details: verifyConfig?.enabled
      ? `Gate: ${verifyConfig.gateChannelId ? `<#${verifyConfig.gateChannelId}>` : "not set"} · Role: ${verifyConfig.verifiedRoleId ? `<@&${verifyConfig.verifiedRoleId}>` : "not set"}`
      : "Not configured",
    cmd: "`/verify setup`",
  });

  const welcomeReady = !!welcomeConfig?.welcome?.enabled;
  checks.push({
    name: "Welcome Messages",
    enabled: welcomeReady,
    details: welcomeConfig?.welcome?.enabled
      ? `Channel: ${welcomeConfig.welcome.channelId ? `<#${welcomeConfig.welcome.channelId}>` : "not set"}`
      : "Not configured",
    cmd: "`/welcome channel` + `/welcome toggle`",
  });

  const autoModReady = !!autoModConfig?.enabled;
  checks.push({
    name: "Auto-Moderation",
    enabled: autoModReady,
    details: autoModConfig?.enabled
      ? `Spam: ${autoModConfig.antiSpam.enabled ? "on" : "off"} · Links: ${autoModConfig.linkFilter.enabled ? "on" : "off"} · Profanity: ${autoModConfig.profanityFilter.enabled ? "on" : "off"}`
      : "Not configured",
    cmd: "`/automod toggle enabled:true`",
  });

  const modLogReady = !!autoModConfig?.modLogChannelId;
  checks.push({
    name: "Moderation Log",
    enabled: modLogReady,
    details: autoModConfig?.modLogChannelId
      ? `Channel: <#${autoModConfig.modLogChannelId}>`
      : "Not configured",
    cmd: "`/modlog #channel`",
  });

  const honeypotReady = !!honeypotConfig?.enabled && (honeypotConfig.trapChannels?.length ?? 0) > 0;
  checks.push({
    name: "Honeypot",
    enabled: honeypotReady,
    details: honeypotConfig?.enabled
      ? `Trap channels: ${honeypotConfig.trapChannels.length} · Log: ${honeypotConfig.logChannelId ? `<#${honeypotConfig.logChannelId}>` : "not set"}`
      : "Not configured",
    cmd: "`/honeypot add #channel`",
  });

  const ticketReady = !!ticketConfig?.enabled;
  checks.push({
    name: "Tickets",
    enabled: ticketReady,
    details: ticketConfig?.enabled
      ? `Panel: ${ticketConfig.channelId ? `<#${ticketConfig.channelId}>` : "not set"} · Category: ${ticketConfig.categoryId ? `<#${ticketConfig.categoryId}>` : "not set"}`
      : "Not configured",
    cmd: "`/ticket setup`",
  });

  checks.push({
    name: "Reaction Roles",
    enabled: false,
    details: "Create reaction role messages",
    cmd: "`/reactionrole create`",
  });

  checks.push({
    name: "AI Channels",
    enabled: false,
    details: "Restrict which channels the AI responds in",
    cmd: "`/config ai-channel`",
  });

  checks.push({
    name: "Audit Log",
    enabled: auditCount > 0,
    details: auditCount > 0
      ? `${auditCount} entries logged`
      : "Will populate as events occur",
    cmd: "`/auditlog status`",
  });

  return checks;
}

export class SetupCommand extends BaseCommand {
  name = "setup";
  description = "Configure all Aegis features";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure all Aegis features")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("overview").setDescription("See the full setup checklist"),
    )
    .addSubcommand(sub =>
      sub
        .setName("reset")
        .setDescription("Reset all configuration for this server")
        .addStringOption(opt =>
          opt.setName("confirm").setDescription("Type CONFIRM to proceed").setRequired(true),
        ),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Server only.";

    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    switch (subcommand) {
      case "overview": return this.handleOverview(ctx);
      case "reset": return this.handleReset(ctx);
      default: return "Unknown subcommand. Use `/setup overview` or `/setup reset`.";
    }
  }

  private async handleOverview(ctx: CommandContext): Promise<{ embeds: any[] }> {
    if (!ctx.guildId) return { embeds: [] };

    const checks = await loadChecks(ctx.guildId);

    const done = checks.filter(c => c.enabled).length;
    const total = checks.length;
    const pct = Math.round((done / total) * 100);

    const bar = pct === 100
      ? "🟩🟩🟩🟩🟩"
      : pct >= 80
        ? "🟩🟩🟩🟩⬜"
        : pct >= 60
          ? "🟩🟩🟩⬜⬜"
          : pct >= 40
            ? "🟩🟩⬜⬜⬜"
            : pct >= 20
              ? "🟩⬜⬜⬜⬜"
              : "⬜⬜⬜⬜⬜";

    const check = (val: boolean) => val ? "✅" : "⬜";

    const lines = checks.map(c =>
      `${check(c.enabled)} **${c.name}**\n` +
      `> ${c.details}\n` +
      `> ${c.cmd}`,
    );

    const embed = new EmbedBuilder()
      .setColor(pct === 100 ? 0x2ecc71 : 0xf59e0b)
      .setTitle("Aegis Setup")
      .setDescription(
        `${bar} **${pct}%** complete (${done}/${total})\n\n` +
        lines.join("\n\n"),
      )
      .setFooter({ text: pct === 100 ? "All features configured!" : "Run the commands above to finish setup" })
      .setTimestamp();

    return { embeds: [embed] };
  }

  private async handleReset(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Server only.";

    const confirm = ctx.type === "slash"
      ? ctx.interaction?.options.getString("confirm")
      : ctx.args[1];

    if (confirm !== "CONFIRM") {
      return "Type `/setup reset confirm:CONFIRM` to proceed. This will **reset all configuration** for this server.";
    }

    const [
      { default: VerificationConfig },
      { default: AutoModConfig },
      { default: HoneypotConfig },
      { default: WelcomeConfig },
      { default: TicketConfig },
      { default: GuildConfig },
    ] = await Promise.all([
      import("../../models/VerificationConfig.js"),
      import("../../models/AutoModConfig.js"),
      import("../../models/HoneypotConfig.js"),
      import("../../models/WelcomeConfig.js"),
      import("../../models/TicketConfig.js"),
      import("../../models/GuildConfig.js"),
    ]);

    const filter = { guildId: ctx.guildId };

    const results = await Promise.all([
      VerificationConfig.deleteMany(filter),
      AutoModConfig.deleteMany(filter),
      HoneypotConfig.deleteMany(filter),
      WelcomeConfig.deleteMany(filter),
      TicketConfig.deleteMany(filter),
      GuildConfig.deleteMany(filter),
    ]);

    const totalDeleted = results.reduce((sum, r) => sum + (r.deletedCount ?? 0), 0);

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("Configuration Reset")
      .setDescription(
        `All **settings** for this server have been reset.\n\n` +
        `**${totalDeleted}** config documents deleted.\n\n` +
        `Data (chat history, warnings, profiles, etc.) was **not** affected. Use \`/data reset\` to wipe everything.`,
      )
      .setFooter({ text: "Aegis — Setup" })
      .setTimestamp();

    return { embeds: [embed] };
  }
}
