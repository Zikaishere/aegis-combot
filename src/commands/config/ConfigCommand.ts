import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { env } from "../../config/index.js";
import {
  getGuildConfig,
  getUserConfig,
  getEffectiveConfig,
  updateGuildConfig,
  updateUserConfig,
  addGuildPrompt,
  addCustomFact,
  removeCustomFact,
  getPrefix,
} from "../../services/ConfigService.js";

const VALID_STYLES = ["default", "short", "long", "casual", "formal"];

export class ConfigCommand extends BaseCommand {
  name = "config";
  description = "View or change bot configuration";
  aliases = ["cfg"];

  slashCommand = new SlashCommandBuilder()
    .setName("config")
    .setDescription("View or change bot configuration")
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("View current configuration"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("prefix")
        .setDescription("Change server prefix (admin only)")
        .addStringOption((opt) => opt.setName("value").setDescription("New prefix").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("model")
        .setDescription("Change model for this server (owner only)")
        .addStringOption((opt) => opt.setName("value").setDescription("Model name").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("style")
        .setDescription("Set your chat style")
        .addStringOption((opt) =>
          opt
            .setName("value")
            .setDescription("Style")
            .setRequired(true)
            .addChoices(
              { name: "Default", value: "default" },
              { name: "Short", value: "short" },
              { name: "Long", value: "long" },
              { name: "Casual", value: "casual" },
              { name: "Formal", value: "formal" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("memory")
        .setDescription("Toggle memory for yourself")
        .addStringOption((opt) =>
          opt
            .setName("value")
            .setDescription("on or off")
            .setRequired(true)
            .addChoices(
              { name: "On", value: "on" },
              { name: "Off", value: "off" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("prompt")
        .setDescription("Add a server prompt addition (admin only)")
        .addStringOption((opt) => opt.setName("text").setDescription("Prompt text").setRequired(true)),
    )
    .addSubcommandGroup((group) =>
      group
        .setName("fact")
        .setDescription("Manage custom facts about yourself")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Save a fact about yourself")
            .addStringOption((opt) => opt.setName("text").setDescription("Fact text").setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List your saved facts"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a fact by number")
            .addIntegerOption((opt) => opt.setName("index").setDescription("Fact number").setRequired(true).setMinValue(1)),
        ),
    )
    .addSubcommandGroup((group) =>
      group
        .setName("dna")
        .setDescription("Server DNA management (admin)")
        .addSubcommand((sub) =>
          sub.setName("view").setDescription("View server DNA"),
        )
        .addSubcommand((sub) =>
          sub.setName("reset").setDescription("Reset server DNA"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("set")
            .setDescription("Set a DNA trait value")
            .addStringOption((opt) => opt.setName("trait").setDescription("Trait name").setRequired(true))
            .addNumberOption((opt) => opt.setName("value").setDescription("Value (0-1)").setRequired(true).setMinValue(0).setMaxValue(1)),
        ),
    )
    .addSubcommandGroup((group) =>
      group
        .setName("profile")
        .setDescription("User profile management")
        .addSubcommand((sub) =>
          sub
            .setName("view")
            .setDescription("View a user's profile")
            .addUserOption((opt) => opt.setName("target").setDescription("User to look up").setRequired(false)),
        )
        .addSubcommand((sub) =>
          sub
            .setName("reset")
            .setDescription("Reset a user's profile (admin)")
            .addUserOption((opt) => opt.setName("target").setDescription("User to reset").setRequired(false)),
        ),
    ) as any;

  async run(ctx: CommandContext) {
    if (ctx.type === "slash") {
      return this.handleSlash(ctx);
    }

    return this.handlePrefix(ctx);
  }

  private async handlePrefix(ctx: CommandContext) {
    const sub = (ctx.args[0] || "").toLowerCase();
    const isAdmin = await this.isAdmin(ctx);
    const isOwner = ctx.userId === env.ownerId;
    const p = await getPrefix(ctx.guildId);

    if (sub === "prefix" && ctx.args[1] && isAdmin && ctx.guildId) {
      await updateGuildConfig(ctx.guildId, { prefix: ctx.args[1] });
      return `prefix changed to \`${ctx.args[1]}\``;
    }

    if (sub === "model" && ctx.args[1] && isOwner && ctx.guildId) {
      await updateGuildConfig(ctx.guildId, { aiModel: ctx.args[1] });
      return `model for this server set to \`${ctx.args[1]}\``;
    }

    if (sub === "style" && ctx.args[1]) {
      if (!VALID_STYLES.includes(ctx.args[1])) {
        return `style must be one of: ${VALID_STYLES.join(", ")}`;
      }
      await updateUserConfig(ctx.userId, { style: ctx.args[1] });
      return `your chat style is now \`${ctx.args[1]}\``;
    }

    if (sub === "memory") {
      const enabled = ctx.args[1] !== "off";
      await updateUserConfig(ctx.userId, { memoryEnabled: enabled });
      return `memory is now ${enabled ? "on" : "off"} for you`;
    }

    if (sub === "prompt" && ctx.args.slice(1).length && isAdmin && ctx.guildId) {
      const text = ctx.args.slice(1).join(" ");
      await addGuildPrompt(ctx.guildId, text);
      return "added server prompt addition";
    }

    if (sub === "fact") {
      return this.handleFact(ctx);
    }

    if (sub === "dna" && ctx.guildId) {
      if (!isAdmin) return "nah";
      const action = (ctx.args[1] || "").toLowerCase();
      const { getDNA, resetDNA, updateDNA } = await import("../../dna/observer");

      if (action === "view" || !ctx.args[1]) {
        const dna = await getDNA(ctx.guildId);
        if (!dna || !dna.isReady) {
          return "dna still forming — need at least 25 messages in this server first";
        }
        const { EmbedBuilder } = await import("discord.js");
        const embed = new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Server DNA")
          .addFields(
            { name: "Pacing", value: `${(dna.traits.pacing * 100).toFixed(0)}%`, inline: true },
            { name: "Formality", value: `${(dna.traits.formality * 100).toFixed(0)}%`, inline: true },
            { name: "Humor", value: `${(dna.traits.humorLevel * 100).toFixed(0)}%`, inline: true },
            { name: "Emoji Use", value: `${(dna.traits.emojiFrequency * 100).toFixed(0)}%`, inline: true },
            { name: "Slang Usage", value: `${(dna.traits.slangUsage * 100).toFixed(0)}%`, inline: true },
            { name: "Message Length", value: `${(dna.traits.responseLength * 100).toFixed(0)}%`, inline: true },
            { name: "Messages Observed", value: `${dna.messageCount}`, inline: true },
            { name: "Status", value: dna.isReady ? "Ready" : "Forming...", inline: true },
          );
        if (dna.topSlang?.length) embed.addFields({ name: "Common Slang", value: dna.topSlang.join(", "), inline: false });
        if (dna.commonTopics?.length) embed.addFields({ name: "Common Topics", value: dna.commonTopics.join(", "), inline: false });
        if (dna.commonEmojis?.length) embed.addFields({ name: "Common Emojis", value: dna.commonEmojis.join(" "), inline: false });
        return { embeds: [embed] };
      }

      if (action === "reset") {
        await resetDNA(ctx.guildId);
        return "dna reset. i'll start observing from scratch.";
      }

      if (action === "set" && ctx.args[2] && ctx.args[3] && isAdmin) {
        const trait = ctx.args[2];
        const val = parseFloat(ctx.args[3]);
        if (isNaN(val) || val < 0 || val > 1) return "value must be between 0 and 1";
        await updateDNA(ctx.guildId, { [`traits.${trait}`]: val });
        return `set \`${trait}\` to ${(val * 100).toFixed(0)}%`;
      }

      return "usage: `b.config dna view`, `b.config dna reset`, or `b.config dna set <trait> <0-1>`";
    }

    if (sub === "profile") {
      const action = (ctx.args[1] || "").toLowerCase();
      const { getProfile, resetProfile } = await import("../../user-profiles/ProfileEngine");
      const { EmbedBuilder } = await import("discord.js");

      if (action === "view" || !ctx.args[1]) {
        const targetId = ctx.message.mentions?.users?.first()?.id || ctx.userId;
        const profile = await getProfile(targetId);
        const tag = ctx.message.mentions?.users?.first()?.tag || "You";
        if (!profile) return `${tag} dont have a profile yet — start chatting first`;
        const embed = new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle(`${tag}'s Profile`)
          .setDescription(profile.profile || "No profile summary yet")
          .addFields(
            { name: "Facts", value: profile.facts.length ? profile.facts.map((f, i) => `${i + 1}. ${f}`).join("\n").slice(0, 1024) : "None yet", inline: false },
            { name: "Interests", value: profile.interests.length ? profile.interests.join(", ") : "Still forming", inline: false },
          );
        return { embeds: [embed] };
      }

      if (action === "reset" && isAdmin) {
        const targetId = ctx.message.mentions?.users?.first()?.id || ctx.userId;
        await resetProfile(targetId);
        return "profile reset";
      }

      return "usage: `b.config profile view [@user]` or `b.config profile reset [@user]` (admin)";
    }

    if (sub === "view" || sub === "") {
      return this.buildViewEmbed(ctx);
    }

    if (isAdmin) {
      const valid = ["prefix", "model", "style", "memory", "prompt", "dna", "profile", "fact"];
      return `usage: \`${p}config <${valid.join("|")}> <value>\``;
    }

    return `usage: \`${p}config view\`, \`${p}config style <style>\`, \`${p}config memory on/off\`, \`${p}profile\`, or \`${p}config fact add <text>\``;
  }

  private async handleFact(ctx: CommandContext) {
    const action = (ctx.args[1] || "").toLowerCase();
    const userCfg = await getUserConfig(ctx.userId);

    if (action === "add" && ctx.args.slice(2).length) {
      const text = ctx.args.slice(2).join(" ");
      await addCustomFact(ctx.userId, text);
      return `saved: "${text}"`;
    }

    if (action === "remove" || action === "rm") {
      const idx = parseInt(ctx.args[2], 10);
      if (isNaN(idx) || idx < 1 || idx > userCfg.customFacts.length) {
        return "provide a valid fact number (use `b.config fact list` to see them)";
      }
      const removed = userCfg.customFacts[idx - 1];
      await removeCustomFact(ctx.userId, idx - 1);
      return `removed: "${removed}"`;
    }

    if (action === "list") {
      if (!userCfg.customFacts.length) return "you haven't saved any facts yet";
      const lines = userCfg.customFacts.map((f, i) => `${i + 1}. ${f}`).join("\n");
      return `**Your saved facts:**\n${lines}`;
    }

    return "usage: `b.config fact add <text>`, `b.config fact list`, or `b.config fact remove <n>`";
  }

  private async buildViewEmbed(ctx: CommandContext) {
    const config = await getEffectiveConfig(ctx.guildId, ctx.userId);
    const userCfg = await getUserConfig(ctx.userId);
    const guildCfg = ctx.guildId ? await getGuildConfig(ctx.guildId) : null;

    const embed = new EmbedBuilder()
      .setColor(0x00b4d8)
      .setTitle("Blaze Configuration")
      .addFields(
        {
          name: "🌐 Server",
          value:
            `prefix: \`${config.prefix}\`\n` +
            `model: \`${config.model}\`\n` +
            `ai: ${config.aiEnabled ? "on" : "off"}\n` +
            `cooldown: ${config.cooldownMs}ms\n` +
            `max tokens: ${config.maxTokens}\n` +
            `temperature: ${config.temperature}\n` +
            `allowed channels: ${config.allowedChannels.length ? `<#${config.allowedChannels.join(">, <#")}>` : "all"}` +
            (guildCfg?.promptAdditions?.length ? `\nprompt additions: ${guildCfg.promptAdditions.length}` : ""),
          inline: false,
        },
        {
          name: "👤 You",
          value:
            `style: \`${userCfg.style}\`\n` +
            `memory: ${userCfg.memoryEnabled ? "on" : "off"}\n` +
            `custom facts: ${userCfg.customFacts.length}`,
          inline: false,
        },
      );

    if (userCfg.customFacts.length > 0) {
      embed.addFields({
        name: "📝 Your Facts",
        value: userCfg.customFacts.map((f, i) => `${i + 1}. ${f}`).join("\n").slice(0, 1024),
        inline: false,
      });
    }

    return { embeds: [embed] };
  }

  private async handleSlash(ctx: CommandContext) {
    const interaction = ctx.interaction!;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const value = interaction.options.getString("value");
    const text = interaction.options.getString("text");
    const isAdmin = ctx.userId === env.ownerId || (interaction.member as any)?.permissions?.has(PermissionFlagsBits.Administrator);
    const isOwner = ctx.userId === env.ownerId;

    if (sub === "view") {
      return this.buildViewEmbed(ctx);
    }

    if (sub === "prefix") {
      if (!isAdmin || !ctx.guildId) return "only server admins can change the prefix";
      if (!value) return "provide a prefix value";
      await updateGuildConfig(ctx.guildId, { prefix: value });
      return `prefix changed to \`${value}\``;
    }

    if (sub === "model") {
      if (!isOwner || !ctx.guildId) return "only the bot owner can change the model";
      if (!value) return "provide a model name";
      await updateGuildConfig(ctx.guildId, { aiModel: value });
      return `model for this server set to \`${value}\``;
    }

    if (sub === "style") {
      if (!value || !VALID_STYLES.includes(value)) {
        return `style must be one of: ${VALID_STYLES.join(", ")}`;
      }
      await updateUserConfig(ctx.userId, { style: value });
      return `your chat style is now \`${value}\``;
    }

    if (sub === "memory") {
      const enabled = value !== "off";
      await updateUserConfig(ctx.userId, { memoryEnabled: enabled });
      return `memory is now ${enabled ? "on" : "off"} for you`;
    }

    if (sub === "prompt") {
      if (!isAdmin || !ctx.guildId) return "only server admins can add prompt additions";
      if (!text) return "provide prompt text";
      await addGuildPrompt(ctx.guildId, text);
      return "added server prompt addition";
    }

    if (group === "fact") {
      if (sub === "add") {
        if (!text) return "provide the fact text";
        await addCustomFact(ctx.userId, text);
        return `saved: "${text}"`;
      }
      if (sub === "list") {
        const userCfg = await getUserConfig(ctx.userId);
        if (!userCfg.customFacts.length) return "you haven't saved any facts yet";
        const lines = userCfg.customFacts.map((f, i) => `${i + 1}. ${f}`).join("\n");
        return `**Your saved facts:**\n${lines}`;
      }
      if (sub === "remove") {
        const idx = interaction.options.getInteger("index", true);
        const userCfg = await getUserConfig(ctx.userId);
        if (idx < 1 || idx > userCfg.customFacts.length) return "invalid fact number";
        const removed = userCfg.customFacts[idx - 1];
        await removeCustomFact(ctx.userId, idx - 1);
        return `removed: "${removed}"`;
      }
    }

    if (group === "dna") {
      if (!isAdmin || !ctx.guildId) return "nah";

      if (sub === "view") {
        const dna = await (await import("../../dna/observer")).getDNA(ctx.guildId);
        if (!dna || !dna.isReady) return "dna still forming — need at least 25 messages first";
        const { EmbedBuilder } = await import("discord.js");
        const embed = new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Server DNA")
          .addFields(
            { name: "Pacing", value: `${(dna.traits.pacing * 100).toFixed(0)}%`, inline: true },
            { name: "Formality", value: `${(dna.traits.formality * 100).toFixed(0)}%`, inline: true },
            { name: "Humor", value: `${(dna.traits.humorLevel * 100).toFixed(0)}%`, inline: true },
            { name: "Emoji Use", value: `${(dna.traits.emojiFrequency * 100).toFixed(0)}%`, inline: true },
            { name: "Messages Observed", value: `${dna.messageCount}`, inline: true },
            { name: "Status", value: dna.isReady ? "Ready" : "Forming...", inline: true },
          );
        return { embeds: [embed] };
      }

      if (sub === "reset") {
        await (await import("../../dna/observer")).resetDNA(ctx.guildId);
        return "dna reset";
      }

      if (sub === "set") {
        const trait = interaction.options.getString("trait", true);
        const val = interaction.options.getNumber("value", true);
        await (await import("../../dna/observer")).updateDNA(ctx.guildId, { [`traits.${trait}`]: val });
        return `set \`${trait}\` to ${(val * 100).toFixed(0)}%`;
      }
    }

    if (group === "profile") {
      if (sub === "view") {
        const target = interaction.options.getUser("target");
        const targetId = target?.id || ctx.userId;
        const tag = target?.tag || "You";
        const profile = await (await import("../../user-profiles/ProfileEngine")).getProfile(targetId);
        if (!profile) return `${tag} dont have a profile yet — start chatting first`;
        const { EmbedBuilder } = await import("discord.js");
        const embed = new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle(`${tag}'s Profile`)
          .setDescription(profile.profile || "No profile summary yet")
          .addFields(
            { name: "Facts", value: profile.facts.length ? profile.facts.map((f, i) => `${i + 1}. ${f}`).join("\n").slice(0, 1024) : "None yet", inline: false },
            { name: "Interests", value: profile.interests.length ? profile.interests.join(", ") : "Still forming", inline: false },
          );
        return { embeds: [embed] };
      }

      if (sub === "reset" && isAdmin) {
        const target = interaction.options.getUser("target");
        await (await import("../../user-profiles/ProfileEngine")).resetProfile(target?.id || ctx.userId);
        return "profile reset";
      }
    }

    return "unknown subcommand";
  }

  private async isAdmin(ctx: CommandContext): Promise<boolean> {
    if (ctx.userId === env.ownerId) return true;
    if (!ctx.guildId) return false;

    if (ctx.type === "prefix" || ctx.type === "mention") {
      const member = ctx.message.member;
      if (member && "permissions" in member) {
        return (member as any).permissions.has(PermissionFlagsBits.Administrator);
      }
    }

    return false;
  }
}
