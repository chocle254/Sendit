import { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const GRANULARITIES = [
  { key: "hourly", label: "Hourly" },
  { key: "daily", label: "Daily" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

// Matches tailwind.config.js theme colors so this reads as native to the
// rest of the dashboard rather than a bolted-on chart-library look.
const THEME = {
  mint: "#34D399",
  amber: "#F0B849",
  danger: "#F87171",
  blue: "#60A5FA",
  muted: "#8B9BB4",
  line: "#22304A",
  panel: "#121B2E",
};

function formatBucketLabel(bucket, granularity) {
  if (granularity === "hourly") {
    // "2026-08-02 14:00" -> "14:00"
    const parts = bucket.split(" ");
    return parts[1] || bucket;
  }
  if (granularity === "daily") {
    // "2026-08-02" -> "Aug 2"
    const d = new Date(bucket + "T00:00:00");
    if (isNaN(d)) return bucket;
    return d.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
  }
  if (granularity === "monthly") {
    // "2026-08" -> "Aug 2026"
    const d = new Date(bucket + "-01T00:00:00");
    if (isNaN(d)) return bucket;
    return d.toLocaleDateString("en-KE", { month: "short", year: "numeric" });
  }
  return bucket; // yearly — "2026" is already fine as-is
}

function formatKes(n) {
  return "KES " + Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

/**
 * Live, granularity-toggleable line chart.
 *
 * - fetchUrl(granularity) => string: builds the API URL for a given granularity
 * - lines: [{ dataKey, label, color }] — which numeric fields from each series
 *   row to plot
 * - valueFormatter: formats tooltip/axis values (defaults to KES)
 * - pollMs: how often to silently re-fetch and update in place (0 disables)
 *
 * Polling re-fetches the currently-selected granularity's series in the
 * background and swaps the data in without unmounting the chart, so the line
 * visibly grows/moves as new transactions land — this is what makes the
 * graph feel "real-time" per the live-dashboard requirement, given the
 * underlying data only actually changes when Safaricom's async callback
 * lands, not on a fixed frame rate.
 */
export default function LiveLineChart({
  fetchUrl,
  lines,
  valueFormatter = formatKes,
  pollMs = 5000,
  title,
  height = 300,
  emptyLabel = "No activity yet in this window.",
}) {
  const [granularity, setGranularity] = useState("daily");
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const granularityRef = useRef(granularity);
  granularityRef.current = granularity;

  useEffect(() => {
    let cancelled = false;

    async function load(isFirstLoadForThisGranularity) {
      try {
        const res = await fetch(fetchUrl(granularityRef.current));
        const data = await res.json();
        if (cancelled || granularityRef.current !== granularity) return; // stale response from a since-changed toggle
        if (data.error) {
          setError(data.error);
        } else {
          setError("");
          setSeries(data.series || []);
        }
      } catch {
        if (!cancelled) setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        if (!cancelled && isFirstLoadForThisGranularity) setLoading(false);
      }
    }

    setLoading(true);
    load(true);
    if (!pollMs) return;
    const interval = setInterval(() => load(false), pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity]);

  const chartData = series.map((row) => ({
    ...row,
    label: formatBucketLabel(row.bucket, granularity),
  }));

  return (
    <div className="glass rounded-xl shadow-neo-sm p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        {title && <h2 className="font-medium">{title}</h2>}
        <div className="flex gap-1 bg-base/60 border border-line rounded-md p-1 shadow-neo-inset">
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              onClick={() => setGranularity(g.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                granularity === g.key ? "bg-mint text-base shadow-glow-mint" : "text-muted hover:text-white"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-danger text-sm mb-3">{error}</div>}

      {loading ? (
        <div className="text-muted text-sm" style={{ height }}>
          Loading…
        </div>
      ) : chartData.length === 0 ? (
        <div className="text-muted text-sm flex items-center justify-center" style={{ height }}>
          {emptyLabel}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={THEME.muted}
              tick={{ fontSize: 11, fill: THEME.muted }}
              tickLine={false}
              axisLine={{ stroke: THEME.line }}
              minTickGap={20}
            />
            <YAxis
              stroke={THEME.muted}
              tick={{ fontSize: 11, fill: THEME.muted }}
              tickLine={false}
              axisLine={false}
              width={54}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            />
            <Tooltip
              contentStyle={{
                background: THEME.panel,
                border: `1px solid ${THEME.line}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#fff", marginBottom: 4 }}
              formatter={(value, name) => [valueFormatter(value), name]}
            />
            {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.label}
                stroke={line.color}
                strokeWidth={2}
                dot={chartData.length <= 20}
                activeDot={{ r: 4 }}
                isAnimationActive={true}
                animationDuration={400}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export { THEME };
