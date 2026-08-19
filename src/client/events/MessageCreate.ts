import type { Message } from "discord.js";
import { getPrefix } from "../../services/ConfigService.js";
import { isBotConversationMessage, stripBotMention } from "../../utils/messageRouting.js";
import { handleConversation } from "../../conversation/ConversationHandler.js";
import { handlePrefix } from "../../commands/CommandBus.js";
import { observe } from "../../dna/observer.js";
import { handleAutoMod } from "../../automod/AutoModService.js";
import { handleModMention } from "../../moderation/ModCommandParser.js";
import { handleGateChannelMessage } from "../../handlers/VerificationHandler.js";
import { handleHoneypotMessage } from "../../handlers/HoneypotHandler.js";
import * as telemetry from "../../telemetry/recorder.js";

export async function handleMessage(message: Message): Promise<void> {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    observe(message);

    const gateBlocked = await handleGateChannelMessage(message as any);
    if (gateBlocked) return;

    const honeypotTriggered = await handleHoneypotMessage(message);
    if (honeypotTriggered) return;

    const autoModHandled = await handleAutoMod(message);
    if (autoModHandled) return;

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

    if (routing.mentioned) {
      const stripped = stripBotMention(message.content, message.client.user!.id);
      const strippedLower = stripped.toLowerCase().trim();

      if (strippedLower.startsWith(prefix.toLowerCase())) {
        message.content = prefix + stripped;
        telemetry.recordMessage();
        await handlePrefix(message);
        return;
      }

      const modHandled = await handleModMention(message, message.client.user!.id);
      if (modHandled) return;
    }

    telemetry.recordMessage();

    await handleConversation(message);
  } catch (error) {
    console.error("Unhandled error in message handler:", error);
  }
}
