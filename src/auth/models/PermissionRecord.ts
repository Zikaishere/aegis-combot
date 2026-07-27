import mongoose, { Schema, Document } from "mongoose";

export interface IPermissionRecord extends Document {
  discordId: string;
  level: number;
  assignedBy: string;
  assignedAt: Date;
  reason?: string;
}

const PermissionRecordSchema = new Schema<IPermissionRecord>({
  discordId: { type: String, required: true, unique: true, index: true },
  level: { type: Number, required: true, min: 0, max: 4 },
  assignedBy: { type: String, required: true },
  assignedAt: { type: Date, default: Date.now },
  reason: { type: String },
});

export default mongoose.model<IPermissionRecord>("PermissionRecord", PermissionRecordSchema);
