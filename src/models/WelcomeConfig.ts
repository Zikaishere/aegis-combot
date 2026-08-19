import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IWelcomeConfig extends Document {
  guildId: string;
  welcome: {
    enabled: boolean;
    channelId: string | null;
    embed: {
      title?: string;
      description?: string;
      color?: number;
      imageUrl?: string;
      thumbnailUrl?: string;
      footer?: string;
    };
    message?: string;
  };
  goodbye: {
    enabled: boolean;
    channelId: string | null;
    embed: {
      title?: string;
      description?: string;
      color?: number;
      imageUrl?: string;
      thumbnailUrl?: string;
      footer?: string;
    };
    message?: string;
  };
  autoRole: {
    enabled: boolean;
    roleIds: string[];
  };
}

const welcomeConfigSchema = new Schema<IWelcomeConfig>({
  guildId: { type: String, required: true, unique: true },
  welcome: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    embed: {
      title: { type: String, default: null },
      description: { type: String, default: null },
      color: { type: Number, default: 0x2ecc71 },
      imageUrl: { type: String, default: null },
      thumbnailUrl: { type: String, default: null },
      footer: { type: String, default: null },
    },
    message: { type: String, default: null },
  },
  goodbye: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    embed: {
      title: { type: String, default: null },
      description: { type: String, default: null },
      color: { type: Number, default: 0xff1744 },
      imageUrl: { type: String, default: null },
      thumbnailUrl: { type: String, default: null },
      footer: { type: String, default: null },
    },
    message: { type: String, default: null },
  },
  autoRole: {
    enabled: { type: Boolean, default: false },
    roleIds: { type: [String], default: [] },
  },
});

const WelcomeConfig = mongoose.model<IWelcomeConfig>("WelcomeConfig", welcomeConfigSchema);

registerSyncIndexes(() => WelcomeConfig.syncIndexes());

export default WelcomeConfig;
