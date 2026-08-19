import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface ITicket extends Document {
  guildId: string;
  channelId: string;
  creatorId: string;
  status: "open" | "closed";
  assignedTo?: string;
  transcript: { author: string; content: string; timestamp: Date }[];
  createdAt: Date;
  closedAt?: Date;
  closedBy?: string;
}

const ticketSchema = new Schema<ITicket>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true, unique: true },
  creatorId: { type: String, required: true },
  status: { type: String, default: "open" },
  assignedTo: { type: String, default: null },
  transcript: [{
    author: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  closedBy: { type: String, default: null },
});

ticketSchema.index({ guildId: 1, creatorId: 1, status: 1 });

const Ticket = mongoose.model<ITicket>("Ticket", ticketSchema);

registerSyncIndexes(() => Ticket.syncIndexes());

export default Ticket;
