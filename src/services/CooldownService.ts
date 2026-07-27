const COOLDOWNS = new Map<string, number>();

export function isOnCooldown(
  userId: string,
  cooldownMs: number,
): boolean {
  if (!COOLDOWNS.has(userId)) return false;

  const expires = COOLDOWNS.get(userId)!;
  if (Date.now() < expires) return true;

  COOLDOWNS.delete(userId);
  return false;
}

export function setCooldown(
  userId: string,
  cooldownMs: number,
): void {
  COOLDOWNS.set(userId, Date.now() + cooldownMs);
}
