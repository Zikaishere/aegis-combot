import ErrorLog from "../models/ErrorLog.js";

const CACHE = new Map<string, { message: string; stack: string; time: Date }>();
const MAX_CACHE = 100;

export async function logError(error: unknown): Promise<string> {
  const errId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const entry = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack || "No stack trace" : "No stack trace",
    time: new Date(),
  };

  CACHE.set(errId, entry);
  if (CACHE.size > MAX_CACHE) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }

  console.error(`[Error ${errId}]`, error);

  try {
    await ErrorLog.create({ errId, ...entry });
  } catch {
    // DB write failure is non-fatal
  }

  return errId;
}

export async function getLoggedError(errorId: string) {
  const id = errorId.toUpperCase();
  if (CACHE.has(id)) return CACHE.get(id);

  try {
    const doc = await ErrorLog.findOne({ errId: id }).lean();
    if (doc) {
      const entry = { message: doc.message, stack: doc.stack, time: doc.time };
      CACHE.set(id, entry);
      return entry;
    }
  } catch {
    // DB read failure — fall through
  }

  return null;
}
