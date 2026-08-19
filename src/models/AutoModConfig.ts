import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export type SeverityAction = "delete" | "warn" | "mute" | "kick" | "ban" | "allow";

export interface IAutoModConfig extends Document {
  guildId: string;
  enabled: boolean;
  exemptChannels: string[];
  antiSpam: {
    enabled: boolean;
    maxMessages: number;
    timeWindowMs: number;
    action: SeverityAction;
  };
  linkFilter: {
    enabled: boolean;
    whitelist: string[];
    action: SeverityAction;
  };
  profanityFilter: {
    enabled: boolean;
    mildAction: SeverityAction;
    mediumAction: SeverityAction;
    severeAction: SeverityAction;
    customMild: string[];
    customMedium: string[];
    customSevere: string[];
  };
  aiModeration: {
    enabled: boolean;
  };
  modLogChannelId: string | null;
}

const autoModConfigSchema = new Schema<IAutoModConfig>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  exemptChannels: { type: [String], default: [] },
  antiSpam: {
    enabled: { type: Boolean, default: false },
    maxMessages: { type: Number, default: 5 },
    timeWindowMs: { type: Number, default: 5000 },
    action: { type: String, default: "warn" },
  },
  linkFilter: {
    enabled: { type: Boolean, default: false },
    whitelist: { type: [String], default: [] },
    action: { type: String, default: "delete" },
  },
  profanityFilter: {
    enabled: { type: Boolean, default: false },
    mildAction: { type: String, default: "allow" },
    mediumAction: { type: String, default: "allow" },
    severeAction: { type: String, default: "mute" },
    customMild: { type: [String], default: [] },
    customMedium: { type: [String], default: [] },
    customSevere: { type: [String], default: [] },
  },
  aiModeration: {
    enabled: { type: Boolean, default: false },
  },
  modLogChannelId: { type: String, default: null },
});

const AutoModConfig = mongoose.model<IAutoModConfig>("AutoModConfig", autoModConfigSchema);

registerSyncIndexes(() => AutoModConfig.syncIndexes());

export default AutoModConfig;
