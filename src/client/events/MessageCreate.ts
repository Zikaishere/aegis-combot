import type { Message } from "discord.js";
import { getPrefix } from "../../services/ConfigService.js";
import { isBotConversationMessage } from "../../utils/messageRouting.js";
import { handleConversation } from "../../conversation/ConversationHandler.js";
import { handlePrefix } from "../../commands/CommandBus.js";
import { observe } from "../../dna/observer.js";
import * as telemetry from "../../telemetry/recorder.js";

export async function handleMessage(message: Message): Promise<void> {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    observe(message);

    telemetry.addActiveUser(message.author.id);

    const prefix = await getPrefix(message.guildId);
    const contentLower = message.content.toLowerCase();

    if (contentLower.startsWith(prefix.toLowerCase())) {
      telemetry.recordMessage();
      await handlePrefix(message);
      return;
    }

    const routing = isBotConversationMessage(message, message.client.user!.id);
    if (!routing.shouldHandle) return;

    telemetry.recordMessage();

    await handleConversation(message);
  } catch (error) {
    console.error("Unhandled error in message handler:", error);
  }
}
