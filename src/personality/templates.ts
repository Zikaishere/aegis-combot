import * as fs from "fs";
import * as path from "path";

const TEMPLATES_DIR = path.resolve(__dirname, "..", "config", "prompts");

const cache = new Map<string, string>();

const REQUIRED_TEMPLATES = ["core-identity", "speech-style", "behavior-rules", "server-dna", "user-profile"];

export async function loadTemplates(): Promise<void> {
  for (const name of REQUIRED_TEMPLATES) {
    const filePath = path.join(TEMPLATES_DIR, `${name}.md`);
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      cache.set(name, content.trim());
    } catch (error) {
      console.error(`Failed to load template "${name}":`, (error as Error).message);
    }
  }

  const loaded = REQUIRED_TEMPLATES.filter((n) => cache.has(n));
  console.log(`Loaded ${loaded.length}/${REQUIRED_TEMPLATES.length} personality templates`);
}

export function getTemplate(name: string): string | null {
  return cache.get(name) ?? null;
}

export function hasTemplate(name: string): boolean {
  return cache.has(name);
}

export function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

export function getLoadedCount(): number {
  return cache.size;
}
