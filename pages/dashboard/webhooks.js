import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import Skeleton from "../../components/Skeleton";

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Same gating lib/db.js's evaluateAccountUsage() applies before an
  // stkpush — there's no literal 'active' status, so a trial account with
  // free credits remaining still needs to show up here.
  const FREE_TX_LIMIT = 25;
  function load() {
    Promise.all([
      fetch("/api/webhooks").then((r) => r.json()),
      fetch("/api/account/list").then((r) => r.json()),
    ])
      .then(([webhooksData, accountsData]) => {
        setWebhooks(webhooksData.webhooks || []);
        const active = (accountsData.accounts || []).filter(
          (a) =>
            a.status !== "payment_failed" &&
            a.status !== "suspended" &&
            (a.free_tx_used ?? 0) < FREE_TX_LIMIT
        );
        setAccounts(active);
        if (active[0]) setAccountId(active[0].id);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onAdd(e) {
    e.preventDefault();
    setError("");
    if (!accountId) return setError("Link and activate an account first.");
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, url }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Something went wrong.");
    setUrl("");
    load();
  }

  async function onDelete(id) {
    await fetch("/api/webhooks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-semibold mb-2">Webhooks</h1>
      <p className="text-muted text-sm mb-6">
        Your webhook URL receives a POST request with the transaction result in real time.
      </p>

      {loading ? (
        <div className="glass rounded-lg p-5 mb-6 shadow-neo-sm space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          onSubmit={onAdd}
          className="glass rounded-lg p-5 mb-6 space-y-3 shadow-neo-sm"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-muted uppercase tracking-wide">Account</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-1 w-full bg-base/60 border border-line rounded-md px-3 py-2 text-white shadow-neo-inset focus:outline-none focus:ring-2 focus:ring-mint/60"
              >
                {accounts.length === 0 && <option value="">No active accounts</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.business_name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted uppercase tracking-wide">Webhook URL</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.com/webhooks/mpesa"
                className="mt-1 w-full bg-base/60 border border-line rounded-md px-3 py-2 text-white shadow-neo-inset focus:outline-none focus:ring-2 focus:ring-mint/60"
                required
              />
            </label>
          </div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-danger text-sm overflow-hidden"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium shadow-glow-mint"
          >
            Add webhook
          </motion.button>
        </motion.form>
      )}

      <div className="space-y-3 mb-8">
        {loading ? (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : webhooks.length === 0 ? (
          <p className="text-muted text-sm">No webhooks configured.</p>
        ) : (
          <AnimatePresence>
            {webhooks.map((w, i) => (
              <motion.div
                key={w.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="glass rounded-lg p-4 flex items-center justify-between shadow-neo-sm"
              >
                <div>
                  <div className="font-mono text-sm">{w.url}</div>
                  <div className="text-muted text-xs mt-1">{w.business_name}</div>
                </div>
                <button
                  onClick={() => onDelete(w.id)}
                  className="flex items-center gap-1.5 text-danger text-xs hover:underline"
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="glass rounded-lg p-5 shadow-neo-sm">
        <div className="font-medium mb-3">Webhook payload example</div>
        <p className="text-muted text-sm mb-3">
          When a transaction completes, your webhook URL receives a POST request with this JSON body:
        </p>
        <pre className="bg-base/60 border border-line rounded-md p-4 text-xs font-mono overflow-x-auto shadow-neo-inset">
{`{
  "ResponseCode": 0,
  "ResponseDescription": "Success",
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_...",
  "MpesaReceiptNumber": "QK12ABCDEF",
  "Amount": 100,
  "PhoneNumber": "2547XXXXXXXX"
}`}
        </pre>
      </div>
    </DashboardLayout>
  );
}
