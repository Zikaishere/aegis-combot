import type { Client } from "discord.js";
import { getSlashCommands } from "../../commands/CommandBus.js";
import { env } from "../../config/index.js";

export async function registerSlashCommands(client: Client): Promise<void> {
  try {
    if (!client.application) return;

    const slashData = getSlashCommands();

    if (env.guildId) {
      await client.application.commands.set(slashData, env.guildId);
    } else {
      await client.application.commands.set(slashData);
    }

    console.log(`Slash commands registered (${slashData.length} total)`);
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
}
