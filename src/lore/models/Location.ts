import mongoose, { Schema, Document } from "mongoose";

export type LocationType = "facility" | "city" | "natural" | "void" | "anomalous" | "unknown";
export type LocationStatus = "operational" | "compromised" | "erased" | "locked_down" | "abandoned";

export interface ILocation extends Document {
  name: string;
  type: LocationType;
  description: string;
  anomaliesPresent: mongoose.Types.ObjectId[];
  factionControl?: string;
  status: LocationStatus;
  coordinates?: string;
  parentId?: mongoose.Types.ObjectId;
  subLocations: mongoose.Types.ObjectId[];
  operationalNotes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>({
  name: { type: String, required: true, unique: true, index: true },
  type: {
    type: String,
    enum: ["facility", "city", "natural", "void", "anomalous", "unknown"],
    default: "unknown",
    index: true,
  },
  description: { type: String, required: true },
  anomaliesPresent: [{ type: Schema.Types.ObjectId, ref: "Anomaly" }],
  factionControl: { type: String },
  status: {
    type: String,
    enum: ["operational", "compromised", "erased", "locked_down", "abandoned"],
    default: "operational",
    index: true,
  },
  coordinates: { type: String },
  parentId: { type: Schema.Types.ObjectId, ref: "Location" },
  subLocations: [{ type: Schema.Types.ObjectId, ref: "Location" }],
  operationalNotes: [{ type: String }],
}, { timestamps: true });

LocationSchema.index({ name: "text", description: "text" });

export default mongoose.model<ILocation>("Location", LocationSchema);
