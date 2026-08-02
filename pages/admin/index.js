import { useEffect, useState } from "react";
import { TrendingUp, Users, Coins, Calendar, Wallet, Activity } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";

function formatKes(n) {
  return "KES " + Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setStats(d);
      })
      .catch(() => setError("Couldn't reach the server. Check your connection and try again."));
  }, []);

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-semibold mb-1">Overview</h1>
      <p className="text-muted text-sm mb-6">Platform-wide numbers across every developer and till.</p>

      {error && <div className="text-danger text-sm mb-4">{error}</div>}

      {!stats ? (
        <div className="text-muted text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Wallet}
              label="Money moved across tills"
              value={formatKes(stats.moneyMoved)}
              sub={`${stats.successfulStkpushes} of ${stats.totalStkpushes} pushes succeeded`}
            />
            <StatCard icon={Users} label="Total users" value={stats.totalUsers.toLocaleString()} sub={`${stats.totalAccounts} linked accounts`} />
            <StatCard icon={Coins} label="Token purchase revenue" value={formatKes(stats.tokenRevenue)} sub="Sendit revenue" />
            <StatCard icon={Calendar} label="Subscription revenue" value={formatKes(stats.subscriptionRevenue)} sub="Sendit revenue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            <StatCard icon={Activity} label="Active accounts" value={stats.activeAccounts.toLocaleString()} sub="not suspended / payment_failed" small />
            <StatCard icon={TrendingUp} label="Activation fee revenue" value={formatKes(stats.activationRevenue)} sub="legacy flow, still live" small />
            <StatCard
              icon={Wallet}
              label="Total Sendit revenue"
              value={formatKes(stats.tokenRevenue + stats.subscriptionRevenue + stats.activationRevenue)}
              sub="tokens + subscriptions + activation"
              small
            />
          </div>

          <div className="glass rounded-xl shadow-neo-sm p-5 mb-6">
            <h2 className="font-medium mb-4">Money moved across tills — last 14 days</h2>
            <DailyBarChart series={stats.dailySeries} />
          </div>

          <div className="glass rounded-xl shadow-neo-sm p-5">
            <h2 className="font-medium mb-4">Revenue mix</h2>
            <RevenueMixBar
              tokens={stats.tokenRevenue}
              subscriptions={stats.subscriptionRevenue}
              activation={stats.activationRevenue}
            />
          </div>
        </>
      )}
    </AdminLayout>
  );
}

function StatCard({ icon: Icon, label, value, sub, small }) {
  return (
    <div className="glass rounded-xl shadow-neo-sm p-4">
      <div className="flex items-center gap-2 text-muted text-xs mb-2">
        <Icon size={14} />
        {label}
      </div>
      <div className={small ? "text-lg font-semibold" : "text-2xl font-semibold font-display"}>{value}</div>
      {sub && <div className="text-muted text-xs mt-1">{sub}</div>}
    </div>
  );
}

// Dependency-free SVG bar chart — no chart library in package.json, and a
// 14-point daily series doesn't need one.
function DailyBarChart({ series }) {
  if (!series || series.length === 0) {
    return <div className="text-muted text-sm">No transaction activity in the last 14 days.</div>;
  }

  const width = 700;
  const height = 220;
  const padding = 30;
  const max = Math.max(...series.map((d) => d.moneyMoved), 1);
  const barWidth = (width - padding * 2) / series.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Daily money moved, last 14 days">
      {series.map((d, i) => {
        const barHeight = (d.moneyMoved / max) * (height - padding * 2);
        const x = padding + i * barWidth;
        const y = height - padding - barHeight;
        return (
          <g key={d.day}>
            <rect
              x={x + barWidth * 0.15}
              y={y}
              width={barWidth * 0.7}
              height={Math.max(barHeight, 1)}
              rx={3}
              fill="var(--mint, #34d399)"
              opacity={0.85}
            >
              <title>
                {d.day}: {formatKes(d.moneyMoved)}
              </title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={height - padding + 14}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
              opacity={0.5}
            >
              {d.day.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RevenueMixBar({ tokens, subscriptions, activation }) {
  const total = tokens + subscriptions + activation;
  if (total <= 0) {
    return <div className="text-muted text-sm">No Sendit revenue yet.</div>;
  }
  const segments = [
    { label: "Tokens", value: tokens, color: "#34d399" },
    { label: "Subscriptions", value: subscriptions, color: "#60a5fa" },
    { label: "Activation fees", value: activation, color: "#f59e0b" },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <div className="flex w-full h-6 rounded-md overflow-hidden mb-3">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label}: ${formatKes(s.value)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: s.color }} />
            {s.label}: {formatKes(s.value)} ({((s.value / total) * 100).toFixed(0)}%)
          </span>
        ))}
      </div>
    </div>
  );
}
