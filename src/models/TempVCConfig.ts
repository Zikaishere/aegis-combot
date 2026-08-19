import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface ITempVCConfig extends Document {
  guildId: string;
  enabled: boolean;
  lobbyChannelId: string | null;
  categoryId: string | null;
  channelNameTemplate: string;
  bitrate: number;
  userLimit: number;
}

const tempVCConfigSchema = new Schema<ITempVCConfig>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  lobbyChannelId: { type: String, default: null },
  categoryId: { type: String, default: null },
  channelNameTemplate: { type: String, default: "{username}'s channel" },
  bitrate: { type: Number, default: 64 },
  userLimit: { type: Number, default: 0 },
});

const TempVCConfig = mongoose.model<ITempVCConfig>("TempVCConfig", tempVCConfigSchema);

registerSyncIndexes(() => TempVCConfig.syncIndexes());

export default TempVCConfig;
