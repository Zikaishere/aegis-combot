import type { BaseAbility } from "./BaseAbility.js";

function canHandle(input: string): boolean {
  const mathPattern = /^[\d\s+\-*/().%^]+$/;
  const lines = input.trim().split("\n").filter(Boolean);
  return lines.length === 1 && mathPattern.test(lines[0]) && /[+\-*/]/.test(lines[0]);
}

async function execute(input: string): Promise<string | null> {
  try {
    const sanitized = input.replace(/[^0-9+\-*/().%\s]/g, "");
    if (!sanitized) return null;
    const result = Function(`"use strict"; return (${sanitized})`)();
    if (typeof result !== "number" || !isFinite(result)) return null;
    return `\`${sanitized} = ${result}\``;
  } catch {
    return null;
  }
}

export const calculatorAbility: BaseAbility = {
  name: "calculator",
  description: "Evaluates simple math expressions",
  canHandle,
  execute,
};
