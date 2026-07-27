import Telemetry from "./models/Telemetry.js";

const counters: {
  messagesProcessed: number;
  commandsExecuted: number;
  errors: number;
  totalResponseTime: number;
  responseCount: number;
  responseTimes: number[];
  commandBreakdown: Record<string, number>;
  activeUsers: Set<string>;
  guildCount: number;
  tokenEstimate: number;
} = {
  messagesProcessed: 0,
  commandsExecuted: 0,
  errors: 0,
  totalResponseTime: 0,
  responseCount: 0,
  responseTimes: [],
  commandBreakdown: {},
  activeUsers: new Set(),
  guildCount: 0,
  tokenEstimate: 0,
};

export function recordMessage(): void {
  counters.messagesProcessed++;
}

export function recordCommand(name: string): void {
  counters.commandsExecuted++;
  counters.commandBreakdown[name] = (counters.commandBreakdown[name] || 0) + 1;
}

export function recordError(): void {
  counters.errors++;
}

export function recordResponseTime(ms: number): void {
  counters.totalResponseTime += ms;
  counters.responseCount++;
  counters.responseTimes.push(ms);
  if (counters.responseTimes.length > 1000) {
    counters.responseTimes.splice(0, counters.responseTimes.length - 1000);
  }
}

export function recordTokenEstimate(tokens: number): void {
  counters.tokenEstimate += tokens;
}

export function addActiveUser(userId: string): void {
  counters.activeUsers.add(userId);
}

export function setGuildCount(n: number): void {
  counters.guildCount = n;
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

export async function snapshot(): Promise<void> {
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);

  const avg =
    counters.responseCount > 0
      ? Math.round(counters.totalResponseTime / counters.responseCount)
      : 0;

  const breakdown = Object.entries(counters.commandBreakdown)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  try {
    await Telemetry.findOneAndUpdate(
      { timestamp: hourStart },
      {
        $set: {
          guildCount: counters.guildCount,
          activeUsers: counters.activeUsers.size,
          messagesProcessed: counters.messagesProcessed,
          commandsExecuted: counters.commandsExecuted,
          errorCount: counters.errors,
          avgResponseTime: avg,
          p95ResponseTime: p95(counters.responseTimes),
          tokenEstimate: counters.tokenEstimate,
          commandBreakdown: breakdown,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    console.error("Telemetry snapshot failed:", (error as Error).message);
  }
}

export function reset(): void {
  counters.messagesProcessed = 0;
  counters.commandsExecuted = 0;
  counters.errors = 0;
  counters.totalResponseTime = 0;
  counters.responseCount = 0;
  counters.responseTimes = [];
  counters.commandBreakdown = {};
  counters.activeUsers = new Set();
  counters.tokenEstimate = 0;
}

export async function getSnapshots(hours = 168) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return Telemetry.find({ timestamp: { $gte: since } }).sort({ timestamp: 1 }).lean();
}

export async function getTotals() {
  const all = await Telemetry.find().sort({ timestamp: -1 }).lean();
  const total: Record<string, any> = {
    messagesProcessed: 0,
    commandsExecuted: 0,
    errors: 0,
    guildCount: all.length > 0 ? all[all.length - 1].guildCount : 0,
    avgResponseTime: 0,
  };

  for (const snap of all) {
    total.messagesProcessed += snap.messagesProcessed || 0;
    total.commandsExecuted += snap.commandsExecuted || 0;
    total.errors += snap.errorCount || 0;
  }

  const withAvg = all.filter((s: any) => s.avgResponseTime > 0);
  if (withAvg.length > 0) {
    total.avgResponseTime = Math.round(
      withAvg.reduce((s: number, snap: any) => s + snap.avgResponseTime, 0) / withAvg.length,
    );
  }

  return total;
}
