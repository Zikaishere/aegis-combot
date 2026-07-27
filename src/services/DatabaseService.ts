import mongoose from "mongoose";
import { env } from "../config/index.js";

const modelRegistry: (() => Promise<void>)[] = [];

export function registerSyncIndexes(fn: () => Promise<any>): void {
  modelRegistry.push(fn);
}

export async function connectDB(retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(env.mongoUri);

      for (const sync of modelRegistry) {
        await sync();
      }

      console.log("MongoDB connected");
      return;
    } catch (error) {
      console.error(
        `MongoDB connection attempt ${attempt}/${retries}:`,
        (error as Error).message,
      );
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      } else {
        console.error("All MongoDB connection attempts failed");
      }
    }
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
