import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { env } from "../../config/index.js";
import { getLoggedError } from "../../services/ErrorService.js";

export class OwnerCommand extends BaseCommand {
  name = "owner";
  description = "Owner-only commands";
  aliases = ["error", "addprompt", "cleardb", "leaveservers"];
  ownerOnly = true;

  slashCommand = new SlashCommandBuilder()
    .setName("owner")
    .setDescription("Owner-only commands")
    .addSubcommand((sub) =>
      sub
        .setName("error")
        .setDescription("Look up an error ID")
        .addStringOption((option) => option.setName("id").setDescription("Error ID").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("addprompt")
        .setDescription("Append to global system prompt")
        .addStringOption((option) => option.setName("text").setDescription("Prompt text").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub.setName("cleardb").setDescription("Wipe all history & memories"),
    )
    .addSubcommand((sub) =>
      sub.setName("leaveservers").setDescription("Make the bot leave all servers"),
    );

  async run(ctx: CommandContext) {
    let cmd: string;

    if (ctx.type === "slash" && ctx.interaction) {
      cmd = ctx.interaction.options.getSubcommand();
    } else {
      cmd = ctx.name === "owner" ? ctx.args[0]?.toLowerCase() || "" : ctx.name;
    }

    if (cmd === "error") return this.lookupError(ctx);
    if (cmd === "addprompt") return this.addPrompt(ctx);
    if (cmd === "cleardb") return this.clearDb(ctx);
    if (cmd === "leaveservers") return this.leaveServers(ctx);

    return this.unknownSubcommand(cmd || undefined);
  }

  private async lookupError(ctx: CommandContext) {
    let errorId: string | null = null;

    if (ctx.type === "slash" && ctx.interaction) {
      errorId = ctx.interaction.options.getString("id");
    } else {
      errorId = ctx.args[0] || null;
    }

    if (!errorId) return { embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("Please provide an error ID.")] };

    const log = await getLoggedError(errorId);
    if (!log) return { embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("Error ID not found.")] };

    const errorTime = Math.floor(log.time.getTime() / 1000);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle(`Error ID: ${errorId.toUpperCase()}`)
      .addFields(
        { name: "Time", value: `<t:${errorTime}:R>`, inline: true },
        { name: "Message", value: log.message, inline: false },
        { name: "Stack Trace", value: `\`\`\`js\n${log.stack.substring(0, 1500)}\n\`\`\``, inline: false },
      );

    return { embeds: [embed] };
  }

  private async addPrompt(ctx: CommandContext) {
    let text: string | null = null;

    if (ctx.type === "slash" && ctx.interaction) {
      text = ctx.interaction.options.getString("text");
    } else {
      text = ctx.args.join(" ").trim() || null;
    }

    if (!text) return "add something bro";

    // Load and update system prompt additions
    const SystemPrompt = (await import("../../models/SystemPrompt")).default;
    await SystemPrompt.findOneAndUpdate(
      { key: "additions" },
      { $push: { additions: text } },
      { upsert: true },
    );

    return "added to system prompt and saved";
  }

  private async clearDb(ctx: CommandContext) {
    try {
      const ChatHistory = (await import("../../models/ChatHistory")).default;
      const UserMemory = (await import("../../models/UserMemory")).default;
      const UserProfile = (await import("../../user-profiles/models/UserProfile")).default;
      const Memory = (await import("../../memory/models/Memory")).default;
      const ServerDNA = (await import("../../models/ServerDNA")).default;
      const ErrorLog = (await import("../../models/ErrorLog")).default;

      const results = await Promise.all([
        ChatHistory.deleteMany({}),
        UserMemory.deleteMany({}),
        UserProfile.deleteMany({}),
        Memory.deleteMany({}),
        ServerDNA.deleteMany({}),
        ErrorLog.deleteMany({}),
      ]);

      const names = ["chat history", "user memory", "user profiles", "guild memories", "server DNA", "error logs"];
      return `nuked: ${names.filter((_, i) => results[i].deletedCount > 0).join(", ")}`;
    } catch (error) {
      return `clear failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async leaveServers(ctx: CommandContext) {
    const client = ctx.type === "slash" && ctx.interaction
      ? ctx.interaction.client
      : ctx.message.client;

    const guilds = client.guilds.cache;
    const count = guilds.size;

    if (count === 0) return "not in any servers";

    try {
      if (ctx.type === "slash" && ctx.interaction) {
        await ctx.interaction.reply(`leaving ${count} server(s)...`);
      }

      const results = await Promise.allSettled(
        guilds.map((g: any) => g.leave()),
      );

      const left = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      const msg = `done. left ${left} server(s)${failed ? `, failed to leave ${failed}` : ""}`;
      if (ctx.type === "slash" && ctx.interaction) {
        await ctx.interaction.followUp(msg);
      }
      return msg;
    } catch (error) {
      return `leave failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
