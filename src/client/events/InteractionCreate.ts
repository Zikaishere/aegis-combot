import type { Interaction, ChatInputCommandInteraction } from "discord.js";
import { handleSlash } from "../../commands/CommandBus.js";
import { logError } from "../../services/ErrorService.js";
import * as telemetry from "../../telemetry/recorder.js";

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleSlash(interaction as ChatInputCommandInteraction);
  } catch (error) {
    telemetry.recordError();
    const errId = await logError(error);
    const reply = `bro idk what just happened. Error ID: \`${errId}\``;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}
