import type { PersonalityLayer } from "../../types/personality.js";
import { getTemplate } from "../templates.js";

const STYLE_MAP: Record<string, string> = {
  short: "\nKeep responses very short and concise.",
  long: "\nFeel free to give detailed, thorough responses.",
  casual: "\nBe extra casual and chill in your tone.",
  formal: "\nBe more formal and proper in your tone.",
};

export function getSpeechStyleLayer(style?: string): PersonalityLayer {
  const base = getTemplate("speech-style") || "Mirror the typing style of whoever you're talking to naturally. Keep responses short unless you're on a rant. Don't use emojis much.";

  let content = base;

  if (style && style !== "default" && STYLE_MAP[style]) {
    content += STYLE_MAP[style];
  }

  return {
    name: "speech-style",
    priority: 80,
    tokens: Math.ceil(content.length / 4),
    content,
  };
}
