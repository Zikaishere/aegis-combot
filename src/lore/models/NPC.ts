import mongoose, { Schema, Document } from "mongoose";

export type NPCStatus = "active" | "missing" | "deceased" | "erased" | "unknown";

export interface INPC extends Document {
  name: string;
  title: string;
  faction?: string;
  personality: string;
  knowledge: string[];
  secrets: string[];
  relationships: Map<string, string>;
  speakingStyle: string;
  goals: string[];
  status: NPCStatus;
  background?: string;
  lastSeen?: Date;
  interactionHistory: {
    userId: string;
    summary: string;
    timestamp: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const NPCSchema = new Schema<INPC>({
  name: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  faction: { type: String, index: true },
  personality: { type: String, required: true },
  knowledge: [{ type: String }],
  secrets: [{ type: String }],
  relationships: { type: Map, of: String, default: new Map() },
  speakingStyle: { type: String, required: true },
  goals: [{ type: String }],
  status: {
    type: String,
    enum: ["active", "missing", "deceased", "erased", "unknown"],
    default: "active",
    index: true,
  },
  background: { type: String },
  lastSeen: { type: Date },
  interactionHistory: [{
    userId: { type: String, required: true },
    summary: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

NPCSchema.index({ name: "text", personality: "text", background: "text" });

export default mongoose.model<INPC>("NPC", NPCSchema);
