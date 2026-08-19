import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IReactionRole extends Document {
  guildId: string;
  channelId: string;
  messageId: string;
  embed: {
    title?: string;
    description?: string;
    color?: number;
    footer?: string;
  };
  roles: {
    emoji: string;
    roleId: string;
    label?: string;
  }[];
  type: "toggle" | "unique" | "multiple";
  createdBy: string;
}

const reactionRoleSchema = new Schema<IReactionRole>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true, unique: true },
  embed: {
    title: { type: String, default: null },
    description: { type: String, default: null },
    color: { type: Number, default: 0x00b4d8 },
    footer: { type: String, default: null },
  },
  roles: [{
    emoji: { type: String, required: true },
    roleId: { type: String, required: true },
    label: { type: String, default: null },
  }],
  type: { type: String, default: "toggle" },
  createdBy: { type: String, required: true },
});

const ReactionRole = mongoose.model<IReactionRole>("ReactionRole", reactionRoleSchema);

registerSyncIndexes(() => ReactionRole.syncIndexes());

export default ReactionRole;
