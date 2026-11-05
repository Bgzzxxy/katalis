import { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const GRID = "#DCD8CE";
const TICK = "#77746B";
const TOKEN_LINE = "#54836A";
const TOKEN_FILL = "rgba(84, 131, 106, 0.10)";
const REQ_LINE = "#B77A45";
const REQ_FILL = "rgba(183, 122, 69, 0.10)";

export type ThroughputPoint = { t: number; tokens: number; requests: number };

/** Dual-axis line chart of token/s (success) and req/s (accent). */
export function ThroughputChart({
  points,
  heightClass = "h-64",
}: {
  points: ThroughputPoint[];
  heightClass?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    let gridColor = GRID;
    let tickColor = TICK;
    let tokenColor = TOKEN_LINE;
    let reqColor = REQ_LINE;

    if (typeof window !== "undefined" && typeof getComputedStyle === "function") {
      const cs = getComputedStyle(canvasRef.current);
      const varGrid = cs.getPropertyValue("--border-hairline").trim();
      const varTick = cs.getPropertyValue("--text-secondary").trim();
      const varSuccess = cs.getPropertyValue("--state-success").trim();
      const varAccent = cs.getPropertyValue("--accent-main").trim();
      if (varGrid) gridColor = varGrid;
      if (varTick) tickColor = varTick;
      if (varSuccess) tokenColor = varSuccess;
      if (varAccent) reqColor = varAccent;
    }

    const labels = points.map((p) => {
      const d = new Date(p.t);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    });

    try {
      const chart = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Token/detik",
              data: points.map((p) => p.tokens),
              borderColor: tokenColor,
              backgroundColor: TOKEN_FILL,
              fill: true,
              tension: 0.3,
              borderWidth: 1.5,
              pointRadius: 0,
            },
            {
              label: "Request/detik",
              data: points.map((p) => p.requests),
              borderColor: reqColor,
              backgroundColor: REQ_FILL,
              fill: true,
              tension: 0.3,
              borderWidth: 1.5,
              pointRadius: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          animation: false,
          scales: {
            x: {
              ticks: { color: tickColor, font: { family: "JetBrains Mono", size: 10 }, maxTicksLimit: 8 },
              grid: { color: gridColor },
            },
            y: {
              beginAtZero: true,
              ticks: { color: tickColor, font: { family: "JetBrains Mono", size: 10 } },
              grid: { color: gridColor },
            },
          },
          plugins: {
            legend: {
              labels: { color: tickColor, font: { family: "JetBrains Mono", size: 10 } },
            },
          },
        },
      });

      chartRef.current = chart;
    } catch {
      // Safely handle environments without canvas context
    }

    return () => {
      chartRef.current?.destroy(); // required under StrictMode (React 19)
      chartRef.current = null;
    };
  }, [points, dark]);

  return (
    <div className={`relative w-full ${heightClass}`}>
      <canvas ref={canvasRef} data-testid="throughput-chart" />
    </div>
  );
}