import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IAuditLogEntry extends Document {
  guildId: string;
  action: string;
  moderatorId?: string;
  targetId?: string;
  channelId?: string;
  details: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

const auditLogEntrySchema = new Schema<IAuditLogEntry>({
  guildId: { type: String, required: true },
  action: { type: String, required: true },
  moderatorId: { type: String, default: null },
  targetId: { type: String, default: null },
  channelId: { type: String, default: null },
  details: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed, default: null },
  timestamp: { type: Date, default: Date.now },
});

auditLogEntrySchema.index({ guildId: 1, timestamp: -1 });
auditLogEntrySchema.index({ guildId: 1, action: 1 });

const AuditLogEntry = mongoose.model<IAuditLogEntry>("AuditLogEntry", auditLogEntrySchema);

registerSyncIndexes(() => AuditLogEntry.syncIndexes());

export default AuditLogEntry;
