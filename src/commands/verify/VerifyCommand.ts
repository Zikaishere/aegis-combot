import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, PermissionsBitField } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import VerificationConfig from "../../models/VerificationConfig.js";

export class VerifyCommand extends BaseCommand {
  name = "verify";
  description = "Configure the verification system";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Configure verification")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("config").setDescription("View verification configuration"),
    )
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Set up the verification system")
        .addChannelOption(opt =>
          opt.setName("gate_channel").setDescription("Channel where unverified users are locked").addChannelTypes(ChannelType.GuildText).setRequired(true),
        )
        .addRoleOption(opt =>
          opt.setName("verified_role").setDescription("Role given after verification").setRequired(true),
        )
        .addIntegerOption(opt =>
          opt.setName("min_account_age").setDescription("Minimum account age in days to auto-verify (default 7)").setMinValue(0).setMaxValue(365),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable verification")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("dm_message")
        .setDescription("Set the DM message sent to new users")
        .addStringOption(opt => opt.setName("message").setDescription("DM message. Use {server} and {code}").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("test")
        .setDescription("Test the verification flow (sends you a DM)"),
    )
    .addSubcommand(sub =>
      sub
        .setName("manual")
        .setDescription("Manually verify a user")
        .addUserOption(opt => opt.setName("user").setDescription("User to verify").setRequired(true)),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";
    if (!ctx.guildId) return "Server only.";

    switch (subcommand) {
      case "config": return this.handleConfig(ctx);
      case "setup": return this.handleSetup(ctx);
      case "toggle": return this.handleToggle(ctx);
      case "dm_message": return this.handleDmMessage(ctx);
      case "test": return this.handleTest(ctx);
      case "manual": return this.handleManual(ctx);
      default: return "Unknown subcommand.";
    }
  }

  private async getConfig(guildId: string) {
    let config = await VerificationConfig.findOne({ guildId });
    if (!config) config = await VerificationConfig.create({ guildId });
    return config;
  }

  private async handleConfig(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const config = await this.getConfig(ctx.guildId!);

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(config.enabled ? 0x2ecc71 : 0xff1744)
          .setTitle("Verification Configuration")
          .addFields(
            { name: "Status", value: config.enabled ? "Enabled" : "Disabled", inline: true },
            { name: "Gate Channel", value: config.gateChannelId ? `<#${config.gateChannelId}>` : "Not set", inline: true },
            { name: "Verified Role", value: config.verifiedRoleId ? `<@&${config.verifiedRoleId}>` : "Not set", inline: true },
            { name: "Min Account Age", value: `${config.minAccountAgeDays} days (auto-verify if older)`, inline: true },
            { name: "Code Length", value: `${config.codeLength} digits`, inline: true },
            { name: "Code Expiry", value: `${config.codeExpiryMs / 60000} minutes`, inline: true },
          )
          .setFooter({ text: "Aegis — Verification System" })
          .setTimestamp(),
      ],
    };
  }

  private async handleSetup(ctx: CommandContext): Promise<string> {
    if (ctx.type !== "slash") return "Use slash commands.";

    const gateChannel = ctx.interaction?.options.getChannel("gate_channel");
    const verifiedRole = ctx.interaction?.options.getRole("verified_role");
    const minAge = ctx.interaction?.options.getInteger("min_account_age") ?? 7;

    if (!gateChannel || !verifiedRole) return "Missing required options.";

    const config = await this.getConfig(ctx.guildId!);
    config.gateChannelId = gateChannel.id;
    config.verifiedRoleId = verifiedRole.id;
    config.minAccountAgeDays = minAge;
    await config.save();

    const channel = await ctx.interaction?.guild?.channels.fetch(gateChannel.id).catch(() => null) as any;
    let locked = false;
    if (channel?.permissionOverwrites) {
      try {
        await channel.permissionOverwrites.edit(ctx.interaction!.guild!.id, {
          SendMessages: false,
        });
        const botMember = ctx.interaction!.guild!.members.me;
        if (botMember) {
          await channel.permissionOverwrites.edit(botMember.id, {
            SendMessages: true,
          });
        }
        locked = true;
      } catch {}
    }

    return `Verification configured:\nGate: <#${gateChannel.id}>${locked ? " (locked — users can only verify via buttons)" : ""}\nRole: <@&${verifiedRole.id}>\nAuto-verify: accounts older than ${minAge} days`;
  }

  private async handleToggle(ctx: CommandContext): Promise<string> {
    const enabled = ctx.type === "slash"
      ? ctx.interaction?.options.getBoolean("enabled", true)
      : ctx.args[1] === "true";

    if (enabled === null) return "Provide `true` or `false`.";

    const config = await this.getConfig(ctx.guildId!);
    config.enabled = !!enabled;
    await config.save();

    return `Verification ${enabled ? "enabled" : "disabled"}.`;
  }

  private async handleDmMessage(ctx: CommandContext): Promise<string> {
    if (ctx.type !== "slash") return "Use slash commands.";
    const message = ctx.interaction?.options.getString("message", true);

    const config = await this.getConfig(ctx.guildId!);
    config.dmMessage = message || config.dmMessage;
    await config.save();

    return "DM message updated. Use `{server}` and `{code}` as placeholders.";
  }

  private async handleTest(ctx: CommandContext): Promise<string> {
    const config = await this.getConfig(ctx.guildId!);
    const guildName = ctx.message.guild?.name || "Server";
    const code = "123456";

    const dmText = config.dmMessage
      .replaceAll("{server}", guildName)
      .replaceAll("{code}", `**${code}**`);

    try {
      await ctx.message.author.send(dmText);
      return "Verification DM sent! Check your DMs.";
    } catch {
      return "I can't DM you. Make sure your DMs are open.";
    }
  }

  private async handleManual(ctx: CommandContext): Promise<string> {
    const user = ctx.type === "slash"
      ? ctx.interaction?.options.getUser("user")
      : ctx.message.mentions.users.first();

    if (!user) return "Mention a user.";
    if (!ctx.guildId) return "Server only.";

    const config = await this.getConfig(ctx.guildId);
    if (!config.verifiedRoleId) return "No verified role configured. Run `/verify setup` first.";

    const member = await ctx.message.guild?.members.fetch(user.id).catch(() => null);
    if (!member) return "User not found.";

    await member.roles.add(config.verifiedRoleId).catch(() => {
      return "Failed to assign role. Check my role hierarchy.";
    });

    return `Verified <@${user.id}>.`;
  }
}
