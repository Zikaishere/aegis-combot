import ChatHistory from "../models/ChatHistory.js";
import type { ChatContext } from "../types/index.js";
import { env } from "../config/index.js";

export async function getChatHistory(chatKey: string) {
  let doc = await ChatHistory.findOne({ chatKey });

  if (!doc) {
    doc = new ChatHistory({ chatKey, messages: [] });
    await doc.save();
  }

  return doc.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export async function addToChatHistory(
  chatContext: ChatContext,
  role: string,
  content: string,
) {
  let doc = await ChatHistory.findOne({ chatKey: chatContext.chatKey });

  if (!doc) {
    doc = new ChatHistory({
      chatKey: chatContext.chatKey,
      userId: chatContext.userId,
      channelId: chatContext.channelId,
      guildId: chatContext.guildId,
      messages: [],
    });
  }

  doc.userId = chatContext.userId;
  doc.channelId = chatContext.channelId;
  doc.guildId = chatContext.guildId;
  doc.messages.push({ role, content });

  if (doc.messages.length > env.maxHistory) {
    doc.messages = doc.messages.slice(doc.messages.length - env.maxHistory);
  }

  await doc.save();
}
