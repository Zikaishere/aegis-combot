import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IErrorLog extends Document {
  errId: string;
  message: string;
  stack: string;
  time: Date;
}

const errorLogSchema = new Schema<IErrorLog>({
  errId: { type: String, required: true, unique: true },
  message: { type: String, default: "" },
  stack: { type: String, default: "No stack trace" },
  time: { type: Date, default: Date.now },
});

errorLogSchema.index({ time: 1 }, { expireAfterSeconds: 604800 });

const ErrorLog = mongoose.model<IErrorLog>("ErrorLog", errorLogSchema);

registerSyncIndexes(() => ErrorLog.syncIndexes());

export default ErrorLog;
