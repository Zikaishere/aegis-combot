import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../../services/DatabaseService.js";

export interface IMemory extends Document {
  key: string;
  value: string;
  tags: string[];
  scope: "guild" | "user" | "global";
  scopeId: string;
  userId: string;
  accessCount: number;
  lastAccessedAt: Date | null;
}

const memorySchema = new Schema<IMemory>(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
    tags: { type: [String], default: [] },
    scope: { type: String, enum: ["guild", "user", "global"], required: true },
    scopeId: { type: String, required: true },
    userId: { type: String, default: "" },
    accessCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

memorySchema.index({ scope: 1, scopeId: 1, key: 1 }, { unique: true });
memorySchema.index({ scope: 1, scopeId: 1, lastAccessedAt: -1 });
memorySchema.index({ value: "text" });

const Memory = mongoose.model<IMemory>("Memory", memorySchema);

registerSyncIndexes(() => Memory.syncIndexes());

export default Memory;
