import { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import EmbedTemplate from "../../models/EmbedTemplate.js";

export class EmbedCommand extends BaseCommand {
  name = "embed";
  description = "Create, save, and send custom embeds";
  requiredPermissionLevel = PermissionLevel.Moderator;

  slashCommand = new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Create and send custom embeds")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Create an embed with a JSON body")
        .addStringOption(opt =>
          opt.setName("json").setDescription('Embed JSON body (e.g. {"title":"Hello","description":"World"})').setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("send")
        .setDescription("Send an embed to a channel")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to send to").addChannelTypes(ChannelType.GuildText).setRequired(true),
        )
        .addStringOption(opt =>
          opt.setName("json").setDescription("Embed JSON body").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("preview")
        .setDescription("Preview an embed JSON")
        .addStringOption(opt =>
          opt.setName("json").setDescription("Embed JSON body").setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName("template")
        .setDescription("Manage saved embed templates")
        .addStringOption(opt =>
          opt.setName("action").setDescription("Action to perform").setRequired(true)
            .addChoices(
              { name: "save", value: "save" },
              { name: "load", value: "load" },
              { name: "list", value: "list" },
              { name: "delete", value: "delete" },
            ),
        )
        .addStringOption(opt =>
          opt.setName("name").setDescription("Template name"),
        )
        .addStringOption(opt =>
          opt.setName("json").setDescription("Embed JSON body (for save)"),
        ),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided. Use `embed create`, `embed send`, `embed preview`, or `embed template`.";

    switch (subcommand) {
      case "create":
        return this.handleCreate(ctx);
      case "send":
        return this.handleSend(ctx);
      case "preview":
        return this.handlePreview(ctx);
      case "template":
        return this.handleTemplate(ctx);
      default:
        return this.unknownSubcommand(subcommand);
    }
  }

  private parseEmbedJson(raw: string): Record<string, any> | null {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private buildEmbed(data: Record<string, any>): EmbedBuilder {
    const embed = new EmbedBuilder();

    if (data.title) embed.setTitle(String(data.title).slice(0, 256));
    if (data.description) embed.setDescription(String(data.description).slice(0, 4096));
    if (data.color) embed.setColor(parseInt(String(data.color), 16) || parseInt(String(data.color)) || 0x00b4d8);
    if (data.image) embed.setImage(typeof data.image === "string" ? data.image : data.image?.url);
    if (data.thumbnail) embed.setThumbnail(typeof data.thumbnail === "string" ? data.thumbnail : data.thumbnail?.url);
    if (data.footer) embed.setFooter({ text: String(data.footer).slice(0, 2048) });
    if (data.author) {
      const author = typeof data.author === "string" ? { name: data.author } : data.author;
      embed.setAuthor({ name: String(author.name).slice(0, 256), iconURL: author.icon_url, url: author.url });
    }
    if (Array.isArray(data.fields)) {
      for (const field of data.fields.slice(0, 25)) {
        embed.addFields({
          name: String(field.name).slice(0, 256),
          value: String(field.value).slice(0, 1024),
          inline: Boolean(field.inline),
        });
      }
    }
    if (data.timestamp) embed.setTimestamp(new Date(data.timestamp));

    return embed;
  }

  private async handleCreate(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const raw = ctx.type === "slash"
      ? ctx.interaction?.options.getString("json", true)
      : ctx.args[1];

    if (!raw) return "Provide an embed JSON body. Example: `{\"title\":\"Rules\",\"description\":\"Be nice\"}`";

    const data = this.parseEmbedJson(raw);
    if (!data) return "Invalid JSON. Please provide a valid JSON object.";

    const embed = this.buildEmbed(data);
    return { embeds: [embed] };
  }

  private async handleSend(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const channelId = ctx.type === "slash"
      ? ctx.interaction?.options.getChannel("channel")?.id
      : ctx.args[1]?.replace(/[<#>]/g, "");

    const raw = ctx.type === "slash"
      ? ctx.interaction?.options.getString("json", true)
      : ctx.args[2];

    if (!channelId || !raw) return "Usage: `embed send #channel {\"title\":\"...\",\"description\":\"...\"}`";

    const data = this.parseEmbedJson(raw);
    if (!data) return "Invalid JSON. Please provide a valid JSON object.";

    const guild = ctx.interaction?.guild ?? ctx.message?.guild;
    const channel = await guild?.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return "Invalid channel. Must be a text channel.";

    const botPerms = (channel as any).permissionsFor?.(guild?.members?.me);
    if (!botPerms?.has(PermissionFlagsBits.SendMessages) || !botPerms?.has(PermissionFlagsBits.EmbedLinks)) {
      return "I don't have permission to send embeds in that channel.";
    }

    const embed = this.buildEmbed(data);
    await (channel as any).send({ embeds: [embed] });

    return `Embed sent to <#${channelId}>.`;
  }

  private async handlePreview(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const raw = ctx.type === "slash"
      ? ctx.interaction?.options.getString("json", true)
      : ctx.args[1];

    if (!raw) return "Provide an embed JSON body to preview.";

    const data = this.parseEmbedJson(raw);
    if (!data) return "Invalid JSON. Please provide a valid JSON object.";

    const embed = this.buildEmbed(data);
    return { embeds: [embed] };
  }

  private async handleTemplate(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const action = ctx.type === "slash"
      ? ctx.interaction?.options.getString("action", true)
      : ctx.args[1];

    const name = ctx.type === "slash"
      ? ctx.interaction?.options.getString("name")
      : ctx.args[2];

    const raw = ctx.type === "slash"
      ? ctx.interaction?.options.getString("json")
      : ctx.args[3];

    if (!action) return "Specify an action: `save`, `load`, `list`, or `delete`.";

    switch (action) {
      case "save": return this.templateSave(ctx, name ?? null, raw ?? null);
      case "load": return this.templateLoad(ctx, name ?? null);
      case "list": return this.templateList(ctx);
      case "delete": return this.templateDelete(ctx, name ?? null);
      default: return "Unknown action.";
    }
  }

  private async templateSave(ctx: CommandContext, name: string | null, raw: string | null): Promise<string | { embeds: any[] }> {
    if (!name) return "Provide a template name. Usage: `embed template save <name> {json}`";
    if (!raw) return "Provide an embed JSON body to save.";

    const data = this.parseEmbedJson(raw);
    if (!data) return "Invalid JSON.";

    if (!ctx.guildId) return "Templates can only be saved in a server.";

    await EmbedTemplate.findOneAndUpdate(
      { guildId: ctx.guildId, name: name.toLowerCase() },
      { embed: data, createdBy: ctx.userId, updatedAt: new Date() },
      { upsert: true, new: true },
    );

    return `Template \`${name}\` saved.`;
  }

  private async templateLoad(ctx: CommandContext, name: string | null): Promise<string | { embeds: any[] }> {
    if (!name) return "Provide a template name. Usage: `embed template load <name>` or `embed template load name1,name2,name3`";
    if (!ctx.guildId) return "Templates are server-scoped.";

    const names = name.split(",").map(n => n.trim()).filter(Boolean);

    if (names.length === 1) {
      const template = await EmbedTemplate.findOne({ guildId: ctx.guildId, name: names[0].toLowerCase() });
      if (!template) return `Template \`${names[0]}\` not found.`;
      const embed = this.buildEmbed(template.embed);
      return { embeds: [embed] };
    }

    const embeds: EmbedBuilder[] = [];
    const notFound: string[] = [];

    for (const n of names) {
      const template = await EmbedTemplate.findOne({ guildId: ctx.guildId, name: n.toLowerCase() });
      if (template) {
        embeds.push(this.buildEmbed(template.embed));
      } else {
        notFound.push(n);
      }
    }

    if (embeds.length === 0) return `None of the specified templates found: ${notFound.map(n => `\`${n}\``).join(", ")}`;

    let response = "";
    if (notFound.length > 0) {
      response = `Not found: ${notFound.map(n => `\`${n}\``).join(", ")}\n`;
    }

    if (embeds.length > 0) {
      return { embeds };
    }

    return response || "No embeds loaded.";
  }

  private async templateList(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (!ctx.guildId) return "Templates are server-scoped.";

    const templates = await EmbedTemplate.find({ guildId: ctx.guildId }).sort({ name: 1 });
    if (templates.length === 0) return "No saved templates. Use `embed template save <name> {json}` to create one.";

    const list = templates.map(t => `\`${t.name}\` — ${t.embed.title || "No title"} (by <@${t.createdBy}>)`).join("\n");

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Saved Embed Templates")
          .setDescription(list)
          .setFooter({ text: `${templates.length} template(s)` })
          .setTimestamp(),
      ],
    };
  }

  private async templateDelete(ctx: CommandContext, name: string | null): Promise<string> {
    if (!name) return "Provide a template name. Usage: `embed template delete <name>`";
    if (!ctx.guildId) return "Templates are server-scoped.";

    const result = await EmbedTemplate.deleteOne({ guildId: ctx.guildId, name: name.toLowerCase() });
    if (result.deletedCount === 0) return `Template \`${name}\` not found.`;

    return `Template \`${name}\` deleted.`;
  }
}
