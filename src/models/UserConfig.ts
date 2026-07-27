import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IUserConfig extends Document {
  userId: string;
  style: "default" | "short" | "long" | "casual" | "formal";
  memoryEnabled: boolean;
  customFacts: string[];
}

const userConfigSchema = new Schema<IUserConfig>({
  userId: { type: String, required: true, unique: true },
  style: {
    type: String,
    enum: ["default", "short", "long", "casual", "formal"],
    default: "default",
  },
  memoryEnabled: { type: Boolean, default: true },
  customFacts: { type: [String], default: [] },
});

const UserConfig = mongoose.model<IUserConfig>("UserConfig", userConfigSchema);

registerSyncIndexes(() => UserConfig.syncIndexes());

export default UserConfig;
