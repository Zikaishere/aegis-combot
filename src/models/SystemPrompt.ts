import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface ISystemPrompt extends Document {
  key: string;
  additions: string[];
}

const systemPromptSchema = new Schema<ISystemPrompt>({
  key: { type: String, required: true, unique: true, default: "additions" },
  additions: [String],
});

const SystemPrompt = mongoose.model<ISystemPrompt>("SystemPrompt", systemPromptSchema);

registerSyncIndexes(() => SystemPrompt.syncIndexes());

export default SystemPrompt;
