import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IEmbedTemplate extends Document {
  guildId: string;
  name: string;
  embed: {
    title?: string;
    description?: string;
    color?: number;
    imageUrl?: string;
    thumbnailUrl?: string;
    footer?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
  };
  createdBy: string;
  updatedAt: Date;
}

const embedTemplateSchema = new Schema<IEmbedTemplate>({
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  embed: {
    title: { type: String, default: null },
    description: { type: String, default: null },
    color: { type: Number, default: null },
    imageUrl: { type: String, default: null },
    thumbnailUrl: { type: String, default: null },
    footer: { type: String, default: null },
    fields: [{
      name: { type: String, required: true },
      value: { type: String, required: true },
      inline: { type: Boolean, default: false },
    }],
  },
  createdBy: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

embedTemplateSchema.index({ guildId: 1, name: 1 }, { unique: true });

const EmbedTemplate = mongoose.model<IEmbedTemplate>("EmbedTemplate", embedTemplateSchema);

registerSyncIndexes(() => EmbedTemplate.syncIndexes());

export default EmbedTemplate;
