import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IChatMessage {
  role: string;
  content: string;
}

export interface IChatHistory extends Document {
  chatKey: string;
  userId?: string;
  channelId?: string;
  guildId: string | null;
  messages: IChatMessage[];
}

const chatHistorySchema = new Schema<IChatHistory>({
  chatKey: { type: String, required: true, unique: true },
  userId: { type: String, required: false },
  channelId: { type: String, required: false },
  guildId: { type: String, default: null },
  messages: [
    {
      role: String,
      content: String,
    },
  ],
});

const ChatHistory = mongoose.model<IChatHistory>("ChatHistory", chatHistorySchema);

registerSyncIndexes(() => ChatHistory.syncIndexes());

export default ChatHistory;
