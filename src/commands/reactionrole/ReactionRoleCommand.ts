import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { PermissionLevel } from "../../auth/PermissionLevel.js";
import ReactionRole from "../../models/ReactionRole.js";

export class ReactionRoleCommand extends BaseCommand {
  name = "reactionrole";
  description = "Create and manage reaction roles";
  requiredPermissionLevel = PermissionLevel.Administrator;
  requiredPermissions = [PermissionFlagsBits.ManageGuild];

  slashCommand = new SlashCommandBuilder()
    .setName("reactionrole")
    .setDescription("Create and manage reaction roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Create a reaction role message")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to post in").addChannelTypes(ChannelType.GuildText).setRequired(true),
        )
        .addStringOption(opt => opt.setName("title").setDescription("Embed title").setRequired(true))
        .addStringOption(opt => opt.setName("description").setDescription("Embed description").setRequired(true))
        .addStringOption(opt => opt.setName("roles").setDescription("Emoji → Role pairs (e.g. 🔴 Red Role, 🔵 Blue Role)").setRequired(true))
        .addStringOption(opt =>
          opt.setName("type").setDescription("Role assignment type")
            .addChoices(
              { name: "toggle (on/off per role)", value: "toggle" },
              { name: "unique (one at a time)", value: "unique" },
              { name: "multiple (stack roles)", value: "multiple" },
            ),
        )
        .addIntegerOption(opt => opt.setName("color").setDescription("Embed color (hex)")),
    )
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a role to an existing reaction role message")
        .addStringOption(opt => opt.setName("message_id").setDescription("Message ID").setRequired(true))
        .addStringOption(opt => opt.setName("emoji").setDescription("Emoji").setRequired(true))
        .addRoleOption(opt => opt.setName("role").setDescription("Role to assign").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Remove a role from a reaction role message")
        .addStringOption(opt => opt.setName("message_id").setDescription("Message ID").setRequired(true))
        .addStringOption(opt => opt.setName("emoji").setDescription("Emoji to remove").setRequired(true)),
    )
    .addSubcommand(sub =>
      sub.setName("list").setDescription("List all reaction role messages"),
    )
    .addSubcommand(sub =>
      sub.setName("delete").setDescription("Delete a reaction role message")
        .addStringOption(opt => opt.setName("message_id").setDescription("Message ID").setRequired(true)),
    );

  async run(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    const subcommand = ctx.type === "slash"
      ? ctx.interaction?.options.getSubcommand()
      : ctx.args[0];

    if (!subcommand) return "No subcommand provided.";
    if (!ctx.guildId) return "Server only.";

    switch (subcommand) {
      case "create": return this.handleCreate(ctx);
      case "add": return this.handleAdd(ctx);
      case "remove": return this.handleRemove(ctx);
      case "list": return this.handleList(ctx);
      case "delete": return this.handleDelete(ctx);
      default: return "Unknown subcommand.";
    }
  }

  private parseRoles(input: string): { emoji: string; roleId: string; label: string }[] {
    const pairs = input.split(",").map(s => s.trim()).filter(Boolean);
    const results: { emoji: string; roleId: string; label: string }[] = [];

    for (const pair of pairs) {
      const parts = pair.split(/\s+/);
      if (parts.length < 2) continue;

      const emoji = parts[0];
      const rest = parts.slice(1).join(" ");
      const roleIdMatch = rest.match(/<@&(\d+)>/) || rest.match(/^(\d+)$/);
      const roleId = roleIdMatch?.[1] ?? "";
      const label = rest.replace(/<@&\d+>/, "").trim() || rest;

      if (emoji && roleId) {
        results.push({ emoji, roleId, label });
      }
    }

    return results;
  }

  private async handleCreate(ctx: CommandContext): Promise<string | { embeds: any[] }> {
    if (ctx.type !== "slash") return "Use slash commands for this.";

    const channel = ctx.interaction?.options.getChannel("channel");
    const title = ctx.interaction?.options.getString("title", true);
    const description = ctx.interaction?.options.getString("description", true);
    const rolesStr = ctx.interaction?.options.getString("roles", true);
    const type = (ctx.interaction?.options.getString("type") ?? "toggle") as "toggle" | "unique" | "multiple";
    const color = ctx.interaction?.options.getInteger("color");

    if (!channel || !("isTextBased" in channel && channel.isTextBased())) return "Invalid channel.";

    const roles = this.parseRoles(rolesStr || "");
    if (roles.length === 0) return "No valid emoji → role pairs found. Format: `🔴 Role Name, 🔵 Role Name`";

    const botPerms = (channel as any).permissionsFor?.((ctx.interaction?.guild ?? ctx.message?.guild)?.members?.me);
    if (!botPerms?.has(PermissionFlagsBits.SendMessages) || !botPerms?.has(PermissionFlagsBits.EmbedLinks)) {
      return "I don't have permission to send embeds in that channel.";
    }

    const embed = new EmbedBuilder()
      .setColor(color || 0x00b4d8)
      .setTitle(title || "Reaction Roles")
      .setDescription(description || "Select your roles below.");

    if (roles.length <= 10) {
      embed.addFields(
        ...roles.map(r => ({ name: `${r.emoji} ${r.label}`, value: `React with ${r.emoji}`, inline: true })),
      );
    }

    const msg = await (channel as any).send({ embeds: [embed] });

    for (const r of roles) {
      await msg.react(r.emoji).catch(() => {});
    }

    await ReactionRole.create({
      guildId: ctx.guildId,
      channelId: channel.id,
      messageId: msg.id,
      embed: { title, description, color: color || 0x00b4d8 },
      roles,
      type,
      createdBy: ctx.userId,
    });

    return `Reaction role message created in <#${channel.id}> with ${roles.length} role(s).`;
  }

  private async handleAdd(ctx: CommandContext): Promise<string> {
    if (ctx.type !== "slash") return "Use slash commands.";
    const messageId = ctx.interaction?.options.getString("message_id", true);
    const emoji = ctx.interaction?.options.getString("emoji", true);
    const role = ctx.interaction?.options.getRole("role");

    if (!role) return "Specify a role.";

    const rr = await ReactionRole.findOne({ guildId: ctx.guildId, messageId });
    if (!rr) return "Reaction role message not found.";

    if (rr.roles.some(r => r.emoji === emoji)) return "That emoji is already used.";

    const roleId = role.id;
    const roleName: string = String((role as any).name || roleId);
    (rr.roles as any).push({ emoji, roleId, label: roleName });
    await rr.save();

    const channel = await (ctx.interaction?.guild ?? ctx.message?.guild)?.channels.fetch(rr.channelId);
    if (channel && "send" in channel) {
      const msg = await (channel as any).messages.fetch(messageId).catch(() => null);
      if (msg) await msg.react(emoji).catch(() => {});
    }

    return `Added ${emoji} → <@&${role.id}>.`;
  }

  private async handleRemove(ctx: CommandContext): Promise<string> {
    if (ctx.type !== "slash") return "Use slash commands.";
    const messageId = ctx.interaction?.options.getString("message_id", true);
    const emoji = ctx.interaction?.options.getString("emoji", true);

    const rr = await ReactionRole.findOne({ guildId: ctx.guildId, messageId });
    if (!rr) return "Reaction role message not found.";

    const idx = rr.roles.findIndex(r => r.emoji === emoji);
    if (idx === -1) return "That emoji isn't configured.";

    rr.roles.splice(idx, 1);
    await rr.save();

    return `Removed ${emoji}.`;
  }

  private async handleList(ctx: CommandContext): Promise<{ embeds: any[] }> {
    const rrs = await ReactionRole.find({ guildId: ctx.guildId });

    if (rrs.length === 0) {
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0x00b4d8)
            .setTitle("Reaction Roles")
            .setDescription("No reaction role messages configured.")
            .setTimestamp(),
        ],
      };
    }

    const list = rrs.map(rr =>
      `**${rr.embed.title}** — <#${rr.channelId}>\n\`${rr.messageId}\` — ${rr.roles.length} role(s) (${rr.type})`,
    ).join("\n\n");

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle("Reaction Roles")
          .setDescription(list.slice(0, 4096))
          .setFooter({ text: `${rrs.length} message(s)` })
          .setTimestamp(),
      ],
    };
  }

  private async handleDelete(ctx: CommandContext): Promise<string> {
    if (ctx.type !== "slash") return "Use slash commands.";
    const messageId = ctx.interaction?.options.getString("message_id", true);

    const rr = await ReactionRole.findOneAndDelete({ guildId: ctx.guildId, messageId });
    if (!rr) return "Reaction role message not found.";

    const channel = await (ctx.interaction?.guild ?? ctx.message?.guild)?.channels.fetch(rr.channelId);
    if (channel && "messages" in channel) {
      await (channel as any).messages.fetch(messageId).then((m: any) => m.delete()).catch(() => {});
    }

    return "Reaction role message deleted.";
  }
}
