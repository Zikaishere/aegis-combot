import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";

export class DataCommand extends BaseCommand {
  name = "data";
  description = "Manage server data";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("data")
    .setDescription("Manage server data")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName("reset")
        .setDescription("Delete ALL data for this server (config + data)")
        .addStringOption(opt =>
          opt.setName("confirm").setDescription("Type CONFIRM to proceed").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub.setName("status").setDescription("See how much data this server has"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Server only.";

    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    switch (subcommand) {
      case "reset": return this.handleReset(ctx);
      case "status": return this.handleStatus(ctx);
      default: return "Unknown subcommand. Use `/data reset` or `/data status`.";
    }
  }

  private async handleReset(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Server only.";

    const confirm = ctx.type === "slash"
      ? ctx.interaction?.options.getString("confirm")
      : ctx.args[1];

    if (confirm !== "CONFIRM") {
      return "Type `/data reset confirm:CONFIRM` to proceed. This will **permanently delete ALL data** for this server.";
    }

    const models = await Promise.all([
      import("../../models/VerificationConfig.js"),
      import("../../models/AutoModConfig.js"),
      import("../../models/HoneypotConfig.js"),
      import("../../models/WelcomeConfig.js"),
      import("../../models/TicketConfig.js"),
      import("../../models/GuildConfig.js"),
      import("../../models/UserConfig.js"),
      import("../../models/ChatHistory.js"),
      import("../../models/ServerDNA.js"),
      import("../../models/UserMemory.js"),
      import("../../models/Warning.js"),
      import("../../models/Ticket.js"),
      import("../../models/ReactionRole.js"),
      import("../../models/AuditLogEntry.js"),
      import("../../models/EmbedTemplate.js"),
      import("../../models/SystemPrompt.js"),
    ]);

    const filter = { guildId: ctx.guildId };

    const modelDeletes = (models as any[]).map(m => m.default.deleteMany(filter));

    const results = await Promise.all([
      ...modelDeletes,
      (models.find(m => m.default.modelName === "ChatHistory")?.default as any)?.deleteMany({ chatKey: { $regex: ctx.guildId } }),
    ]);

    const totalDeleted = results.reduce((sum: number, r: any) => sum + (r?.deletedCount ?? 0), 0);

    const embed = new EmbedBuilder()
      .setColor(0xff1744)
      .setTitle("Data Reset Complete")
      .setDescription(
        `All **settings and data** for this server have been wiped.\n\n` +
        `**${totalDeleted}** documents deleted.\n\n` +
        `Use \`/setup overview\` to reconfigure everything.`,
      )
      .setFooter({ text: "Aegis — Data" })
      .setTimestamp();

    return { embeds: [embed] };
  }

  private async handleStatus(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Server only.";

    const models = await Promise.all([
      import("../../models/VerificationConfig.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/AutoModConfig.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/HoneypotConfig.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/WelcomeConfig.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/TicketConfig.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/ChatHistory.js").then(m => m.default.countDocuments({ chatKey: { $regex: ctx.guildId } })),
      import("../../models/ServerDNA.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/UserMemory.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/Warning.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/Ticket.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/ReactionRole.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/AuditLogEntry.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
      import("../../models/EmbedTemplate.js").then(m => m.default.countDocuments({ guildId: ctx.guildId })),
    ]);

    const labels = [
      "Verification", "AutoMod", "Honeypot", "Welcome", "Tickets",
      "Chat History", "Server DNA", "User Memory", "Warnings",
      "Open Tickets", "Reaction Roles", "Audit Log", "Embed Templates",
    ];

    const lines = labels.map((label, i) => `${label}: **${models[i]}**`);
    const total = models.reduce((sum, n) => sum + n, 0);

    const embed = new EmbedBuilder()
      .setColor(0x00b4d8)
      .setTitle("Server Data")
      .setDescription(lines.join("\n") + `\n\n**Total: ${total}** documents`)
      .setFooter({ text: "Aegis — Data" })
      .setTimestamp();

    return { embeds: [embed] };
  }
}
