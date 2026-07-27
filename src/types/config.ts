export interface EnvConfig {
  discordToken: string;
  mongoUri: string;
  groqApiKey: string;
  ownerId: string;
  defaultPrefix: string;
  defaultModel: string;
  maxHistory: number;
  contextWindow: number;
  defaultCooldownMs: number;
  guildId?: string;
  nodeEnv: "development" | "production";
}

export interface GuildConfigData {
  guildId: string;
  prefix?: string;
  model?: string;
  aiEnabled?: boolean;
  allowedChannels?: string[];
  telemetryEnabled?: boolean;
  abilityOverrides?: Record<string, boolean>;
}

export interface UserConfigData {
  userId: string;
  guildId?: string;
  style?: "default" | "short" | "long" | "casual" | "formal";
  memoryEnabled?: boolean;
}
