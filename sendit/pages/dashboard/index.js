import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";

export default function DashboardOverview() {
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    fetch("/api/transactions/list").then((r) => r.json()).then((d) => {
      setStats(d.stats);
      setTransactions(d.transactions || []);
    });
    fetch("/api/account/list").then((r) => r.json()).then((d) => setAccounts(d.accounts || []));
  }, []);

  const active = accounts.filter((a) => a.status === "active").length;

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold mb-6">Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card label="Total transactions" value={stats?.total_transactions ?? "—"} />
        <Card label="Successful" value={stats?.successful ?? "—"} accent="text-mint" />
        <Card label="Failed" value={stats?.failed ?? "—"} accent="text-danger" />
        <Card label="Total revenue (KES)" value={stats ? Number(stats.total_revenue).toFixed(2) : "—"} />
      </div>

      <div className="bg-panel border border-line rounded-lg p-5 mb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="font-medium">Linked accounts</div>
          <a href="/dashboard/link-account" className="text-mint text-sm">Manage</a>
        </div>
        <div className="flex gap-6 text-sm mt-3">
          <div><span className="text-mint font-semibold">{active}</span> <span className="text-muted">active</span></div>
          <div><span className="text-danger font-semibold">{accounts.length - active}</span> <span className="text-muted">inactive</span></div>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Recent transactions</div>
          <a href="/dashboard/transactions" className="text-mint text-sm">View all</a>
        </div>
        {transactions.length === 0 ? (
          <p className="text-muted text-sm">No transactions yet. Link an account and call the API to see activity here.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left border-b border-line">
                <th className="py-2 font-normal">Reference</th>
                <th className="py-2 font-normal">Amount</th>
                <th className="py-2 font-normal">Phone</th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 5).map((t) => (
                <tr key={t.id} className="border-b border-line/50">
                  <td className="py-2 font-mono text-xs">{t.account_reference}</td>
                  <td className="py-2">KES {Number(t.amount).toFixed(2)}</td>
                  <td className="py-2">{t.phone}</td>
                  <td className="py-2">
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}

function Card({ label, value, accent = "text-white" }) {
  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <div className="text-muted text-xs">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    success: "text-mint bg-mintdim",
    failed: "text-danger bg-red-950",
    pending: "text-muted bg-line",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${map[status] || map.pending}`}>
      {status}
    </span>
  );
}
