import type { Message } from "discord.js";
import { getEffectiveConfig } from "../services/ConfigService.js";
import { addToChatHistory, getChatHistory } from "../services/ConversationService.js";
import { getProvider } from "../ai/factory.js";
import { engine } from "../personality/PersonalityEngine.js";
import { buildContext } from "./ContextBuilder.js";
import { checkCooldown, setCooldown } from "./CooldownGuard.js";
import { parseFlags } from "./InlineFlagParser.js";
import { tryAbilities } from "../abilities/AbilityRegistry.js";
import { env } from "../config/index.js";
import { getDNA } from "../dna/observer.js";
import { getProfile, updateProfile } from "../user-profiles/ProfileEngine.js";
import { memoryManager } from "../memory/MemoryManager.js";
import { hasPendingConfirmation, resolveConfirmationByUserId } from "../safety/ConfirmationHandler.js";

async function getServerDNAData(guildId: string | null) {
  if (!guildId) return null;
  try {
    const doc = await getDNA(guildId);
    if (!doc || !doc.isReady) return null;
    return {
      traits: doc.traits,
      confidence: doc.messageCount || 0,
      topSlang: doc.topSlang || [],
    };
  } catch {
    return null;
  }
}

export async function handleConversation(message: Message): Promise<boolean> {
  const context = buildContext(message);
  const config = await getEffectiveConfig(context.guildId, context.userId);

  if (!config.aiEnabled) return false;

  if (config.allowedChannels.length > 0 && !config.allowedChannels.includes(message.channel.id)) {
    return false;
  }

  const rawContent = message.content.trim().toUpperCase();
  if (rawContent === "CONFIRM" || rawContent === "CANCEL") {
    const pending = hasPendingConfirmation(context.userId);
    if (pending) {
      const confirmed = rawContent === "CONFIRM";
      const result = await resolveConfirmationByUserId(context.userId, confirmed);
      if (result.handled && result.message) {
        await message.reply(result.message);
      }
      return true;
    }
  }

  if (checkCooldown(context.userId, config.cooldownMs)) return true;
  setCooldown(context.userId, config.cooldownMs);

  const { clean: userMessage, overrides } = parseFlags(
    message.content,
    context.userId,
    env.ownerId,
    message.guild,
    message.member,
  );

  if (!userMessage) {
    await message.reply("yeah?");
    return true;
  }

  Object.assign(config, overrides);

  const typingInterval = setInterval(
    () => (message.channel as any).sendTyping().catch(() => {}),
    8000,
  );

  async function reply(text: string) {
    clearInterval(typingInterval);
    await message.reply(text);
  }

  try {
    const abilityResult = await tryAbilities(userMessage, context.guildId);
    if (abilityResult) {
      await addToChatHistory(context, "user", userMessage);
      await addToChatHistory(context, "assistant", abilityResult);
      await reply(abilityResult);
      return true;
    }

    await addToChatHistory(context, "user", userMessage);

    const guildMemories = await memoryManager
      .getRelevant("guild", context.guildId || "global", 5)
      .catch(() => []);

    const [fullHistory, userProfile, serverDNA] = await Promise.all([
      getChatHistory(context.chatKey),
      config.memoryEnabled ? getProfile(context.userId) : null,
      getServerDNAData(context.guildId),
    ]);

    const history = fullHistory.slice(-env.contextWindow);

    const userName =
      message.member?.displayName ||
      message.author.globalName ||
      message.author.username;

    const systemPrompt = engine.build({
      userName,
      style: config.style,
      additions: [],
      guildAdditions: config.guildPromptAdditions,
      guildMemories: config.memoryEnabled ? guildMemories : undefined,
      dna: serverDNA,
      userProfile: userProfile?.profile,
      facts: userProfile?.facts,
      interests: userProfile?.interests,
      customFacts: config.customFacts,
      memoryEnabled: config.memoryEnabled,
      abilityNames: [],
    });

    const provider = getProvider();
    const response = await provider.generateChat({
      systemPrompt,
      messages: [...history, { role: "user", content: userMessage }],
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });

    await addToChatHistory(context, "assistant", response.content);
    await reply(response.content);

    if (config.memoryEnabled) {
      updateProfile(context.userId, userName, userMessage, history);
    }
    return true;
  } catch (error) {
    clearInterval(typingInterval);
    console.error("Conversation handler error:", error);
    await message.reply("Operational error. Refer to logs for details.");
    return true;
  }
}
