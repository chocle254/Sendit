import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function load() {
    fetch("/api/webhooks").then((r) => r.json()).then((d) => setWebhooks(d.webhooks || []));
    fetch("/api/account/list").then((r) => r.json()).then((d) => {
      const active = (d.accounts || []).filter((a) => a.status === "active");
      setAccounts(active);
      if (active[0]) setAccountId(active[0].id);
    });
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
      <h1 className="text-2xl font-semibold mb-2">Webhooks</h1>
      <p className="text-muted text-sm mb-6">
        Your webhook URL receives a POST request with the transaction result in real time.
      </p>

      <form onSubmit={onAdd} className="bg-panel border border-line rounded-lg p-5 mb-6 space-y-3">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-muted uppercase tracking-wide">Account</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full bg-base border border-line rounded-md px-3 py-2 text-white"
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
              className="mt-1 w-full bg-base border border-line rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-mint"
              required
            />
          </label>
        </div>
        {error && <div className="text-danger text-sm">{error}</div>}
        <button className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium hover:opacity-90">
          Add webhook
        </button>
      </form>

      <div className="space-y-3 mb-8">
        {webhooks.length === 0 ? (
          <p className="text-muted text-sm">No webhooks configured.</p>
        ) : (
          webhooks.map((w) => (
            <div key={w.id} className="bg-panel border border-line rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="font-mono text-sm">{w.url}</div>
                <div className="text-muted text-xs mt-1">{w.business_name}</div>
              </div>
              <button onClick={() => onDelete(w.id)} className="text-danger text-xs hover:underline">
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <div className="bg-panel border border-line rounded-lg p-5">
        <div className="font-medium mb-3">Webhook payload example</div>
        <p className="text-muted text-sm mb-3">
          When a transaction completes, your webhook URL receives a POST request with this JSON body:
        </p>
        <pre className="bg-base border border-line rounded-md p-4 text-xs font-mono overflow-x-auto">
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
