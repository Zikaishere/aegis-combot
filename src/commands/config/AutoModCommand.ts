import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import AutoModConfig from "../../models/AutoModConfig.js";

export class AutoModCommand extends BaseCommand {
  name = "automod";
  description = "Configure auto-moderation";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Configure auto-moderation")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View current auto-mod configuration"),
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable auto-mod")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("spam")
        .setDescription("Configure anti-spam")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable anti-spam").setRequired(true))
        .addIntegerOption(opt => opt.setName("max_messages").setDescription("Max messages in time window").setMinValue(2).setMaxValue(20))
        .addIntegerOption(opt => opt.setName("window_seconds").setDescription("Time window in seconds").setMinValue(3).setMaxValue(60))
        .addStringOption(opt =>
          opt.setName("action").setDescription("Action to take")
            .addChoices(
              { name: "warn", value: "warn" },
              { name: "mute", value: "mute" },
              { name: "kick", value: "kick" },
              { name: "ban", value: "ban" },
            ),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("links")
        .setDescription("Configure link filter")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable link filter").setRequired(true))
        .addStringOption(opt => opt.setName("whitelist").setDescription("Whitelisted domains (comma-separated)"))
        .addStringOption(opt =>
          opt.setName("action").setDescription("Action to take")
            .addChoices(
              { name: "delete", value: "delete" },
              { name: "warn", value: "warn" },
              { name: "mute", value: "mute" },
            ),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("profanity")
        .setDescription("Configure profanity filter with severity tiers")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable profanity filter").setRequired(true))
        .addStringOption(opt =>
          opt.setName("mild_action").setDescription("Action for mild words (damn, hell, crap)")
            .addChoices(
              { name: "allow", value: "allow" },
              { name: "delete (silent)", value: "delete" },
              { name: "warn", value: "warn" },
              { name: "mute", value: "mute" },
            ),
        )
        .addStringOption(opt =>
          opt.setName("medium_action").setDescription("Action for medium words (f*, s*, etc)")
            .addChoices(
              { name: "allow", value: "allow" },
              { name: "delete", value: "delete" },
              { name: "warn", value: "warn" },
              { name: "mute", value: "mute" },
            ),
        )
        .addStringOption(opt =>
          opt.setName("severe_action").setDescription("Action for slurs/hate speech")
            .addChoices(
              { name: "warn", value: "warn" },
              { name: "mute", value: "mute" },
              { name: "kick", value: "kick" },
              { name: "ban", value: "ban" },
            ),
        )
        .addStringOption(opt => opt.setName("custom_mild").setDescription("Custom mild words (comma-separated)"))
        .addStringOption(opt => opt.setName("custom_medium").setDescription("Custom medium words (comma-separated)"))
        .addStringOption(opt => opt.setName("custom_severe").setDescription("Custom severe words (comma-separated)"))
        .addStringOption(opt =>
          opt.setName("preset").setDescription("Use a preset configuration")
            .addChoices(
              { name: "lenient (mild=allow, medium=allow, severe=warn)", value: "lenient" },
              { name: "standard (mild=allow, medium=allow, severe=mute)", value: "standard" },
              { name: "strict (mild=warn, medium=mute, severe=ban)", value: "strict" },
            ),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("exempt")
        .setDescription("Manage channels exempt from all auto-mod filters")
        .addStringOption(opt =>
          opt.setName("action").setDescription("Add, remove, or list exempt channels")
            .addChoices(
              { name: "add", value: "add" },
              { name: "remove", value: "remove" },
              { name: "list", value: "list" },
            ),
        )
        .addChannelOption(opt => opt.setName("channel").setDescription("Channel to exempt"))
        .addStringOption(opt => opt.setName("channels").setDescription("Channel IDs to exempt (comma-separated, for bulk add/remove)")),
    )
    .addSubcommand(sub =>
      sub
        .setName("ai")
        .setDescription("Configure AI-powered moderation (catches context-dependent violations)")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable AI moderation").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("raid")
        .setDescription("Configure raid detection (auto-lockdown on mass joins)")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable raid detection").setRequired(true))
        .addIntegerOption(opt => opt.setName("threshold").setDescription("Joins before lockdown (default 5)").setMinValue(2).setMaxValue(50))
        .addIntegerOption(opt => opt.setName("window_seconds").setDescription("Time window in seconds (default 10)").setMinValue(5).setMaxValue(60)),
    )
    .addSubcommand(sub =>
      sub
        .setName("nuke")
        .setDescription("Configure nuke detection (auto-lockdown on mass deletes/bans/kicks)")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable nuke detection").setRequired(true))
        .addIntegerOption(opt => opt.setName("channel_delete").setDescription("Channel deletes before lockdown (default 3)").setMinValue(2).setMaxValue(20))
        .addIntegerOption(opt => opt.setName("role_delete").setDescription("Role deletes before lockdown (default 3)").setMinValue(2).setMaxValue(20))
        .addIntegerOption(opt => opt.setName("bans").setDescription("Bans before lockdown (default 5)").setMinValue(2).setMaxValue(50))
        .addIntegerOption(opt => opt.setName("kicks").setDescription("Kicks before lockdown (default 5)").setMinValue(2).setMaxValue(50)),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";
    if (!ctx.guildId) return "This command can only be used in a server.";

    switch (subcommand) {
      case "status": return this.handleStatus(ctx);
      case "toggle": return this.handleToggle(ctx);
      case "spam": return this.handleSpam(ctx);
      case "links": return this.handleLinks(ctx);
      case "profanity": return this.handleProfanity(ctx);
      case "exempt": return this.handleExempt(ctx);
      case "ai": return this.handleAI(ctx);
      case "raid": return this.handleRaid(ctx);
      case "nuke": return this.handleNuke(ctx);
      default: return "Unknown subcommand.";
    }
  }

  private async getConfig(guildId: string) {
    let config = await AutoModConfig.findOne({ guildId });
    if (!config) {
      config = await AutoModConfig.create({ guildId });
    }
    return config;
  }

  private async handleStatus(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const config = await this.getConfig(ctx.guildId!);
    const prof = config.profanityFilter;

    const profanityStatus = prof.enabled
      ? `Mild: ${prof.mildAction} | Medium: ${prof.mediumAction} | Severe: ${prof.severeAction}`
      : "Off";

    const exemptList = config.exemptChannels.length > 0
      ? config.exemptChannels.map(id => `<#${id}>`).join(", ")
      : "None";

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(config.enabled ? 0x2ecc71 : 0xff1744)
          .setTitle("Auto-Moderation Configuration")
          .addFields(
            { name: "Status", value: config.enabled ? "Enabled" : "Disabled", inline: true },
            { name: "Anti-Spam", value: config.antiSpam.enabled ? `On (${config.antiSpam.maxMessages} msgs / ${config.antiSpam.timeWindowMs / 1000}s → ${config.antiSpam.action})` : "Off", inline: true },
            { name: "Link Filter", value: config.linkFilter.enabled ? `On (${config.linkFilter.whitelist.length} whitelisted → ${config.linkFilter.action})` : "Off", inline: true },
            { name: "Profanity Filter", value: profanityStatus, inline: false },
            { name: "Exempt Channels", value: exemptList, inline: false },
            { name: "AI Moderation", value: config.aiModeration?.enabled ? "On (context-aware)" : "Off", inline: true },
            { name: "Raid Detection", value: config.raidDetection?.enabled ? "On (" + (config.raidDetection?.threshold ?? 5) + " joins / " + (config.raidDetection?.windowSeconds ?? 10) + "s)" : "Off", inline: true },
            { name: "Nuke Detection", value: config.nukeDetection?.enabled ? "On (auto-lockdown)" : "Off", inline: true },
            { name: "Mod Log", value: config.modLogChannelId ? `<#${config.modLogChannelId}>` : "Not set", inline: true },
            { name: "Audit Log", value: config.auditLogChannelId ? `<#${config.auditLogChannelId}>` : "Not set", inline: true },
          )
          .setFooter({ text: "Aegis — Auto-Moderation" })
          .setTimestamp(),
      ],
    };
  }

  private async handleToggle(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null || enabled === undefined) return "Provide `true` or `false`.";

    await AutoModConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { enabled },
      { upsert: true },
    );

    return `Auto-moderation ${enabled ? "enabled" : "disabled"}.`;
  }

  private async handleSpam(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null || enabled === undefined) return "Provide `enabled true/false`.";

    const update: any = { "antiSpam.enabled": enabled };

    if (ctx.type === "slash") {
      const maxMsgs = ctx.interaction?.options.getInteger("max_messages");
      const windowSec = ctx.interaction?.options.getInteger("window_seconds");
      const action = ctx.interaction?.options.getString("action");
      if (maxMsgs) update["antiSpam.maxMessages"] = maxMsgs;
      if (windowSec) update["antiSpam.timeWindowMs"] = windowSec * 1000;
      if (action) update["antiSpam.action"] = action;
    }

    await AutoModConfig.findOneAndUpdate({ guildId: ctx.guildId }, update, { upsert: true });
    return `Anti-spam ${enabled ? "enabled" : "disabled"}.`;
  }

  private async handleLinks(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null || enabled === undefined) return "Provide `enabled true/false`.";

    const update: any = { "linkFilter.enabled": enabled };

    if (ctx.type === "slash") {
      const whitelist = ctx.interaction?.options.getString("whitelist");
      const action = ctx.interaction?.options.getString("action");
      if (whitelist) update["linkFilter.whitelist"] = whitelist.split(",").map(s => s.trim()).filter(Boolean);
      if (action) update["linkFilter.action"] = action;
    }

    await AutoModConfig.findOneAndUpdate({ guildId: ctx.guildId }, update, { upsert: true });
    return `Link filter ${enabled ? "enabled" : "disabled"}.`;
  }

  private async handleProfanity(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null || enabled === undefined) return "Provide `enabled true/false`.";

    const update: any = { "profanityFilter.enabled": enabled };

    if (ctx.type === "slash") {
      const preset = ctx.interaction?.options.getString("preset");
      const mildAction = ctx.interaction?.options.getString("mild_action");
      const mediumAction = ctx.interaction?.options.getString("medium_action");
      const severeAction = ctx.interaction?.options.getString("severe_action");
      const customMild = ctx.interaction?.options.getString("custom_mild");
      const customMedium = ctx.interaction?.options.getString("custom_medium");
      const customSevere = ctx.interaction?.options.getString("custom_severe");

      if (preset) {
        switch (preset) {
          case "lenient":
            update["profanityFilter.mildAction"] = "allow";
            update["profanityFilter.mediumAction"] = "allow";
            update["profanityFilter.severeAction"] = "warn";
            break;
          case "standard":
            update["profanityFilter.mildAction"] = "allow";
            update["profanityFilter.mediumAction"] = "allow";
            update["profanityFilter.severeAction"] = "mute";
            break;
          case "strict":
            update["profanityFilter.mildAction"] = "warn";
            update["profanityFilter.mediumAction"] = "mute";
            update["profanityFilter.severeAction"] = "ban";
            break;
        }
      } else {
        if (mildAction) update["profanityFilter.mildAction"] = mildAction;
        if (mediumAction) update["profanityFilter.mediumAction"] = mediumAction;
        if (severeAction) update["profanityFilter.severeAction"] = severeAction;
      }

      if (customMild) update["profanityFilter.customMild"] = customMild.split(",").map(s => s.trim()).filter(Boolean);
      if (customMedium) update["profanityFilter.customMedium"] = customMedium.split(",").map(s => s.trim()).filter(Boolean);
      if (customSevere) update["profanityFilter.customSevere"] = customSevere.split(",").map(s => s.trim()).filter(Boolean);
    }

    await AutoModConfig.findOneAndUpdate({ guildId: ctx.guildId }, update, { upsert: true });
    return `Profanity filter ${enabled ? "enabled" : "disabled"}.`;
  }

  private async handleExempt(ctx: CommandContext): Promise<string> {
    if (!ctx.guildId) return "Server only.";

    const action = ctx.type === "slash"
      ? ctx.interaction?.options.getString("action")
      : ctx.args[1];

    if (!action) return "Provide `action add|remove|list`.";

    let channelIds: string[] = [];

    if (ctx.type === "slash") {
      const channel = ctx.interaction?.options.getChannel("channel");
      const bulkChannels = ctx.interaction?.options.getString("channels");
      if (channel) channelIds.push(channel.id);
      if (bulkChannels) {
        channelIds.push(...bulkChannels.split(",").map(s => s.trim()).filter(Boolean));
      }
    }

    const config = await this.getConfig(ctx.guildId);

    switch (action) {
      case "list": {
        if (config.exemptChannels.length === 0) return "No channels exempt from auto-mod.";
        const list = config.exemptChannels.map(id => `<#${id}>`).join("\n");
        return `Exempt channels:\n${list}`;
      }
      case "add": {
        if (channelIds.length === 0) return "Provide at least one channel.";
        const newChannels = [...new Set([...config.exemptChannels, ...channelIds])];
        await AutoModConfig.findOneAndUpdate(
          { guildId: ctx.guildId },
          { exemptChannels: newChannels },
          { upsert: true },
        );
        const added = channelIds.map(id => `<#${id}>`).join(", ");
        return `Exempted from auto-mod: ${added}`;
      }
      case "remove": {
        if (channelIds.length === 0) return "Provide at least one channel.";
        const remaining = config.exemptChannels.filter(id => !channelIds.includes(id));
        await AutoModConfig.findOneAndUpdate(
          { guildId: ctx.guildId },
          { exemptChannels: remaining },
          { upsert: true },
        );
        const removed = channelIds.map(id => `<#${id}>`).join(", ");
        return `Removed from exempt list: ${removed}`;
      }
      default:
        return "Unknown action. Use `add`, `remove`, or `list`.";
    }
  }

  private async handleAI(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null || enabled === undefined) return "Provide `enabled true/false`.";

    await AutoModConfig.findOneAndUpdate(
      { guildId: ctx.guildId },
      { "aiModeration.enabled": enabled },
      { upsert: true },
    );

    return "AI moderation " + (enabled ? "enabled" : "disabled") + ". Messages with suspicious patterns will be analyzed by AI for context-dependent violations.";
  }

  private async handleRaid(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null || enabled === undefined) return "Provide `enabled true/false`.";

    const update: any = { "raidDetection.enabled": enabled };

    if (ctx.type === "slash") {
      const threshold = ctx.interaction?.options.getInteger("threshold");
      const windowSeconds = ctx.interaction?.options.getInteger("window_seconds");
      if (threshold) update["raidDetection.threshold"] = threshold;
      if (windowSeconds) update["raidDetection.windowSeconds"] = windowSeconds;
    }

    await AutoModConfig.findOneAndUpdate({ guildId: ctx.guildId }, update, { upsert: true });

    const config = await AutoModConfig.findOne({ guildId: ctx.guildId });
    const t = config?.raidDetection?.threshold ?? 5;
    const w = config?.raidDetection?.windowSeconds ?? 10;

    return "Raid detection " + (enabled ? "enabled" : "disabled") + ". Lockdown triggers at " + t + " joins within " + w + "s.";
  }

  private async handleNuke(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null || enabled === undefined) return "Provide `enabled true/false`.";

    const update: any = { "nukeDetection.enabled": enabled };

    if (ctx.type === "slash") {
      const channelDelete = ctx.interaction?.options.getInteger("channel_delete");
      const roleDelete = ctx.interaction?.options.getInteger("role_delete");
      const bans = ctx.interaction?.options.getInteger("bans");
      const kicks = ctx.interaction?.options.getInteger("kicks");
      if (channelDelete) update["nukeDetection.channelDeleteThreshold"] = channelDelete;
      if (roleDelete) update["nukeDetection.roleDeleteThreshold"] = roleDelete;
      if (bans) update["nukeDetection.banThreshold"] = bans;
      if (kicks) update["nukeDetection.kickThreshold"] = kicks;
    }

    await AutoModConfig.findOneAndUpdate({ guildId: ctx.guildId }, update, { upsert: true });

    return "Nuke detection " + (enabled ? "enabled" : "disabled") + ". Auto-lockdown on mass destructive actions.";
  }
}
