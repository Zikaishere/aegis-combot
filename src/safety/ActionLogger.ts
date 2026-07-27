import ActionLog from "./models/ActionLog.js";

interface LogParams {
  userId: string;
  userTag: string;
  action: string;
  reason?: string;
  affectedResources: string[];
  result: "success" | "failure" | "cancelled" | "pending_confirmation";
  confirmationReceived?: boolean;
  guildId?: string;
  channelId?: string;
}

export async function logAction(params: LogParams): Promise<void> {
  try {
    await ActionLog.create({
      timestamp: new Date(),
      userId: params.userId,
      userTag: params.userTag,
      action: params.action,
      reason: params.reason,
      affectedResources: params.affectedResources,
      result: params.result,
      confirmationReceived: params.confirmationReceived ?? false,
      guildId: params.guildId,
      channelId: params.channelId,
    });
  } catch (err) {
    console.error("[ActionLogger] Failed to log action:", err);
  }
}

export async function getRecentActions(
  guildId: string,
  limit = 25,
): Promise<any[]> {
  return ActionLog.find({ guildId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean()
    .exec();
}

export async function getActionsByUser(
  userId: string,
  limit = 25,
): Promise<any[]> {
  return ActionLog.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean()
    .exec();
}

export async function getActionsByType(
  action: string,
  guildId?: string,
  limit = 25,
): Promise<any[]> {
  const query: Record<string, any> = { action };
  if (guildId) query.guildId = guildId;

  return ActionLog.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean()
    .exec();
}
