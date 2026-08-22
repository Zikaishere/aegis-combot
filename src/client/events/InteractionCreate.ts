import type { Interaction, ChatInputCommandInteraction } from "discord.js";
import { handleSlash } from "../../commands/CommandBus.js";
import { handleVerifyButton, handleVerifyModalSubmit } from "../../handlers/VerificationHandler.js";
import { handleTicketButton, handleTicketClose } from "../../handlers/TicketHandler.js";
import { logError } from "../../services/ErrorService.js";
import * as telemetry from "../../telemetry/recorder.js";

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.guild) return;

  try {
    if (interaction.isButton()) {
      if (interaction.customId === "ticket_create") {
        await handleTicketButton(interaction);
        return;
      }
      if (interaction.customId === "ticket_close") {
        await handleTicketClose(interaction);
        return;
      }
      await handleVerifyButton(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      const handled = await handleVerifyModalSubmit(interaction);
      if (handled) return;
    }

    if (interaction.isChatInputCommand()) {
      await handleSlash(interaction as ChatInputCommandInteraction);
    }
  } catch (error) {
    telemetry.recordError();
    const errId = await logError(error);
    const reply = `bro idk what just happened. Error ID: \`${errId}\``;

    if (interaction.isChatInputCommand() || interaction.isButton() || interaction.isModalSubmit()) {
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch {
        // Interaction already expired; swallow to avoid unhandled rejection.
      }
    }
  }
}
