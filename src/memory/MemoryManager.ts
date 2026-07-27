import Memory, { IMemory } from "./models/Memory.js";

export class MemoryManager {
  async set(
    scope: "guild" | "user" | "global",
    scopeId: string,
    key: string,
    value: string,
    tags?: string[],
    userId?: string,
  ): Promise<void> {
    await Memory.findOneAndUpdate(
      { scope, scopeId, key },
      { value, tags: tags || [], userId: userId || "", lastAccessedAt: new Date() },
      { upsert: true },
    );
  }

  async get(
    scope: "guild" | "user" | "global",
    scopeId: string,
    key: string,
  ): Promise<string | null> {
    const doc = await Memory.findOneAndUpdate(
      { scope, scopeId, key },
      { $inc: { accessCount: 1 }, $set: { lastAccessedAt: new Date() } },
      { new: true },
    );
    return doc?.value || null;
  }

  async delete(
    scope: "guild" | "user" | "global",
    scopeId: string,
    key: string,
  ): Promise<boolean> {
    const result = await Memory.deleteOne({ scope, scopeId, key });
    return result.deletedCount > 0;
  }

  async search(
    scope: "guild" | "user" | "global",
    scopeId: string,
    query: string,
    limit = 5,
  ): Promise<{ key: string; value: string; tags: string[] }[]> {
    const docs = await Memory.find(
      { scope, scopeId, value: { $regex: query, $options: "i" } },
      { key: 1, value: 1, tags: 1, _id: 0 },
    )
      .sort({ lastAccessedAt: -1 })
      .limit(limit)
      .lean();
    return docs;
  }

  async list(
    scope: "guild" | "user" | "global",
    scopeId: string,
    limit = 10,
  ): Promise<{ key: string; value: string; tags: string[]; accessCount: number }[]> {
    const docs = await Memory.find(
      { scope, scopeId },
      { key: 1, value: 1, tags: 1, accessCount: 1, _id: 0 },
    )
      .sort({ accessCount: -1, lastAccessedAt: -1 })
      .limit(limit)
      .lean();
    return docs;
  }

  async getRelevant(
    scope: "guild" | "user" | "global",
    scopeId: string,
    limit = 5,
  ): Promise<string[]> {
    const docs = await Memory.find({ scope, scopeId })
      .sort({ accessCount: -1, lastAccessedAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((d) => d.value);
  }
}

export const memoryManager = new MemoryManager();
