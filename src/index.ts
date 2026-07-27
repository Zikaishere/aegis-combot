import { startApp } from "./app.js";
import { client } from "./client/Client.js";
import mongoose from "mongoose";

async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  try {
    client.destroy();
    await mongoose.disconnect();
    console.log("Disconnected. Goodbye.");
  } catch (err) {
    console.error("Shutdown error:", err);
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

startApp().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
