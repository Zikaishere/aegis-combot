import mongoose, { Schema, Document } from "mongoose";

export type FactionStatus = "active" | "disbanded" | "compromised" | "hostile" | "unknown";

export interface IFaction extends Document {
  name: string;
  description: string;
  goals: string[];
  allies: string[];
  enemies: string[];
  status: FactionStatus;
  leader?: string;
  members: string[];
  headquarters?: string;
  establishedDate?: Date;
  notes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const FactionSchema = new Schema<IFaction>({
  name: { type: String, required: true, unique: true, index: true },
  description: { type: String, required: true },
  goals: [{ type: String }],
  allies: [{ type: String }],
  enemies: [{ type: String }],
  status: {
    type: String,
    enum: ["active", "disbanded", "compromised", "hostile", "unknown"],
    default: "unknown",
    index: true,
  },
  leader: { type: String },
  members: [{ type: String }],
  headquarters: { type: String },
  establishedDate: { type: Date },
  notes: [{ type: String }],
}, { timestamps: true });

FactionSchema.index({ name: "text", description: "text" });

export default mongoose.model<IFaction>("Faction", FactionSchema);
