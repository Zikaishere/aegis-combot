import type { Message } from "discord.js";
import { getProvider } from "../ai/factory.js";

const SYSTEM_PROMPT = `You are a content moderation AI for a Discord community. Analyze messages for policy violations.

Rules:
- Only flag genuinely harmful content
- Do NOT flag: casual swearing, gaming trash talk, heated but non-toxic debate, reclaimed slurs in self-referential context
- DO flag: targeted harassment, hate speech, threats, doxxing, sexual content involving minors, coordinated abuse, dogwhistles used maliciously

Respond with ONLY a JSON object, no other text:
{"flag": true/false, "reason": "brief reason", "confidence": 0.0-1.0, "severity": "none|mild|medium|severe"}

If the message is clean, return: {"flag": false, "reason": "", "confidence": 1.0, "severity": "none"}`;

interface AIModResult {
  flag: boolean;
  reason: string;
  confidence: number;
  severity: "none" | "mild" | "medium" | "severe";
}

function hasSuspiciousSignals(message: Message): boolean {
  const content = message.content.toLowerCase();

  // Excessive mentions (potential raid/spam)
  const mentionCount = (message.content.match(/<@!?\d+>/g) || []).length;
  if (mentionCount >= 5) return true;

  // Repeated characters (e.g., "aaaaaaa", "!!!!!!!!")
  if (/(.)\1{7,}/.test(message.content)) return true;

  // Repeated words
  const words = content.split(/\s+/);
  const wordFreq = new Map<string, number>();
  for (const w of words) {
    if (w.length > 2) {
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
      if (wordFreq.get(w)! >= 4) return true;
    }
  }

  // Potential encoded/obfuscated slurs (e.g., "n i g g e r", "f a g")
  const spacedSlurs = /\b[nfkb]\s*[i1l]\s*[g9q]\s*[g9q]\s*[ea4]\s*[rs5]\b/i;
  if (spacedSlurs.test(content)) return true;

  // Zero-width characters (potential evasion)
  if (/[\u200B-\u200F\uFEFF]/.test(message.content)) return true;

  // Excessive emoji (> 15)
  const emojiCount = (message.content.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount >= 15) return true;

  // New account indicator (joined in last 24h) — checked separately

  // Common evasion patterns
  const evasionPatterns = [
    /k\s*y\s*s/i,
    /k\s*i\s*l\s*l\s*y\s*o\s*u\s*r\s*s\s*e\s*l\s*f/i,
    /g\s*o\s*d\s*i\s*e/i,
    /i\s*will\s*find\s*you/i,
    /\bdox\b/i,
    /\bdoxx\b/i,
  ];
  for (const p of evasionPatterns) {
    if (p.test(content)) return true;
  }

  return false;
}

export async function aiModerate(message: Message): Promise<{ action: string; reason: string } | null> {
  if (!hasSuspiciousSignals(message)) return null;

  const provider = getProvider();

  const contextParts: string[] = [];
  contextParts.push(`Message: "${message.content.slice(0, 500)}"`);
  contextParts.push(`Author: ${message.author.id}`);

  const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
  if (member) {
    const accountAge = Date.now() - message.author.createdTimestamp;
    const joinAge = Date.now() - (member.joinedTimestamp ?? Date.now());
    if (accountAge < 7 * 24 * 60 * 60 * 1000) contextParts.push("Account is less than 7 days old.");
    if (joinAge < 24 * 60 * 60 * 1000) contextParts.push("Joined server less than 24 hours ago.");
    contextParts.push(`Roles: ${member.roles.cache.size - 1}`);
  }

  if (message.reference) {
    contextParts.push("Message is a reply (check if the reply context changes meaning).");
  }

  try {
    const response = await provider.generateChat({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: contextParts.join("\n") }],
      model: "google/gemma-4-26b-a4b-it:free",
      maxTokens: 150,
      temperature: 0.1,
    });

    const parsed = parseResponse(response.content);
    if (!parsed || !parsed.flag) return null;
    if (parsed.confidence < 0.6) return null;

    const actionMap: Record<string, string> = {
      none: "warn",
      mild: "warn",
      medium: "mute",
      severe: "kick",
    };

    return {
      action: actionMap[parsed.severity] || "warn",
      reason: `AI moderation: ${parsed.reason} (confidence: ${Math.round(parsed.confidence * 100)}%)`,
    };
  } catch {
    return null;
  }
}

function parseResponse(raw: string): AIModResult | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const obj = JSON.parse(jsonMatch[0]);
    if (typeof obj.flag !== "boolean") return null;
    return {
      flag: obj.flag,
      reason: String(obj.reason || ""),
      confidence: Math.min(1, Math.max(0, Number(obj.confidence) || 0)),
      severity: ["none", "mild", "medium", "severe"].includes(obj.severity) ? obj.severity : "none",
    };
  } catch {
    return null;
  }
}
