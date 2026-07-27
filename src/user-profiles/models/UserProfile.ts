import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../../services/DatabaseService.js";

export interface IUserProfile extends Document {
  userId: string;
  profile: string;
  facts: string[];
  interests: string[];
  topicCounts: Map<string, number>;
  messageCount: number;
  lastExtractedAt: Date | null;
  updatedAt: Date;
}

const userProfileSchema = new Schema<IUserProfile>(
  {
    userId: { type: String, required: true, unique: true },
    profile: { type: String, default: "" },
    facts: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    topicCounts: { type: Map, of: Number, default: new Map() },
    messageCount: { type: Number, default: 0 },
    lastExtractedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const UserProfile = mongoose.model<IUserProfile>("UserProfile", userProfileSchema);

registerSyncIndexes(() => UserProfile.syncIndexes());

export default UserProfile;
