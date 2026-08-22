export interface ChatParams {
  systemPrompt: string;
  messages: { role: string; content: string }[];
  model: string;
  maxTokens: number;
  temperature: number;
  onDelta?: (delta: string) => void;
}

export interface ChatResponse {
  content: string;
  model: string;
  tokens?: number;
}

export interface AIProvider {
  generateChat(params: ChatParams): Promise<ChatResponse>;
}
