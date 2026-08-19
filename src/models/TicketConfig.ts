import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface ITicketConfig extends Document {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  categoryId: string | null;
  logChannelId: string | null;
  embed: {
    title?: string;
    description?: string;
    color?: number;
  };
  openMessage: string;
  closeMessage: string;
  staffRoleIds: string[];
}

const ticketConfigSchema = new Schema<ITicketConfig>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  channelId: { type: String, default: null },
  categoryId: { type: String, default: null },
  logChannelId: { type: String, default: null },
  embed: {
    title: { type: String, default: "Support Ticket" },
    description: { type: String, default: "Click the button below to create a support ticket." },
    color: { type: Number, default: 0x00b4d8 },
  },
  openMessage: { type: String, default: "How can we help you? Describe your issue and a staff member will assist you shortly." },
  closeMessage: { type: String, default: "This ticket has been closed." },
  staffRoleIds: { type: [String], default: [] },
});

const TicketConfig = mongoose.model<ITicketConfig>("TicketConfig", ticketConfigSchema);

registerSyncIndexes(() => TicketConfig.syncIndexes());

export default TicketConfig;
