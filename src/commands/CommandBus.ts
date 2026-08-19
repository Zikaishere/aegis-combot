import type { Message, ChatInputCommandInteraction } from "discord.js";
import type { ICommand, CommandContext } from "./types.js";
import { getPrefix } from "../services/ConfigService.js";
import { env } from "../config/index.js";
import { HelpCommand } from "./help/HelpCommand.js";
import { ConfigCommand } from "./config/ConfigCommand.js";
import { OwnerCommand } from "./owner/OwnerCommand.js";
import { MemoryCommand } from "./memory/MemoryCommand.js";
import { ProfileCommand } from "./profile/ProfileCommand.js";
import { PingCommand } from "./ping/PingCommand.js";
import { ModCommand } from "./mod/ModCommand.js";
import { BanCommand } from "./mod/BanCommand.js";
import { KickCommand } from "./mod/KickCommand.js";
import { MuteCommand } from "./mod/MuteCommand.js";
import { WarnCommand } from "./mod/WarnCommand.js";
import { PurgeCommand } from "./mod/PurgeCommand.js";
import { WarningsCommand } from "./mod/WarningsCommand.js";
import { ModLogCommand } from "./mod/ModLogCommand.js";
import { EmbedCommand } from "./embed/EmbedCommand.js";
import { AutoModCommand } from "./config/AutoModCommand.js";
import { WelcomeCommand } from "./welcome/WelcomeCommand.js";
import { GoodbyeCommand } from "./goodbye/GoodbyeCommand.js";
import { AuditLogCommand } from "./auditlog/AuditLogCommand.js";
import { TicketCommand } from "./ticket/TicketCommand.js";
import { VerifyCommand } from "./verify/VerifyCommand.js";
import { HoneypotCommand } from "./honeypot/HoneypotCommand.js";
import { LockdownCommand } from "./mod/LockdownCommand.js";
import { BansCommand } from "./mod/BansCommand.js";
import { SetupCommand } from "./setup/SetupCommand.js";
import { DataCommand } from "./data/DataCommand.js";
import { handleStatsPrefix, handleStatsSlash } from "../telemetry/commands.js";

const commands: Map<string, ICommand> = new Map();
const aliases: Map<string, string> = new Map();

function register(cmd: ICommand): void {
  commands.set(cmd.name, cmd);
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      aliases.set(alias, cmd.name);
    }
  }
}

register(new HelpCommand());
register(new ConfigCommand());
register(new OwnerCommand());
register(new MemoryCommand());
register(new ProfileCommand());
register(new PingCommand());
register(new ModCommand());
register(new BanCommand());
register(new KickCommand());
register(new MuteCommand());
register(new WarnCommand());
register(new PurgeCommand());
register(new WarningsCommand());
register(new ModLogCommand());
register(new EmbedCommand());
register(new AutoModCommand());
register(new WelcomeCommand());
register(new GoodbyeCommand());
register(new AuditLogCommand());
register(new TicketCommand());
register(new VerifyCommand());
register(new HoneypotCommand());
register(new LockdownCommand());
register(new BansCommand());
register(new SetupCommand());
register(new DataCommand());

export function getAllCommands(): Map<string, ICommand> {
  return new Map(commands);
}

export function getSlashCommands() {
  return Array.from(commands.values())
    .filter((c) => c.slashCommand)
    .map((c) => c.slashCommand);
}

export async function handlePrefix(message: Message): Promise<void> {
  const prefix = await getPrefix(message.guildId);
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = (args.shift() || "").toLowerCase();
  const resolved = commands.get(commandName) || commands.get(aliases.get(commandName) || "");

  if (resolved) {
    const ctx: CommandContext = {
      type: "prefix",
      name: commandName,
      args,
      userId: message.author.id,
      guildId: message.guildId,
      channelId: message.channelId,
      message,
    };
    await resolved.execute(ctx);
    return;
  }

  if (commandName === "stats") {
    await handleStatsPrefix(message, args);
  }
}

const OWNER_PREFIX = "aegis ";

export async function handleOwnerPrefix(message: Message): Promise<void> {
  if (message.author.id !== env.ownerId) return;

  const args = message.content.slice(OWNER_PREFIX.length).trim().split(/ +/);
  const commandName = (args.shift() || "").toLowerCase();

  if (commandName === "help") {
    const { handleOwnerHelp } = await import("./help/OwnerHelp.js");
    await handleOwnerHelp(message);
    return;
  }

  const resolved = commands.get(commandName) || commands.get(aliases.get(commandName) || "");
  if (resolved && resolved.ownerOnly) {
    const ctx: CommandContext = {
      type: "prefix",
      name: commandName,
      args,
      userId: message.author.id,
      guildId: message.guildId,
      channelId: message.channelId,
      message,
    };
    await resolved.execute(ctx);
    return;
  }
}

export async function handleSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  const commandName = interaction.commandName;
  const resolved = commands.get(commandName);

  if (resolved) {
    const ctx: CommandContext = {
      type: "slash",
      name: commandName,
      args: [],
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      message: null as any,
      interaction,
    };
    await resolved.execute(ctx);
    return;
  }

  if (commandName === "stats") {
    await handleStatsSlash(interaction);
  }
}


