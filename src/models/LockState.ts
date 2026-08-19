import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IChannelPermState {
  channelId: string;
  allow: string[];
  deny: string[];
}

export interface ILockState extends Document {
  guildId: string;
  channelId: string;
  originalOverwrites: IChannelPermState[];
  lockedBy: string;
  lockedAt: Date;
}

const channelPermStateSchema = new Schema<IChannelPermState>({
  channelId: { type: String, required: true },
  allow: { type: [String], default: [] },
  deny: { type: [String], default: [] },
}, { _id: false });

const lockStateSchema = new Schema<ILockState>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  originalOverwrites: { type: [channelPermStateSchema], default: [] },
  lockedBy: { type: String, required: true },
  lockedAt: { type: Date, default: Date.now },
});

lockStateSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

const LockState = mongoose.model<ILockState>("LockState", lockStateSchema);

registerSyncIndexes(() => LockState.syncIndexes());

export default LockState;
