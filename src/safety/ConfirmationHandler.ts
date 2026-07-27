import { EmbedBuilder } from "discord.js";
import { logAction } from "./ActionLogger.js";

interface ConfirmationDisplay {
  userId: string;
  userTag: string;
  action: string;
  reason?: string;
  affectedResources: string[];
}

interface ConfirmationRequest extends ConfirmationDisplay {
  guildId?: string;
  channelId?: string;
  execute: () => Promise<{ success: boolean; message?: string }>;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const pendingConfirmations = new Map<string, ConfirmationRequest>();
const CONFIRMATION_TIMEOUT_MS = 60_000;

export function buildConfirmationEmbed(request: ConfirmationDisplay): EmbedBuilder {
  const resourceList = request.affectedResources.length > 0
    ? request.affectedResources.map(r => `\`${r}\``).join(", ")
    : "None specified";

  return new EmbedBuilder()
    .setColor(0xffa500)
    .setTitle("Confirmation Required")
    .setDescription(`I am about to perform the following action:`)
    .addFields(
      { name: "Action", value: `\`${request.action}\``, inline: true },
      { name: "Affected Resources", value: resourceList, inline: false },
      ...(request.reason ? [{ name: "Reason", value: request.reason, inline: true }] : []),
    )
    .setFooter({ text: "Type CONFIRM to proceed or CANCEL to abort. This expires in 60 seconds." })
    .setTimestamp();
}

export function registerConfirmation(request: ConfirmationRequest): string {
  const id = `${request.userId}-${Date.now()}`;

  pendingConfirmations.set(id, request);

  setTimeout(() => {
    const pending = pendingConfirmations.get(id);
    if (pending) {
      pendingConfirmations.delete(id);
      logAction({
        userId: pending.userId,
        userTag: pending.userTag,
        action: pending.action,
        reason: "Confirmation timed out",
        affectedResources: pending.affectedResources,
        result: "cancelled",
        guildId: pending.guildId,
        channelId: pending.channelId,
      });
    }
  }, CONFIRMATION_TIMEOUT_MS);

  return id;
}

export function getConfirmation(id: string): ConfirmationRequest | undefined {
  return pendingConfirmations.get(id);
}

export async function resolveConfirmation(
  id: string,
  confirmed: boolean,
): Promise<{ handled: boolean; message?: string }> {
  const request = pendingConfirmations.get(id);
  if (!request) {
    return { handled: false, message: "No pending confirmation found. It may have expired." };
  }

  pendingConfirmations.delete(id);

  if (!confirmed) {
    request.onCancel?.();
    await logAction({
      userId: request.userId,
      userTag: request.userTag,
      action: request.action,
      reason: "Cancelled by user",
      affectedResources: request.affectedResources,
      result: "cancelled",
      guildId: request.guildId,
      channelId: request.channelId,
    });
    return { handled: true, message: "Action cancelled." };
  }

  try {
    const result = await request.execute();
    request.onConfirm?.();

    await logAction({
      userId: request.userId,
      userTag: request.userTag,
      action: request.action,
      reason: request.reason,
      affectedResources: request.affectedResources,
      result: result.success ? "success" : "failure",
      confirmationReceived: true,
      guildId: request.guildId,
      channelId: request.channelId,
    });

    return {
      handled: true,
      message: result.success
        ? `Action completed successfully.${result.message ? ` ${result.message}` : ""}`
        : `Action failed.${result.message ? ` ${result.message}` : ""}`,
    };
  } catch (err) {
    await logAction({
      userId: request.userId,
      userTag: request.userTag,
      action: request.action,
      reason: `Error: ${err instanceof Error ? err.message : String(err)}`,
      affectedResources: request.affectedResources,
      result: "failure",
      confirmationReceived: true,
      guildId: request.guildId,
      channelId: request.channelId,
    });

    return {
      handled: true,
      message: `Action failed with error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function hasPendingConfirmation(userId: string): ConfirmationRequest | undefined {
  for (const [, request] of pendingConfirmations) {
    if (request.userId === userId) return request;
  }
  return undefined;
}

export function findConfirmationId(userId: string): string | undefined {
  for (const [id, request] of pendingConfirmations) {
    if (request.userId === userId) return id;
  }
  return undefined;
}

export async function resolveConfirmationByUserId(
  userId: string,
  confirmed: boolean,
): Promise<{ handled: boolean; message?: string }> {
  const id = findConfirmationId(userId);
  if (!id) {
    return { handled: false, message: "No pending confirmation found." };
  }
  return resolveConfirmation(id, confirmed);
}
