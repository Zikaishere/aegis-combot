import { getProvider } from "../ai/factory.js";
import { backgroundLimiter } from "../ai/groq/rate-limiters.js";
import { env } from "../config/index.js";

const PII_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  /\b[\w.-]+@[\w.-]+\.\w+\b/g,
  /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,
  /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
  /\b[A-Z]{2}\d{6}\b/g,
];

export function stripPII(text: string): string {
  let cleaned = text;
  for (const pattern of PII_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[redacted]");
  }
  return cleaned;
}

export interface ExtractionResult {
  profile: string | null;
  newFacts: string[];
  obsoleteFactIndices: number[];
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("retry failed");
}

const extractionCooldowns = new Map<string, number>();
const MIN_COOLDOWN_MS = 120_000;

export function canExtract(userId: string): boolean {
  const last = extractionCooldowns.get(userId);
  if (last && Date.now() - last < MIN_COOLDOWN_MS) return false;
  extractionCooldowns.set(userId, Date.now());
  return true;
}

export async function extractFacts(
  userName: string,
  userMessage: string,
  history: { role: string; content: string }[],
  currentProfile: string,
  existingFacts: string[],
): Promise<ExtractionResult> {
  const recentMessages = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  try {
    const resp = await backgroundLimiter.schedule(() =>
      retryWithBackoff(() =>
        getProvider().generateChat({
          systemPrompt: `You are maintaining a memory profile for a user named "${userName}".
Your job is to update what you know about them based on the conversation.

Current profile: ${currentProfile || "nothing known yet"}
Current facts: ${existingFacts.length ? existingFacts.map((f, i) => `${i + 1}. ${f}`).join("\n") : "none"}

Read the recent conversation and output a JSON update:
{
  "profile": "A short paragraph summarizing who this user is (interests, personality, projects, preferences).",
  "newFacts": ["fact1", "fact2"],
  "obsoleteFactIndices": [0, 2]
}

Rules:
- Update the profile with anything new you learn. Keep it current — if something changed, reflect it.
- newFacts: only genuinely useful facts that would help future conversations. Max 3 facts per extraction.
- If a new fact is very similar to an existing fact, output the existing fact's index in obsoleteFactIndices so it gets replaced instead of duplicated.
- obsoleteFactIndices: which existing facts (0-indexed) are now outdated, contradicted, or being replaced by a new fact.
- NEVER save addresses, phone numbers, emails, full names, or other personal contact info.
- NEVER save anything that would be creepy or invasive if the user heard it repeated back.
- If nothing changed, output {"profile": "same", "newFacts": [], "obsoleteFactIndices": []}
- Only output valid JSON, nothing else.`,
          messages: [
            {
              role: "user",
              content: `Recent conversation:\n${recentMessages}\n\nNew message from ${userName}: "${userMessage}"`,
            },
          ],
          model: env.defaultModel,
          maxTokens: 300,
          temperature: 0.1,
        }),
      ),
    );

    const raw = resp.content?.trim() || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    return {
      profile: parsed.profile && parsed.profile !== "same" ? stripPII(parsed.profile) : null,
      newFacts: Array.isArray(parsed.newFacts) ? parsed.newFacts.map((f: string) => stripPII(f)).filter((f: string) => f.length >= 10) : [],
      obsoleteFactIndices: Array.isArray(parsed.obsoleteFactIndices) ? parsed.obsoleteFactIndices : [],
    };
  } catch (error) {
    console.error("Fact extraction failed:", error);
    return { profile: null, newFacts: [], obsoleteFactIndices: [] };
  }
}
