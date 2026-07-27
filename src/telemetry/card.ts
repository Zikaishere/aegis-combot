import { createCanvas } from "canvas";

const WIDTH = 800;
const HEIGHT = 500;
const BG = "#1a1a2e";
const CARD = "#16213e";
const ACCENT = "#00b4d8";
const TEXT = "#ffffff";
const DIM = "#8888aa";
const GREEN = "#00e676";

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function drawMiniBar(ctx: any, x: number, y: number, w: number, h: number, pct: number, color: string) {
  ctx.fillStyle = "#2a2a4a";
  roundRect(ctx, x, y, w, h, 3);
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w * Math.min(pct, 1), h, 3);
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

export async function buildSummaryCard(data: any) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = CARD;
  roundRect(ctx, 30, 30, WIDTH - 60, HEIGHT - 60, 16);

  ctx.fillStyle = ACCENT;
  ctx.font = "bold 28px 'Segoe UI', 'Helvetica Neue', sans-serif";
  ctx.fillText("Blaze  •  Operational Metrics", 60, 85);

  ctx.fillStyle = DIM;
  ctx.font = "14px 'Segoe UI', 'Helvetica Neue', sans-serif";
  ctx.fillText("Last 7 days", 60, 110);

  const metrics = [
    { label: "Messages", value: formatNum(data.messagesProcessed), color: ACCENT },
    { label: "Commands", value: formatNum(data.commandsExecuted), color: "#448aff" },
    { label: "Servers", value: formatNum(data.guildCount), color: "#7c4dff" },
    { label: "Errors", value: formatNum(data.errors), color: data.errors > 0 ? "#ff1744" : GREEN },
    { label: "Avg Latency", value: `${data.avgResponseTime}ms`, color: "#00e5ff" },
  ];

  const maxVal = Math.max(
    data.messagesProcessed || 1,
    data.commandsExecuted || 1,
    data.guildCount || 1,
    data.errors || 1,
    data.avgResponseTime * 10 || 1,
  );

  const startY = 150;
  const rowH = 55;

  for (let i = 0; i < metrics.length; i++) {
    const y = startY + i * rowH;
    const metricVal = [data.messagesProcessed, data.commandsExecuted, data.guildCount, data.errors, data.avgResponseTime * 10][i] || 1;

    ctx.fillStyle = DIM;
    ctx.font = "13px 'Segoe UI', 'Helvetica Neue', sans-serif";
    ctx.fillText(metrics[i].label, 70, y + 18);

    drawMiniBar(ctx, 70, y + 26, 400, 14, metricVal / maxVal, metrics[i].color);

    ctx.fillStyle = TEXT;
    ctx.font = "bold 22px 'Segoe UI', 'Helvetica Neue', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(metrics[i].value, WIDTH - 70, y + 18);
    ctx.textAlign = "left";
  }

  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  ctx.fillStyle = DIM;
  ctx.font = "12px 'Segoe UI', 'Helvetica Neue', sans-serif";
  ctx.fillText(`Uptime: ${days}d ${hours}h  •  Generated ${new Date().toLocaleString()}`, 60, HEIGHT - 55);

  return canvas.toBuffer("image/png") as Buffer;
}
