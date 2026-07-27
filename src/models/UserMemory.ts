import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IInfraction {
  type: "warn" | "kick" | "ban";
  reason: string | null;
  moderatorId: string | null;
  timestamp: Date;
  guildId: string | null;
  channelId: string | null;
}

export interface IUserMemory extends Document {
  userId: string;
  profile: string;
  facts: string[];
  messageCount: number;
  moderation: {
    banned: boolean;
    reason: string | null;
    bannedAt: Date | null;
    bannedBy: string | null;
    infractions: IInfraction[];
  };
}

const infractionSchema = new Schema<IInfraction>(
  {
    type: { type: String, enum: ["warn", "kick", "ban"], required: true },
    reason: { type: String, default: null },
    moderatorId: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
    guildId: { type: String, default: null },
    channelId: { type: String, default: null },
  },
  { _id: false },
);

const userMemorySchema = new Schema<IUserMemory>({
  userId: { type: String, required: true, unique: true },
  profile: { type: String, default: "" },
  facts: [String],
  messageCount: { type: Number, default: 0 },
  moderation: {
    banned: { type: Boolean, default: false },
    reason: { type: String, default: null },
    bannedAt: { type: Date, default: null },
    bannedBy: { type: String, default: null },
    infractions: [infractionSchema],
  },
});

const UserMemory = mongoose.model<IUserMemory>("UserMemory", userMemorySchema);

registerSyncIndexes(() => UserMemory.syncIndexes());

export default UserMemory;
