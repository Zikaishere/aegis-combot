import { getSnapshots, getTotals } from "./recorder.js";
import { drawLineChart, drawHorizontalBar, COLORS } from "./charts.js";
import { buildSummaryCard } from "./card.js";

export async function render(type: string): Promise<Buffer | null> {
  const weekSnaps = await getSnapshots(168);

  switch (type) {
    case "summary":
      return buildSummaryCard(await getTotals());

    case "activity": {
      const data = weekSnaps.map((s: any) => ({
        timestamp: s.timestamp,
        value: s.messagesProcessed || 0,
      }));
      return drawLineChart(data, "Messages / Hour", COLORS.accent);
    }

    case "commands": {
      const snap = weekSnaps[weekSnaps.length - 1];
      const items = (snap?.commandBreakdown || []).slice(0, 10);
      return drawHorizontalBar(items, "Commands", COLORS.blue);
    }

    case "latency": {
      const data = weekSnaps.map((s: any) => ({
        timestamp: s.timestamp,
        value: s.avgResponseTime || 0,
      }));
      return drawLineChart(data, "Avg Response Time (ms)", COLORS.green);
    }

    case "growth": {
      const data = weekSnaps.map((s: any) => ({
        timestamp: s.timestamp,
        value: s.guildCount || 0,
      }));
      return drawLineChart(data, "Servers", COLORS.purple);
    }

    case "errors": {
      const data = weekSnaps.map((s: any) => ({
        timestamp: s.timestamp,
        value: s.errorCount || 0,
      }));
      return drawLineChart(data, "Errors / Hour", COLORS.red);
    }

    default:
      return null;
  }
}
