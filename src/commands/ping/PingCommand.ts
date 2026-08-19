import { SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";

export class PingCommand extends BaseCommand {
  name = "ping";
  description = "Check if Aegis is online";
  aliases = ["pong"];

  slashCommand = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if Aegis is online");

  async run(_ctx: CommandContext): Promise<string> {
    return "pong";
  }
}
