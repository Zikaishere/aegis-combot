import mongoose, { Schema, Document } from "mongoose";

export interface ICanonEvent extends Document {
  title: string;
  date: string;
  description: string;
  involvedFactions: string[];
  involvedLocations: string[];
  involvedAnomalies: string[];
  classificationLevel: number;
  aftermath: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CanonEventSchema = new Schema<ICanonEvent>({
  title: { type: String, required: true, unique: true, index: true },
  date: { type: String, required: true },
  description: { type: String, required: true },
  involvedFactions: [{ type: String }],
  involvedLocations: [{ type: String }],
  involvedAnomalies: [{ type: String }],
  classificationLevel: { type: Number, default: 1, min: 1, max: 5 },
  aftermath: { type: String, required: true },
  isPublic: { type: Boolean, default: false },
}, { timestamps: true });

CanonEventSchema.index({ title: "text", description: "text", aftermath: "text" });

export default mongoose.model<ICanonEvent>("CanonEvent", CanonEventSchema);
