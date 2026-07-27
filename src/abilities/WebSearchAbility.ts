import type { BaseAbility } from "./BaseAbility.js";
import { search, SafeSearchType } from "duck-duck-scrape";
import Bottleneck from "bottleneck";

const searchLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 3000,
});

function canHandle(input: string): boolean {
  const trimmed = input.trim();
  return /^search\s/i.test(trimmed) || /^search for\s/i.test(trimmed) || /^google\s/i.test(trimmed);
}

async function execute(input: string): Promise<string | null> {
  const query = input.trim().replace(/^(search(?:\s+for)?|google)\s+/i, "").trim();
  if (!query || query.length < 2) return null;

  try {
    const result = await searchLimiter.schedule(() =>
      search(query, { safeSearch: SafeSearchType.MODERATE })
    );
    if (!result.results || result.results.length === 0) {
      return `Nothing found for "${query}".`;
    }

    const top = result.results.slice(0, 5);
    const lines = top.map((r, i) =>
      `**${i + 1}. ${r.title}**\n${r.description || ""}\n${r.url}`
    );

    return `Search results for **${query}**:\n\n${lines.join("\n\n")}`;
  } catch (err: any) {
    if (err?.message?.includes("anomaly")) return null;
    console.error("Web search failed:", err);
    return null;
  }
}

export const webSearchAbility: BaseAbility = {
  name: "websearch",
  description: "Search the web using DuckDuckGo. Trigger: \"search <query>\" or \"google <query>\"",
  canHandle,
  execute,
};
