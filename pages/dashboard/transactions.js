import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "../../components/DashboardLayout";
import Skeleton from "../../components/Skeleton";
import { StatusBadge } from "./index";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/transactions/list")
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-semibold mb-6">Transactions</h1>
      <div className="glass rounded-lg overflow-hidden shadow-neo-sm">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-muted text-sm p-5">
            No transactions yet. Once your app calls the API, every STK push shows up here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left border-b border-line">
                  <th className="py-3 px-4 font-normal">Checkout ID</th>
                  <th className="py-3 px-4 font-normal">Reference</th>
                  <th className="py-3 px-4 font-normal">Amount</th>
                  <th className="py-3 px-4 font-normal">Phone</th>
                  <th className="py-3 px-4 font-normal">Receipt</th>
                  <th className="py-3 px-4 font-normal">Status</th>
                  <th className="py-3 px-4 font-normal">Reason</th>
                  <th className="py-3 px-4 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i, 12) * 0.03 }}
                    className="border-b border-line/50 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs">{t.checkout_request_id}</td>
                    <td className="py-3 px-4">{t.account_reference}</td>
                    <td className="py-3 px-4">KES {Number(t.amount).toFixed(2)}</td>
                    <td className="py-3 px-4">{t.phone}</td>
                    <td className="py-3 px-4 font-mono text-xs">{t.mpesa_receipt || "—"}</td>
                    <td className="py-3 px-4"><StatusBadge status={t.status} /></td>
                    <td className="py-3 px-4 text-muted text-xs max-w-[220px] truncate" title={t.result_desc || ""}>
                      {t.status === "pending" ? "—" : t.result_desc || "—"}
                    </td>
                    <td className="py-3 px-4 text-muted">{new Date(t.created_at).toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
