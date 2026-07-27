import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IGuildConfig extends Document {
  guildId: string;
  prefix?: string;
  aiModel?: string;
  maxTokens?: number;
  temperature?: number;
  cooldownMs?: number;
  aiEnabled: boolean;
  allowedChannels: string[];
  promptAdditions: string[];
  telemetryEnabled: boolean;
}

const guildConfigSchema = new Schema<IGuildConfig>({
  guildId: { type: String, required: true, unique: true },
  prefix: { type: String, default: null },
  aiModel: { type: String, default: null },
  maxTokens: { type: Number, default: null },
  temperature: { type: Number, default: null },
  cooldownMs: { type: Number, default: null },
  aiEnabled: { type: Boolean, default: true },
  allowedChannels: { type: [String], default: [] },
  promptAdditions: { type: [String], default: [] },
  telemetryEnabled: { type: Boolean, default: false },
});

const GuildConfig = mongoose.model<IGuildConfig>("GuildConfig", guildConfigSchema);

registerSyncIndexes(() => GuildConfig.syncIndexes());

export default GuildConfig;
