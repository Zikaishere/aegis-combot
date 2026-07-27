import mongoose, { Schema, Document } from "mongoose";

export interface ITimelineEvent {
  date: string;
  description: string;
  realityShift: boolean;
  relatedFactions: string[];
  relatedAnomalies: string[];
  classificationLevel: number;
}

export interface ITimeline extends Document {
  designation: string;
  description: string;
  events: ITimelineEvent[];
  divergences: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TimelineEventSchema = new Schema<ITimelineEvent>({
  date: { type: String, required: true },
  description: { type: String, required: true },
  realityShift: { type: Boolean, default: false },
  relatedFactions: [{ type: String }],
  relatedAnomalies: [{ type: String }],
  classificationLevel: { type: Number, default: 1, min: 1, max: 5 },
}, { _id: false });

const TimelineSchema = new Schema<ITimeline>({
  designation: { type: String, required: true, unique: true, index: true },
  description: { type: String, required: true },
  events: [TimelineEventSchema],
  divergences: [{ type: String }],
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

TimelineSchema.index({ designation: "text", description: "text" });

export default mongoose.model<ITimeline>("Timeline", TimelineSchema);
