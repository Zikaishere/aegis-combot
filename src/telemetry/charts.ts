import { ChartJSNodeCanvas } from "chartjs-node-canvas";

const COLORS = {
  accent: "#00b4d8",
  grid: "#2a2a4a",
  text: "#ffffff",
  textDim: "#8888aa",
  green: "#00e676",
  red: "#ff1744",
  blue: "#448aff",
  purple: "#7c4dff",
  bg: "#1a1a2e",
};

const FONT = { family: "'Segoe UI', 'Helvetica Neue', sans-serif" };

const canvas = new ChartJSNodeCanvas({
  width: 800,
  height: 400,
  backgroundColour: COLORS.bg,
  chartCallback: (ChartJS: any) => {
    ChartJS.defaults.color = COLORS.textDim;
    ChartJS.defaults.font.family = FONT.family;
  },
});

function timeLabels(snapshots: any[]) {
  return snapshots.map((s) => {
    const d = new Date(s.timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
  });
}

export async function drawLineChart(data: any[], label: string, color = COLORS.accent) {
  return canvas.renderToBuffer({
    type: "line",
    data: {
      labels: timeLabels(data),
      datasets: [
        {
          label,
          data: data.map((s) => s.value ?? 0),
          borderColor: color,
          backgroundColor: color.replace(")", ", 0.15)").replace("rgb", "rgba"),
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: color,
          pointBorderColor: color,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: {
          labels: { color: COLORS.text, font: { size: 14, ...FONT } },
        },
      },
      scales: {
        x: {
          ticks: { color: COLORS.textDim, maxTicksLimit: 12, font: { size: 10, ...FONT } },
          grid: { color: COLORS.grid },
        },
        y: {
          beginAtZero: true,
          ticks: { color: COLORS.textDim, font: { size: 11, ...FONT } },
          grid: { color: COLORS.grid },
        },
      },
    },
  }) as unknown as Buffer;
}

export async function drawBarChart(data: any[], label: string, color = COLORS.accent) {
  return canvas.renderToBuffer({
    type: "bar",
    data: {
      labels: timeLabels(data),
      datasets: [
        {
          label,
          data: data.map((s) => s.value ?? 0),
          backgroundColor: color.replace(")", ", 0.7)").replace("rgb", "rgba"),
          borderColor: color,
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: {
          labels: { color: COLORS.text, font: { size: 14, ...FONT } },
        },
      },
      scales: {
        x: {
          ticks: { color: COLORS.textDim, maxTicksLimit: 12, font: { size: 10, ...FONT } },
          grid: { color: COLORS.grid },
        },
        y: {
          beginAtZero: true,
          ticks: { color: COLORS.textDim, font: { size: 11, ...FONT } },
          grid: { color: COLORS.grid },
        },
      },
    },
  }) as unknown as Buffer;
}

export async function drawHorizontalBar(items: any[], title: string, color = COLORS.accent) {
  const labels = items.map((i: any) => i.name).reverse();
  const values = items.map((i: any) => i.count).reverse();

  return canvas.renderToBuffer({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: title,
          data: values,
          backgroundColor: color.replace(")", ", 0.7)").replace("rgb", "rgba"),
          borderColor: color,
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: false,
      plugins: {
        legend: {
          labels: { color: COLORS.text, font: { size: 14, ...FONT } },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: COLORS.textDim, precision: 0, font: { size: 11, ...FONT } },
          grid: { color: COLORS.grid },
        },
        y: {
          ticks: { color: COLORS.text, font: { size: 12, ...FONT } },
          grid: { display: false },
        },
      },
    },
  }) as unknown as Buffer;
}

export { COLORS };
