import mongoose, { Schema, Document } from "mongoose";

export type ThreatClassification = "Threat-1" | "Threat-2" | "Threat-3" | "Threat-4" | "Threat-5";
export type AnomalyStatus = "contained" | "active" | "erased" | "under_investigation";

export interface IAnomaly extends Document {
  designation: string;
  threatLevel: ThreatClassification;
  description: string;
  discoveryDate: Date;
  location?: string;
  status: AnomalyStatus;
  containmentProcedures?: string;
  assignedTeam?: string[];
  notes: string[];
  relatedAnomalies: mongoose.Types.ObjectId[];
  classificationLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

const AnomalySchema = new Schema<IAnomaly>({
  designation: { type: String, required: true, unique: true, index: true },
  threatLevel: {
    type: String,
    enum: ["Threat-1", "Threat-2", "Threat-3", "Threat-4", "Threat-5"],
    required: true,
    index: true,
  },
  description: { type: String, required: true },
  discoveryDate: { type: Date, default: Date.now },
  location: { type: String },
  status: {
    type: String,
    enum: ["contained", "active", "erased", "under_investigation"],
    default: "under_investigation",
    index: true,
  },
  containmentProcedures: { type: String },
  assignedTeam: [{ type: String }],
  notes: [{ type: String }],
  relatedAnomalies: [{ type: Schema.Types.ObjectId, ref: "Anomaly" }],
  classificationLevel: { type: Number, default: 1, min: 1, max: 5 },
}, { timestamps: true });

AnomalySchema.index({ designation: "text", description: "text" });

export default mongoose.model<IAnomaly>("Anomaly", AnomalySchema);
