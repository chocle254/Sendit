import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Field } from "../signup";

const EMPTY_FORM = {
  businessName: "",
  tillNumber: "",
  shortcode: "",
  consumerKey: "",
  consumerSecret: "",
  passkey: "",
  activationPhone: "",
};

export default function LinkAccount() {
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [reveal, setReveal] = useState({});

  function loadAccounts() {
    fetch("/api/account/list").then((r) => r.json()).then((d) => setAccounts(d.accounts || []));
  }

  useEffect(loadAccounts, []);

  // While an account is waiting on the KES 350 activation payment, poll for the result.
  useEffect(() => {
    if (!pendingId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/account/status?id=${pendingId}`);
      const data = await res.json();
      if (data.status === "active" || data.status === "payment_failed") {
        clearInterval(interval);
        setPendingId(null);
        loadAccounts();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingId]);

  function set(key) {
    return (value) => setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/account/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return setError(data.error || "Something went wrong.");
    setForm(EMPTY_FORM);
    setShowForm(false);
    setPendingId(data.accountId);
    loadAccounts();
  }

  async function onDelete(id) {
    await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadAccounts();
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Linked accounts</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          + Link new account
        </button>
      </div>

      {pendingId && (
        <div className="bg-mintdim border border-mint/30 text-mint rounded-lg p-4 mb-6 text-sm">
          Check your phone — enter your M-Pesa PIN to pay the KES 350 activation fee.
          This page updates automatically once it's confirmed.
        </div>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="bg-panel border border-line rounded-lg p-5 mb-6 space-y-4">
          <p className="text-muted text-sm">
            Enter your till/paybill and your own Daraja app credentials from{" "}
            <span className="font-mono">developer.safaricom.co.ke</span>. A one-time KES 350
            activation fee confirms the account before we hand you an API key.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Business name" value={form.businessName} onChange={set("businessName")} required />
            <Field label="Till / paybill number" value={form.tillNumber} onChange={set("tillNumber")} required />
            <Field label="Shortcode" value={form.shortcode} onChange={set("shortcode")} required />
            <Field label="Consumer key" value={form.consumerKey} onChange={set("consumerKey")} required />
            <Field label="Consumer secret" type="password" value={form.consumerSecret} onChange={set("consumerSecret")} required />
            <Field label="Passkey" type="password" value={form.passkey} onChange={set("passkey")} required />
            <Field label="Phone to pay activation fee from" value={form.activationPhone} onChange={set("activationPhone")} required />
          </div>
          {error && <div className="text-danger text-sm">{error}</div>}
          <button
            disabled={submitting}
            className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Sending activation prompt…" : "Pay KES 350 and link account"}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {accounts.length === 0 && !showForm && (
          <p className="text-muted text-sm">No accounts linked yet.</p>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="bg-panel border border-line rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{a.business_name}</div>
              <StatusPill status={a.status} />
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
              <Info label="Type" value="Till number" />
              <Info label="Till number" value={a.till_number} mono />
              {a.status === "active" && (
                <>
                  <div>
                    <div className="text-muted text-xs uppercase tracking-wide">API key</div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="font-mono text-xs bg-base border border-line rounded px-2 py-1">
                        {reveal[a.id] ? a.api_key : maskKey(a.api_key)}
                      </code>
                      <button
                        onClick={() => setReveal((r) => ({ ...r, [a.id]: !r[a.id] }))}
                        className="text-xs text-muted hover:text-white"
                      >
                        {reveal[a.id] ? "Hide" : "Show"}
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(a.api_key)}
                        className="text-xs text-mint"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <Info label="API base URL" value="/api/v1/stkpush" mono />
                </>
              )}
            </div>
            <button onClick={() => onDelete(a.id)} className="text-danger text-xs mt-4 hover:underline">
              Delete
            </button>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

function maskKey(key) {
  if (!key) return "";
  return key.slice(0, 11) + "•".repeat(18);
}

function Info({ label, value, mono }) {
  return (
    <div>
      <div className="text-muted text-xs uppercase tracking-wide">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    active: { label: "Active", cls: "text-mint bg-mintdim" },
    pending_payment: { label: "Awaiting payment", cls: "text-yellow-300 bg-yellow-950" },
    payment_failed: { label: "Payment failed", cls: "text-danger bg-red-950" },
  };
  const s = map[status] || map.pending_payment;
  return <span className={`text-xs px-2 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}
