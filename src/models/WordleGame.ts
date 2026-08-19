import mongoose, { Schema, Document } from "mongoose";

export interface IWordleGame extends Document {
  guildId: string;
  channelId: string;
  word: string;
  guesses: string[];
  playerId: string;
  active: boolean;
  won: boolean;
  startedAt: Date;
}

const wordleGameSchema = new Schema<IWordleGame>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  word: { type: String, required: true },
  guesses: [{ type: String }],
  playerId: { type: String, required: true },
  active: { type: Boolean, default: true },
  won: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now },
});

wordleGameSchema.index({ channelId: 1, active: 1 });
wordleGameSchema.index({ guildId: 1, playerId: 1 });

export const WordleGame = mongoose.model<IWordleGame>("WordleGame", wordleGameSchema);

export interface IWordleStats extends Document {
  guildId: string;
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  lastWonAt: Date | null;
}

const wordleStatsSchema = new Schema<IWordleStats>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  maxStreak: { type: Number, default: 0 },
  lastWonAt: { type: Date, default: null },
});

wordleStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const WordleStats = mongoose.model<IWordleStats>("WordleStats", wordleStatsSchema);
