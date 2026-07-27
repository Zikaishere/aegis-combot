import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../../services/DatabaseService.js";

export interface ITelemetry extends Document {
  timestamp: Date;
  guildCount: number;
  activeUsers: number;
  messagesProcessed: number;
  commandsExecuted: number;
  errorCount: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  tokenEstimate: number;
  commandBreakdown: { name: string; count: number }[];
}

const breakdownSchema = new Schema(
  {
    name: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { _id: false },
);

const telemetrySchema = new Schema<ITelemetry>({
  timestamp: { type: Date, required: true, unique: true },
  guildCount: { type: Number, default: 0 },
  activeUsers: { type: Number, default: 0 },
  messagesProcessed: { type: Number, default: 0 },
  commandsExecuted: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  avgResponseTime: { type: Number, default: 0 },
  p95ResponseTime: { type: Number, default: 0 },
  tokenEstimate: { type: Number, default: 0 },
  commandBreakdown: [breakdownSchema],
});

telemetrySchema.index({ timestamp: -1 });

const Telemetry = mongoose.model<ITelemetry>("Telemetry", telemetrySchema);

registerSyncIndexes(() => Telemetry.syncIndexes());

export default Telemetry;
