export interface ChatContext {
  chatKey: string;
  channelId: string;
  userId: string;
  guildId: string | null;
}

export interface RoutingResult {
  isDirectMessage: boolean;
  isReplyToBot: boolean;
  mentioned: boolean;
  shouldHandle: boolean;
}

export type CommandType = "prefix" | "slash" | "mention";

export interface CommandContext {
  type: CommandType;
  name: string;
  args: string[];
  userId: string;
  guildId: string | null;
  channelId: string;
}

export type ExecResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorId?: string };

export type Awaitable<T> = T | Promise<T>;
