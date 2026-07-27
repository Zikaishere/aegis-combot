import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import { buildDivision, listTemplates } from "../../server-builder/ServerBuilder.js";
import { registerConfirmation, buildConfirmationEmbed } from "../../safety/ConfirmationHandler.js";

export class BuildCommand extends BaseCommand {
  name = "build";
  description = "Build a division from a template";
  requiredPermissionLevel = PermissionLevel.Owner;

  slashCommand = new SlashCommandBuilder()
    .setName("build")
    .setDescription("Build a division from a template")
    .addSubcommand(sub =>
      sub
        .setName("division")
        .setDescription("Create a division from a template")
        .addStringOption(opt =>
          opt
            .setName("template")
            .setDescription("Division template name")
            .setRequired(true)
            .addChoices(
              ...listTemplates().map(t => ({ name: t, value: t })),
            ),
        ),
    )
    .addSubcommand(sub =>
      sub.setName("templates").setDescription("List all available division templates"),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";

    if (subcommand === "templates") {
      const templates = listTemplates();
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0x00b4d8)
            .setTitle("Available Division Templates")
            .setDescription(templates.map(t => `\`${t}\``).join("\n"))
            .setFooter({ text: "Use /build division <template> to create one" })
            .setTimestamp(),
        ],
      };
    }

    if (subcommand === "division") {
      const templateName = ctx.type === "slash"
        ? (ctx.interaction?.options.getString("template", true) ?? undefined)
        : ctx.args[1];

      if (!templateName) return "Usage: `build division <template>`";

      if (!ctx.guildId) return "This command can only be used in a server.";

      const member = ctx.type === "slash" ? ctx.interaction?.member : ctx.message.member;
      const guild = (member as any)?.guild;
      if (!guild) return "Could not access server instance.";

      const confirmationId = registerConfirmation({
        userId: ctx.userId,
        userTag: ctx.type === "slash"
          ? ctx.interaction?.user.tag ?? "unknown"
          : ctx.message.author.tag,
        action: `build_division:${templateName}`,
        reason: `Create division from template: ${templateName}`,
        affectedResources: [`template:${templateName}`],
        guildId: ctx.guildId ?? undefined,
        channelId: ctx.channelId,
        execute: async () => {
          const result = await buildDivision(
            guild,
            templateName,
            ctx.userId,
            ctx.type === "slash"
              ? ctx.interaction?.user.tag ?? "unknown"
              : ctx.message.author.tag,
          );
          return { success: result.success, message: result.message };
        },
      });

      const confirmEmbed = buildConfirmationEmbed({
        userId: ctx.userId,
        userTag: ctx.type === "slash"
          ? ctx.interaction?.user.tag ?? "unknown"
          : ctx.message.author.tag,
        action: `build_division:${templateName}`,
        reason: `Create division from template: ${templateName}`,
        affectedResources: [`template:${templateName}`],
      });

      return { embeds: [confirmEmbed] };
    }

    return "Unknown subcommand.";
  }
}
