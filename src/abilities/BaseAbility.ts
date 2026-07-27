export interface BaseAbility {
  name: string;
  description: string;
  canHandle(input: string): boolean;
  execute(input: string, guildId: string | null): Promise<string | null>;
}
