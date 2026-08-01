import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "../../components/DashboardLayout";
import Skeleton from "../../components/Skeleton";
import Signal from "../../components/Signal";

export default function DashboardOverview() {
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    fetch("/api/transactions/list")
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats);
        setTransactions(d.transactions || []);
      })
      .finally(() => setLoadingStats(false));
    fetch("/api/account/list")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .finally(() => setLoadingAccounts(false));
  }, []);

  // "Active" means the account can transact right now — mirrors the same
  // gating lib/db.js's evaluateAccountUsage() applies before an stkpush:
  // blocked status, or (no active plan) AND (free tier used up) AND
  // (no tokens left).
  const FREE_TX_LIMIT = 25;
  const active = accounts.filter((a) => {
    if (a.status === "payment_failed" || a.status === "suspended") return false;
    const planActive = a.plan_expires_at && new Date(a.plan_expires_at) > new Date();
    if (planActive) return true;
    if ((a.free_tx_used ?? 0) < FREE_TX_LIMIT) return true;
    return (a.token_balance ?? 0) >= 1;
  }).length;

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-semibold mb-6">Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loadingStats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card label="Total transactions" value={stats?.total_transactions ?? 0} delay={0} />
            <Card label="Successful" value={stats?.successful ?? 0} accent="text-mint" delay={1} />
            <Card label="Failed" value={stats?.failed ?? 0} accent="text-danger" delay={2} />
            <Card
              label="Total revenue (KES)"
              value={stats ? Number(stats.total_revenue).toFixed(2) : "0.00"}
              delay={3}
              isMoney
            />
          </>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="glass rounded-lg p-5 mb-8 shadow-neo-sm"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-medium">Linked accounts</div>
          <a href="/dashboard/link-account" className="text-mint text-sm hover:underline">Manage</a>
        </div>
        {loadingAccounts ? (
          <div className="flex gap-6 mt-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
          </div>
        ) : (
          <div className="flex gap-6 text-sm mt-3">
            <div><span className="text-mint font-semibold">{active}</span> <span className="text-muted">active</span></div>
            <div><span className="text-danger font-semibold">{accounts.length - active}</span> <span className="text-muted">inactive</span></div>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="glass rounded-lg p-5 shadow-neo-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Recent transactions</div>
          <a href="/dashboard/transactions" className="text-mint text-sm hover:underline">View all</a>
        </div>
        {loadingStats ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : transactions.length === 0 ? (
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
              {transactions.slice(0, 5).map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-line/50 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2 font-mono text-xs">{t.account_reference}</td>
                  <td className="py-2">KES {Number(t.amount).toFixed(2)}</td>
                  <td className="py-2">{t.phone}</td>
                  <td className="py-2">
                    <StatusBadge status={t.status} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </DashboardLayout>
  );
}

function StatCardSkeleton() {
  return (
    <div className="glass rounded-lg p-4 shadow-neo-sm">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-7 w-14" />
    </div>
  );
}

function Card({ label, value, accent = "text-white", delay = 0, isMoney = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay * 0.06, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className="glass rounded-lg p-4 shadow-neo-sm"
    >
      <div className="text-muted text-xs">{label}</div>
      <div className={`font-display text-2xl font-semibold mt-1 ${accent}`}>
        {isMoney ? value : <CountUp value={Number(value) || 0} />}
      </div>
    </motion.div>
  );
}

// Small manual count-up rather than pulling in a number-tweening dependency
// for one element — ticks from 0 to the target once, then stays put.
function CountUp({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const duration = 600;
    const start = performance.now();
    let frame;
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return display;
}

export function StatusBadge({ status }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full text-amber bg-amberdim">
        <Signal color="amber" />
        pending
      </span>
    );
  }
  const map = {
    success: "text-mint bg-mintdim",
    failed: "text-danger bg-dangerdim",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${map[status] || "text-muted bg-line"}`}>
      {status}
    </span>
  );
}
