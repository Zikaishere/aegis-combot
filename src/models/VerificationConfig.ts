import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IVerificationConfig extends Document {
  guildId: string;
  enabled: boolean;
  gateChannelId: string | null;
  verifiedRoleId: string | null;
  minAccountAgeDays: number;
  dmMessage: string;
  codeLength: number;
  codeExpiryMs: number;
  logChannelId: string | null;
}

const verificationConfigSchema = new Schema<IVerificationConfig>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  gateChannelId: { type: String, default: null },
  verifiedRoleId: { type: String, default: null },
  minAccountAgeDays: { type: Number, default: 7 },
  dmMessage: { type: String, default: "Welcome to {server}! To verify, please enter this code in the verification channel: **{code}**\n\nThis code expires in 10 minutes." },
  codeLength: { type: Number, default: 6 },
  codeExpiryMs: { type: Number, default: 600000 },
  logChannelId: { type: String, default: null },
});

const VerificationConfig = mongoose.model<IVerificationConfig>("VerificationConfig", verificationConfigSchema);

registerSyncIndexes(() => VerificationConfig.syncIndexes());

export default VerificationConfig;
