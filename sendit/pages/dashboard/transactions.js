import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { StatusBadge } from "./index";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetch("/api/transactions/list").then((r) => r.json()).then((d) => setTransactions(d.transactions || []));
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold mb-6">Transactions</h1>
      <div className="bg-panel border border-line rounded-lg overflow-hidden">
        {transactions.length === 0 ? (
          <p className="text-muted text-sm p-5">
            No transactions yet. Once your app calls the API, every STK push shows up here.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left border-b border-line">
                <th className="py-3 px-4 font-normal">Checkout ID</th>
                <th className="py-3 px-4 font-normal">Reference</th>
                <th className="py-3 px-4 font-normal">Amount</th>
                <th className="py-3 px-4 font-normal">Phone</th>
                <th className="py-3 px-4 font-normal">Receipt</th>
                <th className="py-3 px-4 font-normal">Status</th>
                <th className="py-3 px-4 font-normal">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-line/50">
                  <td className="py-3 px-4 font-mono text-xs">{t.checkout_request_id}</td>
                  <td className="py-3 px-4">{t.account_reference}</td>
                  <td className="py-3 px-4">KES {Number(t.amount).toFixed(2)}</td>
                  <td className="py-3 px-4">{t.phone}</td>
                  <td className="py-3 px-4 font-mono text-xs">{t.mpesa_receipt || "—"}</td>
                  <td className="py-3 px-4"><StatusBadge status={t.status} /></td>
                  <td className="py-3 px-4 text-muted">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}
