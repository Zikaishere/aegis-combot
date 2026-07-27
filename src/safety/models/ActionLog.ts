import mongoose, { Schema, Document } from "mongoose";

export interface IActionLog extends Document {
  timestamp: Date;
  userId: string;
  userTag: string;
  action: string;
  reason?: string;
  affectedResources: string[];
  result: "success" | "failure" | "cancelled" | "pending_confirmation";
  confirmationReceived: boolean;
  guildId?: string;
  channelId?: string;
}

const ActionLogSchema = new Schema<IActionLog>({
  timestamp: { type: Date, default: Date.now, index: true },
  userId: { type: String, required: true, index: true },
  userTag: { type: String, required: true },
  action: { type: String, required: true, index: true },
  reason: { type: String },
  affectedResources: [{ type: String }],
  result: {
    type: String,
    enum: ["success", "failure", "cancelled", "pending_confirmation"],
    required: true,
  },
  confirmationReceived: { type: Boolean, default: false },
  guildId: { type: String, index: true },
  channelId: { type: String },
});

ActionLogSchema.index({ guildId: 1, timestamp: -1 });
ActionLogSchema.index({ action: 1, timestamp: -1 });

export default mongoose.model<IActionLog>("ActionLog", ActionLogSchema);
