import { PermissionLevel, comparePermissions } from "./PermissionLevel.js";
import PermissionRecord from "./models/PermissionRecord.js";
import { env } from "../config/index.js";

const cache = new Map<string, { level: PermissionLevel; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function getPermissionLevel(discordId: string): Promise<PermissionLevel> {
  if (discordId === env.ownerId) {
    return PermissionLevel.Owner;
  }

  const cached = cache.get(discordId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.level;
  }

  const record = await PermissionRecord.findOne({ discordId }).lean().exec();
  const level = record ? (record.level as PermissionLevel) : PermissionLevel.None;

  cache.set(discordId, { level, expiresAt: Date.now() + CACHE_TTL_MS });
  return level;
}

export function hasPermission(actual: PermissionLevel, required: PermissionLevel): boolean {
  return comparePermissions(actual, required);
}

export async function checkPermission(discordId: string, required: PermissionLevel): Promise<boolean> {
  const actual = await getPermissionLevel(discordId);
  return hasPermission(actual, required);
}

export async function setPermission(
  discordId: string,
  level: PermissionLevel,
  assignedBy: string,
  reason?: string,
): Promise<void> {
  await PermissionRecord.findOneAndUpdate(
    { discordId },
    { discordId, level, assignedBy, assignedAt: new Date(), reason },
    { upsert: true },
  );
  cache.delete(discordId);
}

export async function removePermission(discordId: string): Promise<void> {
  await PermissionRecord.deleteOne({ discordId });
  cache.delete(discordId);
}

export function invalidateCache(discordId?: string): void {
  if (discordId) {
    cache.delete(discordId);
  } else {
    cache.clear();
  }
}
