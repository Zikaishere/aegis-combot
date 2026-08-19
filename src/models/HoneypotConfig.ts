import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IHoneypotConfig extends Document {
  guildId: string;
  enabled: boolean;
  trapChannels: string[];
  logChannelId: string | null;
}

const honeypotConfigSchema = new Schema<IHoneypotConfig>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  trapChannels: { type: [String], default: [] },
  logChannelId: { type: String, default: null },
});

const HoneypotConfig = mongoose.model<IHoneypotConfig>("HoneypotConfig", honeypotConfigSchema);

registerSyncIndexes(() => HoneypotConfig.syncIndexes());

export default HoneypotConfig;
