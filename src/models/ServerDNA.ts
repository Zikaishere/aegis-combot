import mongoose, { Schema, Document } from "mongoose";
import { registerSyncIndexes } from "../services/DatabaseService.js";

export interface IServerDNATraits {
  formality: number;
  humorLevel: number;
  emojiFrequency: number;
  responseLength: number;
  pacing: number;
  slangUsage: number;
  punctuationStyle: number;
  toxicity: number;
}

export interface IServerDNA extends Document {
  guildId: string;
  traits: IServerDNATraits;
  commonEmojis: string[];
  commonTopics: string[];
  topSlang: string[];
  messageCount: number;
  isReady: boolean;
  updatedAt: Date;
}

const traitSchema = new Schema<IServerDNATraits>(
  {
    formality: { type: Number, default: 0.5, min: 0, max: 1 },
    humorLevel: { type: Number, default: 0.5, min: 0, max: 1 },
    emojiFrequency: { type: Number, default: 0.3, min: 0, max: 1 },
    responseLength: { type: Number, default: 0.5, min: 0, max: 1 },
    pacing: { type: Number, default: 0.5, min: 0, max: 1 },
    slangUsage: { type: Number, default: 0.4, min: 0, max: 1 },
    punctuationStyle: { type: Number, default: 0.5, min: 0, max: 1 },
    toxicity: { type: Number, default: 0, min: 0, max: 1 },
  },
  { _id: false },
);

const serverDNASchema = new Schema<IServerDNA>({
  guildId: { type: String, required: true, unique: true },
  traits: { type: traitSchema, default: () => ({}) },
  commonEmojis: { type: [String], default: [] },
  commonTopics: { type: [String], default: [] },
  topSlang: { type: [String], default: [] },
  messageCount: { type: Number, default: 0 },
  isReady: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

const ServerDNA = mongoose.model<IServerDNA>("ServerDNA", serverDNASchema);

registerSyncIndexes(() => ServerDNA.syncIndexes());

export default ServerDNA;
