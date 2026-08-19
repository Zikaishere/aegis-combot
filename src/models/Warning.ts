import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IWarning extends Document {
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  active: boolean;
  createdAt: Date;
}

const warningSchema = new Schema<IWarning>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

warningSchema.index({ guildId: 1, userId: 1 });
warningSchema.index({ guildId: 1, userId: 1, active: 1 });

const Warning = mongoose.model<IWarning>("Warning", warningSchema);

registerSyncIndexes(() => Warning.syncIndexes());

export default Warning;
